/**
 * @title Entire Modbus Table
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/SFP5000/entire_modbus_table.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    ENTITIES-based Modbus reader for Growatt SPF5000 Off-Grid/Hybrid Inverter

    Register map based on: growatt_register-map-user_1-2026-01-12.json
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let DEVICE_ID = 1;

// Get a MODBUS-RTU endpoint
let MODBUS_ENDPOINT = ModbusController.get(DEVICE_ID, {
  baud: 9600,
  mode: "8N1"
});

// ENTITIES table - Growatt SPF5000 Off-Grid/Hybrid
let ENTITIES = [
  // ========== SYSTEM ==========
  {
    name: "System Status",
    units: "",
    reg: { addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
    note: "0=Standby,2=Discharge,5=PVCharge,6=ACCharge,7=CombineCharge"
  },

  // ========== PV ==========
  {
    name: "PV1 Voltage",
    units: "V",
    reg: { addr: 1, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Voltage",
    units: "V",
    reg: { addr: 2, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: { addr: 3, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Power",
    units: "W",
    reg: { addr: 5, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck1 Current",
    units: "A",
    reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck2 Current",
    units: "A",
    reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== LOAD / OUTPUT ==========
  {
    name: "Output Power",
    units: "W",
    reg: { addr: 9, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output VA",
    units: "VA",
    reg: { addr: 11, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Power",
    units: "W",
    reg: { addr: 13, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge VA",
    units: "VA",
    reg: { addr: 15, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== BATTERY ==========
  {
    name: "Battery Voltage",
    units: "V",
    reg: { addr: 17, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: { addr: 18, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Bus Voltage",
    units: "V",
    reg: { addr: 19, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== GRID / AC INPUT ==========
  {
    name: "AC Input Voltage",
    units: "V",
    reg: { addr: 20, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input Frequency",
    units: "Hz",
    reg: { addr: 21, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Output Voltage",
    units: "V",
    reg: { addr: 22, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output Frequency",
    units: "Hz",
    reg: { addr: 23, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Output DC Voltage",
    units: "V",
    reg: { addr: 24, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== TEMPERATURES ==========
  {
    name: "Inverter Temperature",
    units: "C",
    reg: { addr: 25, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "DC-DC Temperature",
    units: "C",
    reg: { addr: 26, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Load Percent",
    units: "%",
    reg: { addr: 27, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Port Voltage",
    units: "V",
    reg: { addr: 28, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Battery Bus Voltage",
    units: "V",
    reg: { addr: 29, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Work Time Total",
    units: "s",
    reg: { addr: 30, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.5,
    rights: "R"
  },
  {
    name: "Buck1 Temperature",
    units: "C",
    reg: { addr: 32, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck2 Temperature",
    units: "C",
    reg: { addr: 33, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output Current",
    units: "A",
    reg: { addr: 34, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Inverter Current",
    units: "A",
    reg: { addr: 35, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input Power",
    units: "W",
    reg: { addr: 36, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input VA",
    units: "VA",
    reg: { addr: 38, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== FAULT/WARNING ==========
  {
    name: "Fault Code",
    units: "",
    reg: { addr: 40, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Warning Code",
    units: "",
    reg: { addr: 42, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },

  // ========== ENERGY COUNTERS ==========
  {
    name: "PV1 Energy Today",
    units: "kWh",
    reg: { addr: 48, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Energy Total",
    units: "kWh",
    reg: { addr: 50, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Energy Today",
    units: "kWh",
    reg: { addr: 52, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Energy Total",
    units: "kWh",
    reg: { addr: 54, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Energy Today",
    units: "kWh",
    reg: { addr: 56, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Energy Total",
    units: "kWh",
    reg: { addr: 58, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Today",
    units: "kWh",
    reg: { addr: 60, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Total",
    units: "kWh",
    reg: { addr: 62, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Energy Today",
    units: "kWh",
    reg: { addr: 64, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Energy Total",
    units: "kWh",
    reg: { addr: 66, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Current",
    units: "A",
    reg: { addr: 68, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Power",
    units: "W",
    reg: { addr: 69, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge VA",
    units: "VA",
    reg: { addr: 71, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Power",
    units: "W",
    reg: { addr: 73, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge VA",
    units: "VA",
    reg: { addr: 75, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Power",
    units: "W",
    reg: { addr: 77, rtype: ModbusController.REGTYPE_INPUT, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R",
    note: "Positive=Discharge, Negative=Charge"
  },
  {
    name: "Battery Over Charge",
    units: "",
    reg: { addr: 80, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
    note: "0=Normal, 1=Over charge"
  },
  {
    name: "MPPT Fan Speed",
    units: "%",
    reg: { addr: 81, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Inverter Fan Speed",
    units: "%",
    reg: { addr: 82, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },

  // ========== BMS ==========
  {
    name: "BMS Status",
    units: "",
    reg: { addr: 90, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Error",
    units: "",
    reg: { addr: 91, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Warning",
    units: "",
    reg: { addr: 92, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS SOC",
    units: "%",
    reg: { addr: 93, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Battery Voltage",
    units: "V",
    reg: { addr: 94, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Battery Current",
    units: "A",
    reg: { addr: 95, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Battery Temp",
    units: "C",
    reg: { addr: 96, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Max Current",
    units: "A",
    reg: { addr: 97, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS CV Voltage",
    units: "V",
    reg: { addr: 98, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  for (let i = 0; i < entities.length; i++) {
    entities[i]["entity"] = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Polling update
*/
function update() {
  var value = 0;
  for (var name in ENTITIES) {
    value = ENTITIES[name].entity.getValue() * ENTITIES[name].scale;
    console.log(ENTITIES[name].name + ": " + value + "[" + ENTITIES[name].units + "]");
  }
}

/*
    Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Start the application
init();
