/**
 * @title Get Time Use
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_time_use.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.

    It periodically reads Time-of-Use (ToU) scheduling configuration via Modbus-RTU and
    prints human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// Time-of-Use (Energy Management Schedules) — ENTITIES_TOU-style table
let ENTITIES_TOU = [
  { name: "Time of Use Time 1", units: "", reg: { addr: 250, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Time 2", units: "", reg: { addr: 251, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Time 3", units: "", reg: { addr: 252, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Time 4", units: "", reg: { addr: 253, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Time 5", units: "", reg: { addr: 254, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Time 6", units: "", reg: { addr: 255, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },

  { name: "Time of Use Power 1", units: "", reg: { addr: 256, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Power 2", units: "", reg: { addr: 257, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Power 3", units: "", reg: { addr: 258, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Power 4", units: "", reg: { addr: 259, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Power 5", units: "", reg: { addr: 260, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Power 6", units: "", reg: { addr: 261, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },

  { name: "Time of Use SOC 1", units: "", reg: { addr: 268, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use SOC 2", units: "", reg: { addr: 269, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use SOC 3", units: "", reg: { addr: 270, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use SOC 4", units: "", reg: { addr: 271, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use SOC 5", units: "", reg: { addr: 272, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use SOC 6", units: "", reg: { addr: 273, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },

  { name: "Time of Use Enable 1", units: "", reg: { addr: 274, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Enable 2", units: "", reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Enable 3", units: "", reg: { addr: 276, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Enable 4", units: "", reg: { addr: 277, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Enable 5", units: "", reg: { addr: 278, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Time of Use Enable 6", units: "", reg: { addr: 279, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },

  { name: "Time of Use", units: "", reg: { addr: 248, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },

  { name: "Time of Use Voltage 1", units: "V", reg: { addr: 262, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Time of Use Voltage 2", units: "V", reg: { addr: 263, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Time of Use Voltage 3", units: "V", reg: { addr: 264, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Time of Use Voltage 4", units: "V", reg: { addr: 265, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Time of Use Voltage 5", units: "V", reg: { addr: 266, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" },
  { name: "Time of Use Voltage 6", units: "V", reg: { addr: 267, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, rights: "R" }
];

// Registers all MODBUS entities from ENTITIES_TOU[].
function registerEntities(endpoint, entities) {
  for (let i = 0; i < entities.length; i++) {
    entities[i]["entity"] = endpoint.addEntity(entities[i].reg);
  }
}

/*
    🔄 Polling update
*/
function update() {
  var value = 0;
  for (var name in ENTITIES_TOU) {
    value = ENTITIES_TOU[name].entity.getValue() * ENTITIES_TOU[name].scale;
    console.log(ENTITIES_TOU[name].name + ": " + 
    value + 
    "["+ENTITIES_TOU[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_TOU);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();