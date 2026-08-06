/**
 * @title V-TAC VT-66036103 inferred MODBUS reader
 * @description Reads a small set of inferred holding registers from the
 *   V-TAC VT-66036103 / INVT-family inverter using the native Shelly
 *   ModbusController and prints them to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_inferred_reader.shelly.js
 */

/**
 * V-TAC VT-66036103 Inferred MODBUS Reader
 *
 * This script is based on local reverse-engineering work in:
 * - registers.md
 * - register-proposals.md
 *
 * Important:
 * - The register names and scales here are inferred, not vendor-confirmed.
 * - The goal is to poll the most plausible holding registers every 15 seconds
 *   and keep the results visible in the console during validation.
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

// Update rate (sec)
var UPDATE_RATE = 15;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

let ENTITIES = [
  { name: "Battery Voltage Threshold A", units: "V", reg: { addr: 8704, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Voltage Threshold B", units: "V", reg: { addr: 8705, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Voltage Threshold C", units: "V", reg: { addr: 8706, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Voltage Threshold D", units: "V", reg: { addr: 8707, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Charge Current Limit", units: "A", reg: { addr: 8708, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Discharge Current Limit", units: "A", reg: { addr: 8711, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Battery Capacity", units: "Ah?", reg: { addr: 8712, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "PV1 Max Input Current", units: "A", reg: { addr: 8713, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "PV2 Max Input Current", units: "A", reg: { addr: 8714, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "PV Max Voltage Limit", units: "V", reg: { addr: 8718, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "MPPT Upper Limit", units: "V", reg: { addr: 8720, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "MPPT Upper Recovery", units: "V", reg: { addr: 8721, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Rated AC Power", units: "W", reg: { addr: 8725, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "AC Output Current Limit", units: "A", reg: { addr: 8729, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Model Power Class", units: "kW", reg: { addr: 8737, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Nominal Grid Frequency A", units: "Hz", reg: { addr: 8738, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "Nominal Grid Frequency B", units: "Hz", reg: { addr: 8739, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "Unused Marker", units: "raw", reg: { addr: 8836, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "Percentage Limit", units: "%", reg: { addr: 8856, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1 },
  { name: "Grid High Frequency Trip", units: "Hz", reg: { addr: 8992, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.01 },
  { name: "Grid Low Frequency Trip", units: "Hz", reg: { addr: 8993, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.01 },
  { name: "Grid Voltage Threshold A", units: "V", reg: { addr: 8994, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Grid Voltage Threshold B", units: "V", reg: { addr: 8995, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 }
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
  var raw;
  var value;

  console.log("--- V-TAC VT-66036103 inferred map ---");

  for (i = 0; i < ENTITIES.length; i++) {
    raw = ENTITIES[i].entity.getValue();
    value = raw * ENTITIES[i].scale;
    console.log(ENTITIES[i].name + ": " + value + " [" + ENTITIES[i].units + "] raw=" + raw + " addr=" + ENTITIES[i].reg.addr);
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
