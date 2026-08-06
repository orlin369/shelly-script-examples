/**
 * @title JK200 BMS MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Jikong JK-PB series BMS over RS485
 *   using the native Shelly ModbusController. Reads cell voltages, pack
 *   voltage, current, SOC, temperatures and alarms.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/JKESS/JK200-MBS/jk200.shelly.js
 */

/**
 * JK200 BMS - MODBUS-RTU Reader
 *
 * Compatible with Jikong JK-PB series BMS:
 *   JK-PB2A8S20P, JK-PB2A16S20P, JK-PB2A20S20P (and other PB variants).
 *
 * To enable MODBUS on the BMS:
 *   Open the JK BMS app -> Settings -> Device Address -> set to 1-15.
 *   Any non-zero address activates RS485 Modbus slave mode.
 *   Default: 115200 baud, 8N1.
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Addressing scheme (JK BMS RS485 Modbus V1.0):
 *   - Supports only FC 0x03 (Read Holding Registers).
 *   - Cell voltages: 0x1200 + cellIndex, U_WORD, mV, one register per cell.
 *
 * Main block register layout (stride-1 WORDs, from 0x128A):
 *   Addr    Field             Type      Unit
 *   0x128A  MOSFET temp       S_WORD    0.1  degC
 *   0x128D  Pack voltage      U_DWORD   mV   (hi 0x128D, lo 0x128E)
 *   0x128F  Pack power        S_DWORD   mW   (hi 0x128F, lo 0x1290)
 *   0x1291  Pack current      S_DWORD   mA   (hi 0x1291, lo 0x1292)
 *   0x1293  Temperature 1     S_WORD    0.1  degC
 *   0x1294  Temperature 2     S_WORD    0.1  degC
 *   0x1295  Alarm bitmask     U_DWORD   --   (hi 0x1295, lo 0x1296)
 *   0x1297  Balance current   S_WORD    mA
 *   0x1298  State of Charge   U_WORD    %
 *
 * References:
 *   JK BMS RS485 Modbus V1.0: https://github.com/ciciban/jkbms-PB2A16S20P
 *   ESPHome integration:       https://github.com/syssi/esphome-jk-bms
 */

// Update rate (sec)
var UPDATE_RATE = 10;

// Number of cells in the pack (8, 10, 12, 14, 16, 20, 24 - match your pack).
var CELL_COUNT = 16;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 115200, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 115200, mode: "8N1" });

// Cell voltages: one entity per cell, 0x1200 + index, mV.
let CELL_ENTITIES = [];
(function buildCellEntities() {
  var i;
  for (i = 0; i < CELL_COUNT; i++) {
    CELL_ENTITIES.push({
      name: "Cell " + (i + 1),
      units: "mV",
      reg: { addr: 0x1200 + i, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
      scale: 1,
      rights: "R"
    });
  }
})();

let MAIN_ENTITIES = [
  { name: "MOSFET Temperature", units: "degC", reg: { addr: 0x128A, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Pack Voltage", units: "mV", reg: { addr: 0x128D, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Pack Power", units: "mW", reg: { addr: 0x128F, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Pack Current", units: "mA", reg: { addr: 0x1291, rtype: ModbusController.REGTYPE_HOLDING, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Temperature 1", units: "degC", reg: { addr: 0x1293, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Temperature 2", units: "degC", reg: { addr: 0x1294, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { name: "Alarm Bitmask", units: "", reg: { addr: 0x1295, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Balance Current", units: "mA", reg: { addr: 0x1297, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "State of Charge", units: "%", reg: { addr: 0x1298, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" }
];

var ALARM_LABELS = [
  "Cell undervoltage",
  "Cell overvoltage",
  "Discharge overcurrent",
  "Charge overcurrent",
  "Low temperature (chg)",
  "High temperature (dis)",
  "MOS overtemperature",
  "Short circuit",
  "Cell delta too large",
  "Pack undervoltage",
  "Pack overvoltage",
  "Low SOC"
];

function alarmsText(bitmask) {
  var active = [];
  var b;
  if (bitmask === 0) return "none";
  for (b = 0; b < ALARM_LABELS.length; b++) {
    if (bitmask & (1 << b)) active.push(ALARM_LABELS[b]);
  }
  if (bitmask & 0x8000) active.push("Manual shutdown");
  return active.join(", ");
}

// Registers all MODBUS entities from an array.
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
  var minV = 65535;
  var maxV = 0;
  var minCell = 0;
  var maxCell = 0;
  var v;

  console.log("--- JK200 BMS ---");

  for (i = 0; i < CELL_ENTITIES.length; i++) {
    v = CELL_ENTITIES[i].entity.getValue();
    console.log(CELL_ENTITIES[i].name + ": " + v + " [mV]");
    if (v < minV) { minV = v; minCell = i + 1; }
    if (v > maxV) { maxV = v; maxCell = i + 1; }
  }
  console.log("Cell Delta: " + (maxV - minV) + " mV (min cell " + minCell + ", max cell " + maxCell + ")");

  for (i = 0; i < MAIN_ENTITIES.length; i++) {
    value = MAIN_ENTITIES[i].entity.getValue() * MAIN_ENTITIES[i].scale;
    if (MAIN_ENTITIES[i].name === "Alarm Bitmask") {
      console.log("Alarms: " + alarmsText(value));
    } else {
      console.log(MAIN_ENTITIES[i].name + ": " + value + " [" + MAIN_ENTITIES[i].units + "]");
    }
  }
}

/*
    Runs once at script start time.
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, CELL_ENTITIES);
  registerEntities(MODBUS_ENDPOINT, MAIN_ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
