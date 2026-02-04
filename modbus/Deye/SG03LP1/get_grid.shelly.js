/**
 * @title Get Grid
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG03LP1/get_grid.shelly.js
 */

// Deye SG03LP1 – Grid (AC Import/Export) – MODBUS entities for Shelly Script

let ENTITIES = [
  // ---------- deye_sg03lp1 – Grid (AC Import/Export) ----------
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
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
      itype: "i16",
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
      itype: "i16",
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
      itype: "i16",
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
      itype: "i16",
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
    name: "Total Energy Bought",
    units: "kWh",
    reg: {
      addr: 78,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Frequecy",
    units: "Hz",
    reg: {
      addr: 79,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Total Energy Sold",
    units: "kWh",
    reg: {
      addr: 81,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
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