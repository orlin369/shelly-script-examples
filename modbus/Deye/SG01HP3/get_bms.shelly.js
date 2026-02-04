/**
 * @title Get Bms
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG01HP3/get_bms.shelly.js
 */

// Deye SG01HP3 – BMS – MODBUS entities

let ENTITIES = [
  // ---------- deye_sg01hp3_bms ----------

  {
    name: "BMS1 Charging Voltage",
    units: "V",
    reg: {
      addr: 210,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS1 Discharge Voltage",
    units: "V",
    reg: {
      addr: 211,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS1 Charge Current Limit",
    units: "A",
    reg: {
      addr: 212,
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
      addr: 213,
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
      addr: 214,
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
      addr: 215,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS1 Current",
    units: "A",
    reg: {
      addr: 216,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS1 Temp",
    units: "°C",
    reg: {
      addr: 217,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS1 Charging Max Current",
    units: "A",
    reg: {
      addr: 218,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS1 Discharge Max Current",
    units: "A",
    reg: {
      addr: 219,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  {
    name: "BMS2 Charging Voltage",
    units: "V",
    reg: {
      addr: 241,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS2 Discharge Voltage",
    units: "V",
    reg: {
      addr: 242,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS2 Charge Current Limit",
    units: "A",
    reg: {
      addr: 243,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS2 Discharge Current Limit",
    units: "A",
    reg: {
      addr: 244,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS2 SOC",
    units: "%",
    reg: {
      addr: 245,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS2 Voltage",
    units: "V",
    reg: {
      addr: 246,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS2 Current",
    units: "A",
    reg: {
      addr: 247,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS2 Temp",
    units: "°C",
    reg: {
      addr: 248,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS2 Charging Max Current",
    units: "A",
    reg: {
      addr: 249,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS2 Discharge Max Current",
    units: "A",
    reg: {
      addr: 250,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
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
