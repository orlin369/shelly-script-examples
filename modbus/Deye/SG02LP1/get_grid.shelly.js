/**
 * @title Get Grid
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_grid.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.

    It periodically reads Grid-related electrical parameters over Modbus-RTU and prints
    scaled, human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// Grid Sensors (AC Import/Export) – ENTITIES_GRID-style table
let ENTITIES_GRID = [
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",           // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Grid Voltage L1",
    units: "V",
    reg: {
      addr: 150,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Voltage L2",
    units: "V",
    reg: {
      addr: 151,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Internal CT L1 Power",
    units: "W",
    reg: {
      addr: 167,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",           // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Internal CT L2 Power",
    units: "W",
    reg: {
      addr: 168,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",           // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "External CT L1 Power",
    units: "W",
    reg: {
      addr: 170,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",           // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "External CT L2 Power",
    units: "W",
    reg: {
      addr: 171,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",           // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Daily Energy Bought",
    units: "kWh",
    reg: {
      addr: 76,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Energy Bought",
    units: "kWh",
    reg: {
      addr: 78,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",           // single register in this mapping
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Daily Energy Sold",
    units: "kWh",
    reg: {
      addr: 77,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Energy Sold",
    units: "kWh",
    reg: {
      addr: 81,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",           // single register in this mapping
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES_GRID[].
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
  for (var name in ENTITIES_GRID) {
    value = ENTITIES_GRID[name].entity.getValue() * ENTITIES_GRID[name].scale;
    console.log(ENTITIES_GRID[name].name + ": " + 
    value + 
    "["+ENTITIES_GRID[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_GRID);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();