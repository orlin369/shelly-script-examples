/**
 * @title Davis Pyranometer MODBUS example
 * @description Reads solar irradiance (W/m2) from a Davis-compatible RS-485
 *   pyranometer over MODBUS-RTU using the native Shelly ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Davis/Pyranometer/pyranometer.shelly.js
 */

/**
 * Davis Pyranometer MODBUS-RTU Reader
 *
 * Discovered parameters:
 *   Slave ID : 1
 *   Baud rate: 9600
 *   Mode     : 8N1
 *
 * Register map (FC 0x04 - Read Input Registers):
 *   Addr 0x0000 - Solar Irradiance  UINT16  W/m2   (0 - 2000)
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

// Update rate (sec)
var UPDATE_RATE = 5;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

// Solar Irradiance, input register 0, W/m2.
let ENTRY_IRRADIANCE = MODBUS_ENDPOINT.addEntity({ addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: "u16" });

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  ENTRY_IRRADIANCE.readOnce();
  let irradiance = ENTRY_IRRADIANCE.getValue();
  console.log("Irradiance: " + irradiance + " [W/m2]");
}

/*
    Runs once at script start time.
*/
function init() {
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
