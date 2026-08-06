/**
 * @title WB-MIR v3 MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Wirenboard WB-MIR v3 IR transceiver and
 *   environment sensor over RS485 using the native Shelly ModbusController.
 *   Reads DS18B20 temperature, button press counters, IR module presence,
 *   and supply voltages.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3.shelly.js
 */

/**
 * Wirenboard WB-MIR v3 - MODBUS-RTU Reader
 *
 * WB-MIR v3 features:
 *   - IR transceiver (send/receive IR commands, up to 80 stored commands)
 *   - 1-Wire input for DS18B20 temperature sensor
 *   - Discrete input (button) with short / long / double press detection
 *   - RS485 MODBUS-RTU slave
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 62.
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * References:
 *   WB-MIR v3 Register Map: https://wiki.wirenboard.com/wiki/WB-MIR_v3_Registers
 */

// Update rate (sec)
var UPDATE_RATE = 5;

// Get a MODBUS-RTU endpoint: ID 62, baud rate 9600, 8N2.
let MODBUS_ENDPOINT = ModbusController.get(62, { baud: 9600, mode: "8N2" });

let ENTITIES = [
  // --- Discrete Inputs (FC 0x02) ---
  { name: "Input 1W State", units: "", reg: { addr: 0, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "1-Wire Probe Status", units: "", reg: { addr: 16, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  { name: "1-Wire Temperature", units: "degC", reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Uptime", units: "s", reg: { addr: 104, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Supply Voltage", units: "mV", reg: { addr: 121, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Min Supply Voltage", units: "mV", reg: { addr: 122, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "MCU Supply Voltage", units: "mV", reg: { addr: 123, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "MCU Temperature", units: "degC", reg: { addr: 124, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "IR Transceiver", units: "", reg: { addr: 375, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "1-Wire Sensor", units: "", reg: { addr: 376, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Short Press Counter", units: "", reg: { addr: 464, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Long Press Counter", units: "", reg: { addr: 480, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Double Press Counter", units: "", reg: { addr: 496, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Short+Long Counter", units: "", reg: { addr: 512, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  // --- Holding Registers (FC 0x03) - configuration ---
  { name: "Conn Loss Timeout", units: "s", reg: { addr: 8, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Sensor Poll Period", units: "s", reg: { addr: 101, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Input 1W Mode", units: "", reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Debounce Time", units: "ms", reg: { addr: 340, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Long Press Duration", units: "ms", reg: { addr: 1100, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Double Press Wait", units: "ms", reg: { addr: 1140, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" }
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

  console.log("--- WB-MIR v3 ---");

  for (i = 0; i < ENTITIES.length; i++) {
    raw = ENTITIES[i].entity.getValue();

    if (ENTITIES[i].name === "1-Wire Temperature" && raw === 0x7FFF) {
      console.log(ENTITIES[i].name + ": sensor error");
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
