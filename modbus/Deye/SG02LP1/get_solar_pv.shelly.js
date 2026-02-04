/**
 * @title Get Solar Pv
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_solar_pv.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.

    It periodically reads Solar PV (DC input) parameters over Modbus-RTU and prints
    scaled, human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// Solar PV (DC Input) — ENTITIES_SOLAR-style table
let ENTITIES_SOLAR = [
  {
    name: "PV1 Power",
    units: "W",
    reg: { addr: 186, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "PV2 Power",
    units: "W",
    reg: { addr: 187, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "PV3 Power",
    units: "W",
    reg: { addr: 188, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "PV1 Voltage",
    units: "V",
    reg: { addr: 109, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Voltage",
    units: "V",
    reg: { addr: 111, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV3 Voltage",
    units: "V",
    reg: { addr: 113, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Current",
    units: "A",
    reg: { addr: 110, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Current",
    units: "A",
    reg: { addr: 112, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV3 Current",
    units: "A",
    reg: { addr: 114, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Daily Production",
    units: "kWh",
    reg: { addr: 108, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Production",
    units: "kWh",
    reg: { addr: 96, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Micro-inverter Power",
    units: "W",
    reg: { addr: 166, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES_SOLAR[].
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
  for (var name in ENTITIES_SOLAR) {
    value = ENTITIES_SOLAR[name].entity.getValue() * ENTITIES_SOLAR[name].scale;
    console.log(ENTITIES_SOLAR[name].name + ": " + 
    value + 
    "["+ENTITIES_SOLAR[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_SOLAR);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();