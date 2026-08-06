/**
 * @title MODBUS Register Discovery Scanner
 * @description Walks a MODBUS-RTU device register space over RS485 using
 *   single-register holding/input reads via the native Shelly ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/utils/modbus_register_scan.shelly.js
 */

/**
 * Generic MODBUS Register Discovery Scanner
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * This utility assumes the bus parameters are already known and controlled
 * from CONFIG at the top of the file.
 *
 * It probes the target register map one address at a time with quantity 1:
 * - REGTYPE_HOLDING, configured address range
 * - REGTYPE_INPUT,   configured address range
 *
 * Output behavior:
 * - Successful reads print the register address and 16-bit value
 * - Exception and timeout counts are reported only in the final summary
 *
 * This is intentionally slow and explicit because the goal is discovery, not
 * production polling. Once useful registers are identified, use those results
 * to build a dedicated reader script.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  SLAVE_ID: 1,
  BAUD_RATES: [9600],
  MODE: "8N1",

  RTYPE_LIST: [ModbusController.REGTYPE_HOLDING, ModbusController.REGTYPE_INPUT],
  ADDR_START: 0,
  ADDR_END: 5000,
  QTY: 1,

  RESPONSE_TIMEOUT_MS: 400,
  INTER_FRAME_MS: 40
};

var state = {
  baudIdx: 0,
  rtypeIdx: 0,
  addr: CONFIG.ADDR_START,
  results: {},
  readable: {}
};

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

function currentRtype() {
  return CONFIG.RTYPE_LIST[state.rtypeIdx];
}

function currentBaud() {
  return CONFIG.BAUD_RATES[state.baudIdx];
}

function currentLabel() {
  return currentRtype() === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT";
}

function currentBucket() {
  return currentBaud() + "/" + currentLabel();
}

function currentReadableKey() {
  return currentBaud() + "_" + currentLabel().toLowerCase();
}

function printResult(status, extra) {
  var line = "[" + currentBaud() + "][" + currentLabel() + "] addr=" + state.addr + " (0x" + toHex16(state.addr) + ") -> " + status;
  if (extra) line += " " + extra;
  print(line);
}

function ensureResultBuckets() {
  var i;
  var j;
  var key;
  var readableKey;

  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    for (j = 0; j < CONFIG.RTYPE_LIST.length; j++) {
      key = CONFIG.BAUD_RATES[i] + "/" + (CONFIG.RTYPE_LIST[j] === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT");
      if (!state.results[key]) {
        state.results[key] = { ok: 0, exception: 0, timeout: 0 };
      }
      readableKey = CONFIG.BAUD_RATES[i] + "_" + (CONFIG.RTYPE_LIST[j] === ModbusController.REGTYPE_HOLDING ? "holding" : "input");
      if (!state.readable[readableKey]) {
        state.readable[readableKey] = [];
      }
    }
  }
}

function sendRead() {
  var endpoint = ModbusController.get(CONFIG.SLAVE_ID, { baud: currentBaud(), mode: CONFIG.MODE });
  var timedOut = false;
  var timer;
  var bucket = state.results[currentBucket()];

  timer = Timer.set(CONFIG.RESPONSE_TIMEOUT_MS, false, function() {
    timedOut = true;
    bucket.timeout++;
    advance();
  });

  endpoint.readRegisters({ rtype: currentRtype(), addr: state.addr, qty: CONFIG.QTY }, function(result, error) {
    if (timedOut) return;
    Timer.clear(timer);

    if (result !== undefined && result !== null && result.length > 0) {
      bucket.ok++;
      state.readable[currentReadableKey()].push(state.addr);
      printResult("OK", "value=" + result[0] + " hex=0x" + toHex16(result[0]));
    } else {
      bucket.exception++;
    }

    advance();
  });
}

function advance() {
  state.addr++;

  if (state.addr > CONFIG.ADDR_END) {
    state.rtypeIdx++;
    if (state.rtypeIdx >= CONFIG.RTYPE_LIST.length) {
      state.rtypeIdx = 0;
      state.baudIdx++;
      if (state.baudIdx >= CONFIG.BAUD_RATES.length) {
        printSummary();
        return;
      }
      print("");
      print("=== Switching to baud " + currentBaud() + " ===");
    }

    state.addr = CONFIG.ADDR_START;
    print("");
    print("--- " + currentBaud() + " / " + currentLabel() + " REGISTERS ---");
  }

  Timer.set(CONFIG.INTER_FRAME_MS, false, sendRead);
}

function printFcSummary(baud, rtype) {
  var key = baud + "/" + (rtype === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT");
  var item = state.results[key];
  var name = rtype === ModbusController.REGTYPE_HOLDING ? "Holding Registers" : "Input Registers";

  print(name + " (" + baud + "):");
  print("  OK: " + item.ok);
  print("  Exception: " + item.exception);
  print("  Timeout: " + item.timeout);
}

function printSummary() {
  var i;

  print("");
  print("========================================");
  print("MODBUS Register Discovery Summary");
  print("========================================");
  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    print("Baud " + CONFIG.BAUD_RATES[i] + ":");
    printFcSummary(CONFIG.BAUD_RATES[i], ModbusController.REGTYPE_HOLDING);
    printFcSummary(CONFIG.BAUD_RATES[i], ModbusController.REGTYPE_INPUT);
    print("  Readable holding addresses: " + state.readable[CONFIG.BAUD_RATES[i] + "_holding"].length);
    print("  Readable input addresses: " + state.readable[CONFIG.BAUD_RATES[i] + "_input"].length);
  }
  print("========================================");
}

function init() {
  print("");
  print("MODBUS Register Discovery Scanner");
  print("=================================");
  print("Slave:   " + CONFIG.SLAVE_ID);
  print("UART:    " + CONFIG.BAUD_RATES.join(", ") + " " + CONFIG.MODE);
  print("Range:   " + CONFIG.ADDR_START + ".." + CONFIG.ADDR_END);
  print("Qty:     " + CONFIG.QTY);
  print("");

  ensureResultBuckets();

  print("--- " + currentBaud() + " / " + currentLabel() + " REGISTERS ---");
  Timer.set(300, false, sendRead);
}

init();
