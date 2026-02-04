/**
 * @title Get Inverter Ac
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_inverter_ac.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.

    It periodically reads AC inverter output electrical parameters over Modbus-RTU and prints
    scaled, human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// Inverter (AC Output) – ENTITIES_INVERTER-style table
let ENTITIES_INVERTER = [
  {
    name: "Total Power",
    units: "W",
    reg: {
      addr: 175,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Current L1",
    units: "A",
    reg: {
      addr: 164,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Current L2",
    units: "A",
    reg: {
      addr: 165,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Inverter L1 Power",
    units: "W",
    reg: {
      addr: 173,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Inverter L2 Power",
    units: "W",
    reg: {
      addr: 174,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 1,
    rights: "R"
  },
  {
    name: "Load Frequency",
    units: "Hz",
    reg: {
      addr: 192,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16", // unsigned
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "DC Temperature",
    units: "°C",
    reg: {
      addr: 90,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "AC Temperature",
    units: "°C",
    reg: {
      addr: 91,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16", // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE
    },
    scale: 0.01,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES_INVERTER[].
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
  for (var name in ENTITIES_INVERTER) {
    value = ENTITIES_INVERTER[name].entity.getValue() * ENTITIES_INVERTER[name].scale;
    console.log(ENTITIES_INVERTER[name].name + ": " + 
    value + 
    "["+ENTITIES_INVERTER[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_INVERTER);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();