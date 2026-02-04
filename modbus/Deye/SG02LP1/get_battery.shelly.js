/**
 * @title Get Battery
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/get_battery.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with Deye solar inverter.

    It periodically reads battery-related parameters over Modbus-RTU and prints
    scaled, human-readable values to the script console.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, {
  baud: 9600,
  mode: "8N1"
});

// Battery (DC Storage System) – ENTITIES-style table
let ENTITIES_BATTERY = [
  {
    name: "Total Battery Charge",
    units: "kWh",
    reg: {
      addr: 72,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Total Battery Discharge",
    units: "kWh",
    reg: {
      addr: 74,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Daily Battery Charge",
    units: "kWh",
    reg: {
      addr: 70,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Daily Battery Discharge",
    units: "kWh",
    reg: {
      addr: 71,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
  },
  {
    name: "Battery Status",
    units: "",
    reg: {
      addr: 189,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",   // unsigned
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
      itype: "i16",   // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
  },
  {
    name: "Battery Voltage",
    units: "V",
    reg: {
      addr: 183,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
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
    name: "Battery Current",
    units: "A",
    reg: {
      addr: 191,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",   // signed
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
    rights: "R",
  },
  {
    name: "Battery Temperature",
    units: "°C",
    reg: {
      addr: 182,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
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
  for (var name in ENTITIES_BATTERY) {
    value = ENTITIES_BATTERY[name].entity.getValue() * ENTITIES_BATTERY[name].scale;
    console.log(ENTITIES_BATTERY[name].name + ": " + 
    value + 
    "["+ENTITIES_BATTERY[name].units+"]");
  }
}

/*
    ▶ Initialization on Script Start
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES_BATTERY);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// 🚀 Start the application
init();