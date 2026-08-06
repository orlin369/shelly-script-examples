/**
 * @title Marstek VenusE MODBUS-RTU reader
 * @description Reads live battery, AC, energy, temperature, state, alarm, and
 *   limit registers from a Marstek VenusE device over MODBUS-RTU using the
 *   native Shelly ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU Reader
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Register source:
 * - modbus marstek - address.csv
 * - modbus marstek - ex_info.csv
 * - Venus-E 3.0 485 Protocol v1.0, 2024-07-08
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This script only reads telemetry and status registers. Writable control
 *   registers from the CSV are used by venus_e_control_vc.shelly.js.
 */

// Update rate (sec)
var UPDATE_RATE = 15;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 115200, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 115200, mode: "8N1" });

let ENTITIES = [
  { name: "Battery Voltage", units: "V", reg: { addr: 32100, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: "Battery Current", units: "A", reg: { addr: 32101, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: "Battery Power", units: "W", reg: { addr: 32102, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: "Battery SOC", units: "%", reg: { addr: 32104, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: "Battery Total Energy", units: "kWh", reg: { addr: 32105, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: "AC Voltage", units: "V", reg: { addr: 32200, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "AC Power", units: "W", reg: { addr: 32202, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: "AC Frequency", units: "Hz", reg: { addr: 32204, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "AC Offgrid Voltage", units: "V", reg: { addr: 32300, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "AC Offgrid Power", units: "W", reg: { addr: 32302, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: "Daily Charging Energy", units: "kWh", reg: { addr: 33004, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: "Daily Discharging Energy", units: "kWh", reg: { addr: 33006, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: "Internal Temperature", units: "C", reg: { addr: 35000, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "Max Cell Temperature", units: "C", reg: { addr: 35010, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "Min Cell Temperature", units: "C", reg: { addr: 35011, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "Inverter State", units: "", reg: { addr: 35100, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, isState: true },
  { name: "Alarm Word 36000", units: "", reg: { addr: 36000, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "alarm36000" },
  { name: "Alarm Word 36001", units: "", reg: { addr: 36001, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "alarm36001" },
  { name: "Fault Word 36100", units: "", reg: { addr: 36100, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "fault36100" },
  { name: "Fault Word 36101", units: "", reg: { addr: 36101, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "fault36101" },
  { name: "Fault Word 36103", units: "", reg: { addr: 36103, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "fault36103" },
  { name: "Fault Word 36104", units: "", reg: { addr: 36104, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: "fault36104" },
  { name: "Charge Voltage Limit", units: "V", reg: { addr: 35110, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "Charge Current Limit", units: "A", reg: { addr: 35111, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: "Discharge Current Limit", units: "A", reg: { addr: 35112, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 }
];

var BIT_NAMES = {
  alarm36000: [
    "PLL Abnormal Restart",
    "Overtemperature Limit",
    "Low Temperature Limit",
    "Fan Abnormal Warning",
    "Low Battery SOC Warning",
    "Output Overcurrent Warning",
    "Abnormal Line Sequence Detection"
  ],
  alarm36001: [
    "WIFI abnormal",
    "BLE abnormal",
    "Network abnormal",
    "CT connection abnormal"
  ],
  fault36100: [
    "Grid overvoltage",
    "Grid undervoltage",
    "Grid overfrequency",
    "Grid underfrequency",
    "Grid peak voltage abnormal",
    "Current Dcover",
    "Voltage Dcover"
  ],
  fault36101: [
    "BAT overvoltage",
    "BAT undervoltage",
    "BAT overcurrent",
    "BAT low SOC",
    "BAT communication failure",
    "BMS protect"
  ],
  fault36103: [
    "hardware Bus overvoltage",
    "hardware Output overcurrent",
    "hardware trans overcurrent",
    "hardware Battery overcurrent",
    "Hardware protection",
    "Output overcurrent",
    "High voltage bus overvoltage",
    "High voltage bus undervoltage",
    "Overpower protection",
    "FSM abnormal",
    "Overtemperature protection",
    "Inverter soft start timeout"
  ],
  fault36104: [
    "self-test fault",
    "eeprom fault",
    "other system fault"
  ]
};

function stateName(raw) {
  if (raw === 0) return "sleep";
  if (raw === 1) return "standby";
  if (raw === 2) return "charge";
  if (raw === 3) return "discharge";
  if (raw === 4) return "backup mode";
  if (raw === 5) return "OTA upgrade";
  if (raw === 6) return "bypass";
  return "unknown";
}

function describeBits(raw, key) {
  var names = BIT_NAMES[key];
  var active = [];
  var i;

  if (!names) return "";

  for (i = 0; i < names.length; i++) {
    if (raw & (1 << i)) active.push(names[i]);
  }

  if (active.length === 0) return "normal";
  return active.join(", ");
}

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
  var entity;
  var raw;
  var value;
  var line;

  console.log("--- Marstek VenusE ---");

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    raw = entity.entity.getValue();
    value = raw * entity.scale;

    line = entity.name + ": " + value;
    if (entity.units !== "") line += " [" + entity.units + "]";
    if (entity.isState) line += " (" + stateName(raw) + ")";
    if (entity.bits) line += " (" + describeBits(raw, entity.bits) + ")";

    console.log(line);
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
