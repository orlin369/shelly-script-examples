/**
 * @title Growatt Input Entities
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/SFP5000/growatt_input_entities.shelly.js
 */

// Code created with the help of "Ivanushka (ChatGPT)"
// Growatt – Inverter / PV / Grid (input registers)

let ENTITIES = [
  // ---------- growatt_input ----------

  {
    name: "Status",
    units: "",
    reg: {
      addr: 0, // data[0]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // Map via statusMap in your script
    scale: 1,
    rights: "R"
  },
  {
    name: "Input Power",
    units: "W",
    reg: {
      addr: 1, // data[1] (high) + data[2] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[1] << 16 | data[2]) / 10.0
    scale: 0.1,
    rights: "R"
  },

  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 3, // data[3]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[3] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Current",
    units: "A",
    reg: {
      addr: 4, // data[4]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[4] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Input Power",
    units: "W",
    reg: {
      addr: 5, // data[5] (high) + data[6] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[5] << 16 | data[6]) / 10.0
    scale: 0.1,
    rights: "R"
  },

  {
    name: "PV2 Voltage",
    units: "V",
    reg: {
      addr: 7, // data[7]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[7] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Current",
    units: "A",
    reg: {
      addr: 8, // data[8]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[8] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Input Power",
    units: "W",
    reg: {
      addr: 9, // data[9] (high) + data[10] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[9] << 16 | data[10]) / 10.0
    scale: 0.1,
    rights: "R"
  },

  {
    name: "Output Power",
    units: "W",
    reg: {
      addr: 35, // data[35] (high) + data[36] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[35] << 16 | data[36]) / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Frequency",
    units: "Hz",
    reg: {
      addr: 37, // data[37]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[37] / 100.0
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Grid Voltage",
    units: "V",
    reg: {
      addr: 38, // data[38]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[38] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Output Current",
    units: "A",
    reg: {
      addr: 39, // data[39]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[39] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Grid Output Power",
    units: "VA",
    reg: {
      addr: 40, // data[40] (high) + data[41] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[40] << 16 | data[41]) / 10.0
    scale: 0.1,
    rights: "R"
  },

  {
    name: "Today Energy",
    units: "kWh",
    reg: {
      addr: 53, // data[53] (high) + data[54] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[53] << 16 | data[54]) / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Energy",
    units: "kWh",
    reg: {
      addr: 55, // data[55] (high) + data[56] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[55] << 16 | data[56]) / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Total Work Time",
    units: "s",
    reg: {
      addr: 57, // data[57] (high) + data[58] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[57] << 16 | data[58]) / 2
    scale: 0.5,
    rights: "R"
  },

  {
    name: "PV1 Today Energy",
    units: "kWh",
    reg: {
      addr: 59, // data[59] (high) + data[60] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Total Energy",
    units: "kWh",
    reg: {
      addr: 61, // data[61] (high) + data[62] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Today Energy",
    units: "kWh",
    reg: {
      addr: 63, // data[63] (high) + data[64] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Total Energy",
    units: "kWh",
    reg: {
      addr: 65, // data[65] (high) + data[66] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.1,
    rights: "R"
  },

  {
    name: "PV Energy Total",
    units: "kWh",
    reg: {
      addr: 91, // data[91] (high) + data[92] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[91] << 16 | data[92]) / 10.0
    scale: 0.1,
    rights: "R"
  },
    {
    name: "Inverter Temperature",
    units: "°C",
    reg: {
      addr: 93, // data[93]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[93] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "IPM Temperature",
    units: "°C",
    reg: {
      addr: 94, // data[94]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[94] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Inverter Output PF Raw",
    units: "",
    reg: {
      addr: 100, // data[100], 0–20000
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Error Code",
    units: "",
    reg: {
      addr: 105, // data[105]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // Map via errorMap in your script
    scale: 1,
    rights: "R"
  },
  {
    name: "Real Power Percent",
    units: "%",
    reg: {
      addr: 113, // data[113]
      rtype: ModbusController.REGTYPE_INPUT,
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

