/**
 * @title WB-MIR v3 MODBUS Reconfiguration Utility
 * @description One-shot utility to change the WB-MIR v3 baud rate and slave ID
 *   over MODBUS-RTU using the native Shelly ModbusController. Connects at the
 *   current settings (115200 baud, slave 133), writes the new slave ID (62)
 *   to register 128, then writes the new baud rate code (96 = 9600 bps) to
 *   register 110. Power-cycle the device afterwards.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3_reconfig.shelly.js
 */

/**
 * WB-MIR v3 - MODBUS Reconfiguration Utility
 *
 * Writes two holding registers to change communication parameters:
 *   Reg 128 (0x0080): Slave ID          current 133 -> target 62
 *   Reg 110 (0x006E): Baud rate code    current 1152 (115200) -> target 96 (9600)
 *
 * Baud rate encoding (value x 100 = bps):
 *   96   = 9,600 bps
 *   1152 = 115,200 bps
 *
 * Register source:
 *   https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 *
 * IMPORTANT:
 *   - Changes take effect after a power cycle of the WB-MIR v3.
 *   - Slave ID is written first; baud rate is written last so the bus
 *     stays usable if the slave ID write fails.
 *   - Delete or disable this script after a successful reconfiguration.
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

/* === CONFIG === */
var CONFIG = {
  // Current communication settings (what the device is responding on now)
  BAUD_CURRENT: 115200,
  MODE: "8N2", // WB-MIR v3 default: 8 data, no parity, 2 stop bits
  SLAVE_CURRENT: 133,

  // Target settings to write
  SLAVE_TARGET: 62,
  BAUD_TARGET: 9600, // written as 96 (baud / 100) per WB register encoding

  STEP_DELAY: 200 // ms between writes
};

/* === REGISTER ADDRESSES === */
var REG_SLAVE_ID = 128; // Holding, RW - Modbus slave address (1-247)
var REG_BAUD_RATE = 110; // Holding, RW - RS-485 speed code (value x 100 = bps)

var CURRENT_ENDPOINT = ModbusController.get(CONFIG.SLAVE_CURRENT, { baud: CONFIG.BAUD_CURRENT, mode: CONFIG.MODE });
var TARGET_ENDPOINT = ModbusController.get(CONFIG.SLAVE_TARGET, { baud: CONFIG.BAUD_CURRENT, mode: CONFIG.MODE });

/* === RECONFIGURATION SEQUENCE === */

function step1_writeSlaveId() {
  print("Step 1/2 - Writing new slave ID: " + CONFIG.SLAVE_TARGET + "  (reg " + REG_SLAVE_ID + ")");

  CURRENT_ENDPOINT.writeRegisters({ addr: REG_SLAVE_ID, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [CONFIG.SLAVE_TARGET], function(success, error) {
    if (!success) {
      print("  FAILED: " + error);
      print("  Check wiring, power, and current settings.");
      return;
    }
    print("  OK");
    Timer.set(CONFIG.STEP_DELAY, false, step2_writeBaudRate);
  });
}

function step2_writeBaudRate() {
  // Write using the NEW slave ID (just confirmed written successfully)
  var baudCode = CONFIG.BAUD_TARGET / 100; // 9600 / 100 = 96
  print("Step 2/2 - Writing new baud rate code: " + baudCode + "  (" + CONFIG.BAUD_TARGET + " bps, reg " + REG_BAUD_RATE + ")");

  TARGET_ENDPOINT.writeRegisters({ addr: REG_BAUD_RATE, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [baudCode], function(success, error) {
    if (!success) {
      print("  FAILED: " + error);
      print("  Slave ID was already updated. Retry baud rate write at slave " +
        CONFIG.SLAVE_TARGET + " on " + CONFIG.BAUD_CURRENT + " baud.");
      return;
    }
    print("  OK");
    printDone();
  });
}

function printDone() {
  print("");
  print("=========================================");
  print("Reconfiguration complete.");
  print("Power-cycle the WB-MIR v3 to apply.");
  print("");
  print("New settings:");
  print("  Slave ID:  " + CONFIG.SLAVE_TARGET);
  print("  Baud rate: " + CONFIG.BAUD_TARGET);
  print("  Mode:      " + CONFIG.MODE);
  print("=========================================");
}

/* === INIT === */

function init() {
  print("WB-MIR v3 - MODBUS Reconfiguration Utility");
  print("===========================================");
  print("Current: slave=" + CONFIG.SLAVE_CURRENT + "  baud=" + CONFIG.BAUD_CURRENT + "  mode=" + CONFIG.MODE);
  print("Target:  slave=" + CONFIG.SLAVE_TARGET + "  baud=" + CONFIG.BAUD_TARGET + "  mode=" + CONFIG.MODE);
  print("");

  Timer.set(300, false, step1_writeSlaveId);
}

init();
