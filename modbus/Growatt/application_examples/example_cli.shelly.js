/**
 * @title Example Cli
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/application_examples/example_cli.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Growqatt SFP 5000 solar inverter.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// ENTITIES table describing all parameters + mapping to virtual components
let ENTITIES = [
  //
  // --- Total AC Output Power (equivalent to Deye "Total Power")
  //
  {
    name: "Total Power",
    units: "W",
    reg: {
      addr: 9, // input register, 32-bit
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1, // per Growatt spec
    rights: "R",
  },

  //
  // --- Battery Power (charge/discharge)
  //
  {
    name: "Battery Power",
    units: "W",
    reg: {
      addr: 77, // signed 32-bit: positive = discharge, negative = charge
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },

  //
  // --- PV1 Power (DC input)
  //
  {
    name: "PV1 Power",
    units: "W",
    reg: {
      addr: 3, // 32-bit
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u32",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },

  //
  // --- Grid Active Power (Import/Export)
  //
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 41, // signed value: import/export
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "i32",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    // Growatt does NOT multiply by 10 like Deye
    scale: 0.1,
    rights: "R",
  },

  //
  // --- Battery SOC
  //
  {
    name: "Battery SOC",
    units: "%",
    reg: {
      addr: 18,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },

  //
  // --- PV1 Voltage
  //
  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 1,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },

  //
  // --- Grid Voltage (AC output)
  //
  {
    name: "Grid Voltage",
    units: "V",
    reg: {
      addr: 20,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },

  //
  // --- Load Current (approx)
  // Growatt does not expose per-phase currents like Deye
  //
  {
    name: "AC Load Current",
    units: "A",
    reg: {
      addr: 22,
      rtype: ModbusController.REGTYPE_INPUT,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },

  //
  // --- Grid Frequency
  //
  {
    name: "AC Frequency",
    units: "Hz",
    reg: {
      addr: 21,
      rtype: ModbusController.REGTYPE_INPUT,
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