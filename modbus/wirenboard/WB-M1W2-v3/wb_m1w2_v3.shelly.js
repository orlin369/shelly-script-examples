/**
 * @title WB-M1W2 v3 MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Wirenboard WB-M1W2 v3 1-Wire to RS-485
 *   converter using the native Shelly ModbusController. Reads two external
 *   DS18B20 1-Wire channels, discrete input states, sensor presence flags,
 *   supply voltage, and pulse counters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-M1W2-v3/wb_m1w2_v3.shelly.js
 */

/**
 * Wirenboard WB-M1W2 v3 - MODBUS-RTU Reader
 *
 * WB-M1W2 v3 features:
 *   - Two universal inputs, each supporting up to 20 DS18B20 1-Wire sensors in parallel
 *   - Built-in NTC thermistor for internal/ambient temperature
 *   - Discrete input detection with debounce and pulse counting
 *   - RS485 MODBUS-RTU slave (9-28 V supply)
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 1 (printed on device label).
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * References:
 *   WB-M1W2 Product Page:  https://wirenboard.com/en/product/WB-M1W2/
 *   WB-M1W2 Wiki (EN):     https://wiki.wirenboard.com/wiki/WB-M1W2_1-Wire_to_Modbus_Temperature_Measurement_Module/en
 */

// Update rate (sec)
var UPDATE_RATE = 5;

// Get a MODBUS-RTU endpoint: ID 13, baud rate 9600, 8N2.
let MODBUS_ENDPOINT = ModbusController.get(13, { baud: 9600, mode: "8N2" });

let ENTITIES = [
  // --- Discrete Inputs (FC 0x02) ---
  { name: "Input #1 State", units: "", reg: { addr: 0, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Input #2 State", units: "", reg: { addr: 1, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Sensor #1 Status", units: "", reg: { addr: 16, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Sensor #2 Status", units: "", reg: { addr: 17, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  { name: "NTC Temperature", units: "degC", reg: { addr: 6, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Ch1 Temperature", units: "degC", reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Ch2 Temperature", units: "degC", reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Supply Voltage", units: "mV", reg: { addr: 121, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Counter Ch1", units: "", reg: { addr: 277, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Counter Ch2", units: "", reg: { addr: 278, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  // --- Holding Registers (FC 0x03) - configuration (read FC3, write FC6/FC16) ---
  { name: "Filter Threshold", units: "degC", reg: { addr: 99, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "RW" },
  { name: "Baud Rate", units: "bps", reg: { addr: 110, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 100, rights: "RW" },
  { name: "Parity", units: "", reg: { addr: 111, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Stop Bits", units: "", reg: { addr: 112, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Reset", units: "", reg: { addr: 120, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Slave Address", units: "", reg: { addr: 128, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Input #1 Mode", units: "", reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Input #2 Mode", units: "", reg: { addr: 276, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  var i;
  var value;
  var raw;

  console.log("--- WB-M1W2 v3 ---");

  for (i = 0; i < ENTITIES.length; i++) {
    raw = ENTITIES[i].entity.getValue();

    if ((ENTITIES[i].name === "Ch1 Temperature" || ENTITIES[i].name === "Ch2 Temperature" || ENTITIES[i].name === "NTC Temperature") && raw === 0x7FFF) {
      console.log(ENTITIES[i].name + ": absent/error");
      continue;
    }

    value = raw * ENTITIES[i].scale;
    console.log(ENTITIES[i].name + ": " + value + " [" + ENTITIES[i].units + "]");
  }
}

/*
    Runs once at script start time.
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
