/**
 * @title All Registes
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/CyberPower/CP1600EPFCLCD/all_registes.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a UPS.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// ENTITIES table describing all parameters + mapping to virtual components
let ENTITIES = [
  // ---------------------------------------------------------
  // 🔋 BATTERY GROUP
  // ---------------------------------------------------------
  {
    name: "Battery Charge",
    units: "%",
    reg: { addr: 0, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Runtime",
    units: "seconds",
    reg: { addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Runtime Low",
    units: "seconds",
    reg: { addr: 6, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Design Capacity",
    units: "%",
    reg: { addr: 7, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Charge Warning",
    units: "%",
    reg: { addr: 8, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Charge Low",
    units: "%",
    reg: { addr: 9, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Voltage",
    units: "V",
    reg: { addr: 10, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1, // decivolts → volts
    rights: "R",
  },
  {
    name: "Battery Voltage Nominal",
    units: "V",
    reg: { addr: 11, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R",
  },

  // ---------------------------------------------------------
  // ⚡ AC INPUT GROUP
  // ---------------------------------------------------------
  {
    name: "Input Voltage",
    units: "V",
    reg: { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Input Voltage Nominal",
    units: "V",
    reg: { addr: 12, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Input Transfer Low",
    units: "V",
    reg: { addr: 13, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Input Transfer High",
    units: "V",
    reg: { addr: 14, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },

  // ---------------------------------------------------------
  // 🔌 AC OUTPUT GROUP
  // ---------------------------------------------------------
  {
    name: "Output Voltage",
    units: "V",
    reg: { addr: 3, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "UPS Load",
    units: "%",
    reg: { addr: 4, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Real Power Nominal",
    units: "W",
    reg: { addr: 19, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },

  // ---------------------------------------------------------
  // 🧠 STATUS GROUP
  // ---------------------------------------------------------
  {
    name: "Status Word",
    units: "",
    reg: { addr: 5, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Test Code",
    units: "",
    reg: { addr: 16, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },

  // ---------------------------------------------------------
  // 🕒 TIMERS GROUP
  // ---------------------------------------------------------
  {
    name: "Timer Shutdown",
    units: "seconds",
    reg: { addr: 17, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Timer Start",
    units: "seconds",
    reg: { addr: 18, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },

  // ---------------------------------------------------------
  // 🔊 CONTROL GROUP
  // ---------------------------------------------------------
  {
    name: "Beeper Mode",
    units: "",
    reg: { addr: 15, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
  },
  {
    name: "Beeper Control",
    units: "",
    reg: { addr: 32, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "RW",
  },
];

// Registers all MODBUS entities from ENTITIES[].
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
  for (var name in ENTITIES) {
    value = ENTITIES[name].entity.getValue() * ENTITIES[name].scale;
    console.log(ENTITIES[name].name + ": " + 
    value + 
    "["+ENTITIES[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();
