/**
 * @title Growatt Battery Entities
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/MIN_4200TL-XE/growatt_battery_entities.shelly.js
 */

// Code created with the help of "Ivanushka (ChatGPT)"
// Growatt – Battery (input registers starting at 1000)

let ENTITIES = [
  // ---------- growatt_battery ----------

  {
    name: "Battery Status",
    units: "",
    reg: {
      addr: 1000, // data[0] from readInputRegisters(1000, ...)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // Map via battery statusMap in your script
    scale: 1,
    rights: "R"
  },
  {
    name: "Battery Discharge Power",
    units: "W",
    reg: {
      addr: 1009, // data[9] (high) + data[10] (low)
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
    name: "Battery Charge Power",
    units: "W",
    reg: {
      addr: 1011, // data[11] (high) + data[12] (low)
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // (data[11] << 16 | data[12]) / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Voltage",
    units: "V",
    reg: {
      addr: 1013, // data[13]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[13] / 10.0
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Capacity Percent",
    units: "%",
    reg: {
      addr: 1014, // data[14]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Battery Temperature",
    units: "°C",
    reg: {
      addr: 1040, // data[40]
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    // data[40] / 10.0
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

