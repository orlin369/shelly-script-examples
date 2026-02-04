/**
 * @title Modbus Entity Structure Template
 * @description Defines a structured list of Modbus entities and polls them on
 *   a timer loop, intended as a starting point for inverter or meter
 *   integrations.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/mb_structure_entities.shelly.js
 */

/**
 * Modbus entity structure example.
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly devices with Modbus RTU Add-on support.
 *
 * Configuration:
 * - UPDATE_RATE: polling interval in seconds
 * - INVERTER_ID: Modbus slave ID
 * - ENTITIES: register map entries with type, scaling, and access rights
 */

// Update rate (sec)
let UPDATE_RATE = 10;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// MODBUS-RTU entities for Deye inverter.
var ENTITIES = [
  {
    name: "Total Power",
    units: "W",
    reg: {
      addr: 175,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Power",
    units: "W",
    reg: {
      addr: 190,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: {
      addr: 186,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 10,
    rights: "R",
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: {
      addr: 184,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },
  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 109,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Grid Voltage L1",
    units: "V",
    reg: {
      addr: 150,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Current L1",
    units: "A",
    reg: {
      addr: 164,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
    rights: "R",
  },
  {
    name: "AC Frequency",
    units: "Hz",
    reg: {
      addr: 192,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
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
