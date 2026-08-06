/**
 * @title DFRobot SEN0492 Laser Ranging Sensor - MODBUS-RTU reader
 * @description Reads distance and status from a DFRobot SEN0492 RS485 laser
 *   ranging sensor over MODBUS-RTU using the native Shelly ModbusController
 *   and prints values to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/DFRobot/SEN0492/sen0492.shelly.js
 */

/**
 * DFRobot SEN0492 Laser Ranging Sensor - MODBUS-RTU Reader
 *
 * Sensor parameters (factory defaults):
 *   Slave ID  : 0x50 (80)
 *   Baud rate : 115200
 *   Mode      : 8N1
 *
 * Register map (FC 0x03 - Read Holding Registers):
 *
 *   Addr  Name                 Type    Unit   Access  Notes
 *   ----  -------------------  ------  -----  ------  ------------------
 *   0x34  Distance             UINT16  mm     R       Range: 0-4000
 *   0x35  Output State         UINT16  -      R       See STATUS_* constants
 *
 * Status codes (register 0x35):
 *   0x00  Valid measurement
 *   0x01  Sigma Fail
 *   0x02  Signal Fail
 *   0x03  Min Range Fail
 *   0x04  Phase Fail
 *   0x05  Hardware Fail
 *   0x07  No Update
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Reference: https://wiki.dfrobot.com/Laser_Ranging_Sensor_RS485_4m_SKU_SEN0492
 */

// Update rate (sec)
var UPDATE_RATE = 5;

// Get a MODBUS-RTU endpoint: ID 0x50 (80), baud rate 115200, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(0x50, { baud: 115200, mode: "8N1" });

// Distance, holding register 0x34, mm.
let ENTRY_DISTANCE = MODBUS_ENDPOINT.addEntity({ addr: 0x34, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" });

// Output state / status code, holding register 0x35.
let ENTRY_STATUS = MODBUS_ENDPOINT.addEntity({ addr: 0x35, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" });

var STATUS_NAMES = {
  0x00: "Valid",
  0x01: "Sigma Fail",
  0x02: "Signal Fail",
  0x03: "Min Range Fail",
  0x04: "Phase Fail",
  0x05: "Hardware Fail",
  0x07: "No Update"
};

function statusName(code) {
  var name = STATUS_NAMES[code];
  return name !== undefined ? name : "Unknown (0x" + code.toString(16) + ")";
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  ENTRY_DISTANCE.readOnce();
  ENTRY_STATUS.readOnce();

  let distance = ENTRY_DISTANCE.getValue();
  let status = ENTRY_STATUS.getValue();

  console.log("Distance: " + distance + " [mm]  Status: " + statusName(status));
}

/*
    Runs once at script start time.
*/
function init() {
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
