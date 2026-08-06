/**
 * @title WB-MIR v3 IR Utility
 * @description Dedicated MODBUS-RTU utility for WB-MIR v3 infrared functions
 *   using the native Shelly ModbusController. Supports learning IR commands
 *   to ROM or RAM, playing stored commands, dumping IR buffers, and erasing
 *   all saved IR commands.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3_ir.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - Infrared Utility
 *
 * This script is dedicated to the WB-MIR v3 IR transceiver registers.
 * It does not poll temperature or button counters. Instead, it performs a
 * single IR-related operation selected in CONFIG.ACTION.
 *
 * Supported actions:
 *   - play_rom      Play a command already stored in ROM slot N
 *   - learn_rom     Learn one IR command from a remote into ROM slot N
 *   - learn_ram     Learn one IR command into RAM only, then dump the buffer
 *   - play_ram      Play the IR command currently stored in RAM buffer
 *   - dump_rom      Open ROM slot N for editing and print its raw IR buffer
 *   - erase_all_rom Delete all saved ROM IR commands
 *
 * Key IR registers from the Wirenboard IR manual:
 *   5000  Erase all ROM commands
 *   5001  Learn command into RAM
 *   5002  Play command from RAM
 *   5500  Play command from ROM by slot number
 *   5501  Open ROM command for editing in holding registers 2000+
 *   5502  Learn command into ROM by slot number
 *   2000+ Raw IR buffer in holding registers
 *
 * Notes:
 *   - Slot numbering is 1-based for the WB-MIR v3 IR command banks.
 *   - Only one IR operation can be active at a time; the device returns BUSY
 *     or an exception if another IR job is already running.
 *   - For reliable learning, point the remote at the WB-MIR receiver and press
 *     the remote button once from close range during the learn window.
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *   WB-MIR IR Manual: https://wiki.wirenboard.com/wiki/WB-MSx_Consumer_IR_Manual
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 9600,
  MODE: "8N2",
  SLAVE_ID: 62,

  // play_rom | learn_rom | learn_ram | play_ram | dump_rom | erase_all_rom
  ACTION: "play_rom",

  // WB-MIR IR banks are 1-based.
  ROM_SLOT: 1,

  OP_TIMEOUT: 20000,
  POLL_INTERVAL: 250,
  LEARN_WINDOW_MS: 10000,

  BUFFER_START: 2000,
  BUFFER_CHUNK_REGS: 32,
  BUFFER_MAX_REGS: 256
};

/* === REGISTER MAP === */
var REG = {
  ERASE_ALL_ROM: 5000,
  LEARN_RAM: 5001,
  PLAY_RAM: 5002,
  PLAY_ROM: 5500,
  EDIT_ROM: 5501,
  LEARN_ROM: 5502,
  BUFFER_START: 2000
};

var MODBUS_ENDPOINT = ModbusController.get(CONFIG.SLAVE_ID, { baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE });

/* === STATE === */
var state = {
  opTimer: null
};

function fail(msg) {
  if (state.opTimer) {
    Timer.clear(state.opTimer);
    state.opTimer = null;
  }
  print("[WB-MIR IR] ERROR: " + msg);
}

/* === MODBUS HELPERS === */

function writeSingleRegister(addr, value, callback) {
  MODBUS_ENDPOINT.writeRegisters({ addr: addr, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [value], function(success, error) {
    callback(success ? null : error);
  });
}

function readHoldingRegisters(addr, qty, callback) {
  MODBUS_ENDPOINT.readRegisters({ rtype: ModbusController.REGTYPE_HOLDING, addr: addr, qty: qty }, function(result, error) {
    if (result === undefined || result === null) {
      callback(error, null);
      return;
    }
    callback(null, result);
  });
}

/* === IR HELPERS === */

function validateSlot() {
  if (CONFIG.ROM_SLOT < 1 || CONFIG.ROM_SLOT > 80) {
    fail("CONFIG.ROM_SLOT must be between 1 and 80");
    return false;
  }
  return true;
}

function monitorRegisterZero(reg, label, callback) {
  var remainingMs = CONFIG.OP_TIMEOUT;

  function poll() {
    readHoldingRegisters(reg, 1, function(err, regs) {
      var v;
      if (err) {
        callback(err);
        return;
      }
      v = regs[0];
      print(label + " reg " + reg + " = " + v);
      if (v === 0) {
        callback(null);
        return;
      }
      if (v === 0xFFFF) {
        callback("Device reported error 0xFFFF");
        return;
      }
      remainingMs -= CONFIG.POLL_INTERVAL;
      if (remainingMs <= 0) {
        callback(label + " timeout");
        return;
      }
      Timer.set(CONFIG.POLL_INTERVAL, false, poll);
    });
  }

  poll();
}

function findDoubleZero(buf) {
  var i;
  for (i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0 && buf[i + 1] === 0) return i;
  }
  return -1;
}

function printIrBuffer(buf) {
  var term = findDoubleZero(buf);
  var last = term >= 0 ? term + 2 : buf.length;
  var i;
  print("IR buffer words: " + last);
  for (i = 0; i < last; i++) {
    print("  [" + i + "] = " + buf[i]);
  }
}

function dumpIrBuffer(callback) {
  var all = [];

  function readChunk(offset) {
    var addr = CONFIG.BUFFER_START + offset;
    var remaining = CONFIG.BUFFER_MAX_REGS - offset;
    var qty = remaining > CONFIG.BUFFER_CHUNK_REGS ? CONFIG.BUFFER_CHUNK_REGS : remaining;
    var i;
    var term;

    if (qty <= 0) {
      callback(null, all);
      return;
    }

    readHoldingRegisters(addr, qty, function(err, regs) {
      if (err) {
        callback(err, null);
        return;
      }

      for (i = 0; i < regs.length; i++) all.push(regs[i]);

      term = findDoubleZero(all);
      if (term >= 0 || all.length >= CONFIG.BUFFER_MAX_REGS) {
        callback(null, all);
        return;
      }

      Timer.set(50, false, function() {
        readChunk(offset + qty);
      });
    });
  }

  readChunk(0);
}

/* === ACTIONS === */

function actionPlayRom() {
  if (!validateSlot()) return;
  print("Playing IR command from ROM slot " + CONFIG.ROM_SLOT + "...");
  writeSingleRegister(REG.PLAY_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail("play_rom start failed: " + err);
      return;
    }
    monitorRegisterZero(REG.PLAY_ROM, "play_rom", function(err) {
      if (err) {
        fail("play_rom failed: " + err);
        return;
      }
      print("IR playback complete.");
    });
  });
}

function actionLearnRom() {
  if (!validateSlot()) return;
  print("Learning IR command into ROM slot " + CONFIG.ROM_SLOT + "...");
  print("Point the remote at WB-MIR and press the desired button once.");
  writeSingleRegister(REG.LEARN_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail("learn_rom start failed: " + err);
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_ROM, 0, function(stopErr) {
        if (stopErr) {
          fail("learn_rom stop failed: " + stopErr);
          return;
        }
        print("Learn window closed for ROM slot " + CONFIG.ROM_SLOT + ".");
      });
    });
  });
}

function actionLearnRam() {
  print("Learning IR command into RAM...");
  print("Point the remote at WB-MIR and press the desired button once.");
  writeSingleRegister(REG.LEARN_RAM, 1, function(err) {
    if (err) {
      fail("learn_ram start failed: " + err);
      return;
    }

    state.opTimer = Timer.set(CONFIG.LEARN_WINDOW_MS, false, function() {
      writeSingleRegister(REG.LEARN_RAM, 0, function(stopErr) {
        if (stopErr) {
          fail("learn_ram stop failed: " + stopErr);
          return;
        }
        print("Learn window closed. Dumping RAM buffer...");
        dumpIrBuffer(function(dumpErr, buf) {
          if (dumpErr) {
            fail("buffer dump failed: " + dumpErr);
            return;
          }
          printIrBuffer(buf);
        });
      });
    });
  });
}

function actionPlayRam() {
  print("Playing IR command from RAM buffer...");
  writeSingleRegister(REG.PLAY_RAM, 1, function(err) {
    if (err) {
      fail("play_ram start failed: " + err);
      return;
    }
    monitorRegisterZero(REG.PLAY_RAM, "play_ram", function(doneErr) {
      if (doneErr) {
        fail("play_ram failed: " + doneErr);
        return;
      }
      print("RAM playback complete.");
    });
  });
}

function actionDumpRom() {
  if (!validateSlot()) return;
  print("Opening ROM slot " + CONFIG.ROM_SLOT + " for buffer dump...");
  writeSingleRegister(REG.EDIT_ROM, CONFIG.ROM_SLOT, function(err) {
    if (err) {
      fail("dump_rom open failed: " + err);
      return;
    }

    dumpIrBuffer(function(dumpErr, buf) {
      if (dumpErr) {
        fail("dump_rom read failed: " + dumpErr);
        return;
      }
      printIrBuffer(buf);
      writeSingleRegister(REG.EDIT_ROM, 0, function(closeErr) {
        if (closeErr) {
          fail("dump_rom close failed: " + closeErr);
          return;
        }
        print("ROM slot " + CONFIG.ROM_SLOT + " closed.");
      });
    });
  });
}

function actionEraseAllRom() {
  print("Erasing all IR commands from ROM...");
  writeSingleRegister(REG.ERASE_ALL_ROM, 1, function(err) {
    if (err) {
      fail("erase_all_rom failed: " + err);
      return;
    }
    print("All ROM IR commands erase requested.");
  });
}

/* === INIT === */

function init() {
  print("WB-MIR v3 - IR Utility");
  print("======================");
  print("Action: " + CONFIG.ACTION);
  print("Slave ID: " + CONFIG.SLAVE_ID);
  print("");

  Timer.set(300, false, function() {
    if (CONFIG.ACTION === "play_rom") {
      actionPlayRom();
    } else if (CONFIG.ACTION === "learn_rom") {
      actionLearnRom();
    } else if (CONFIG.ACTION === "learn_ram") {
      actionLearnRam();
    } else if (CONFIG.ACTION === "play_ram") {
      actionPlayRam();
    } else if (CONFIG.ACTION === "dump_rom") {
      actionDumpRom();
    } else if (CONFIG.ACTION === "erase_all_rom") {
      actionEraseAllRom();
    } else {
      fail("Unknown CONFIG.ACTION: " + CONFIG.ACTION);
    }
  });
}

init();
