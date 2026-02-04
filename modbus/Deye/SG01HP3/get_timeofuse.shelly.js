/**
 * @title Get Timeofuse
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG01HP3/get_timeofuse.shelly.js
 */

// Deye SG01HP3 – Time-of-Use – MODBUS entities

let ENTITIES = [
  // ---------- deye_sg01hp3_timeofuse ----------

  {
    name: "Time of Use Weekly Selling Schedule",
    units: "",
    reg: {
      addr: 146,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  {
    name: "Time of Use Time 1",
    units: "",
    reg: {
      addr: 148,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Time 2",
    units: "",
    reg: {
      addr: 149,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Time 3",
    units: "",
    reg: {
      addr: 150,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Time 4",
    units: "",
    reg: {
      addr: 151,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Time 5",
    units: "",
    reg: {
      addr: 152,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Time 6",
    units: "",
    reg: {
      addr: 153,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  {
    name: "Time of Use Power 1",
    units: "W",
    reg: {
      addr: 154,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Time of Use Power 2",
    units: "W",
    reg: {
      addr: 155,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Time of Use Power 3",
    units: "W",
    reg: {
      addr: 156,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Time of Use Power 4",
    units: "W",
    reg: {
      addr: 157,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Time of Use Power 5",
    units: "W",
    reg: {
      addr: 158,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },
  {
    name: "Time of Use Power 6",
    units: "W",
    reg: {
      addr: 159,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 10,
    rights: "R"
  },

  {
    name: "Time of Use Voltage 1",
    units: "V",
    reg: {
      addr: 160,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Time of Use Voltage 2",
    units: "V",
    reg: {
      addr: 161,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Time of Use Voltage 3",
    units: "V",
    reg: {
      addr: 162,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Time of Use Voltage 4",
    units: "V",
    reg: {
      addr: 163,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Time of Use Voltage 5",
    units: "V",
    reg: {
      addr: 164,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Time of Use Voltage 6",
    units: "V",
    reg: {
      addr: 165,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },

  {
    name: "Time of Use SOC 1",
    units: "%",
    reg: {
      addr: 166,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use SOC 2",
    units: "%",
    reg: {
      addr: 167,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use SOC 3",
    units: "%",
    reg: {
      addr: 168,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use SOC 4",
    units: "%",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use SOC 5",
    units: "%",
    reg: {
      addr: 170,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use SOC 6",
    units: "%",
    reg: {
      addr: 171,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },

  {
    name: "Time of Use Charge Enable 1",
    units: "",
    reg: {
      addr: 172,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Charge Enable 2",
    units: "",
    reg: {
      addr: 173,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Charge Enable 3",
    units: "",
    reg: {
      addr: 174,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Charge Enable 4",
    units: "",
    reg: {
      addr: 175,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Charge Enable 5",
    units: "",
    reg: {
      addr: 176,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Time of Use Charge Enable 6",
    units: "",
    reg: {
      addr: 177,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
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
