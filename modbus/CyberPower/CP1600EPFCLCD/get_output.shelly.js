/**
 * @title Get Output
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/CyberPower/CP1600EPFCLCD/get_output.shelly.js
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
