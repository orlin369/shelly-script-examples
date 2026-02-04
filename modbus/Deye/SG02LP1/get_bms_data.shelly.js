/**
 * @title Get Bms Data
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_bms_data.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.

    It periodically reads BMS-related parameters over Modbus-RTU and prints
    scaled, human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// BMS Data (Battery Management System) – ENTITIES-style table
let ENTITIES_BMS = [
  {
    name: "BMS1 Charging Voltage",
    units: "V",
    reg: {
      addr: 312,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "BMS1 Discharge Voltage",
    units: "V",
    reg: {
      addr: 313,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "BMS1 Charge Current Limit",
    units: "A",
    reg: {
      addr: 314,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS1 Discharge Current Limit",
    units: "A",
    reg: {
      addr: 315,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS1 SOC",
    units: "%",
    reg: {
      addr: 316,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS1 Voltage",
    units: "V",
    reg: {
      addr: 317,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "BMS1 Current",
    units: "A",
    reg: {
      addr: 318,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS1 Temp",
    units: "°C",
    reg: {
      addr: 319,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES_BMS[].
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
  for (var name in ENTITIES_BMS) {
    value = ENTITIES_BMS[name].entity.getValue() * ENTITIES_BMS[name].scale;
    console.log(ENTITIES_BMS[name].name + ": " + 
    value + 
    "["+ENTITIES_BMS[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_BMS);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();