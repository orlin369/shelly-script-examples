/**
 * @title Display Virtual Components
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/display_virtual_components.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.
    ENTITIES-based version + Virtual Components.
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter ID.
let INVERTER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// ENTITIES table describing all parameters + mapping to virtual components
let ENTITIES = [
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
    vcId: "number:200",
    handle: null,
    vcHandle: null,
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
    vcId: "number:201",
    handle: null,
    vcHandle: null,
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
    vcId: "number:202",
    handle: null,
    vcHandle: null,
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
    scale: 10, // as in your original script
    rights: "R",
    vcId: "number:203",
    handle: null,
    vcHandle: null,
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
    vcId: "number:204",
    handle: null,
    vcHandle: null,
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
    vcId: "number:205",
    handle: null,
    vcHandle: null,
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
    vcId: "number:206",
    handle: null,
    vcHandle: null,
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
    vcId: "number:207",
    handle: null,
    vcHandle: null,
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
    vcId: "number:208",
    handle: null,
    vcHandle: null,
  },
];

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Refresh value from Modbus
    ent.handle.readOnce();

    // Read raw value and scale it
    let raw = ent.handle.getValue();
    let value = raw * ent.scale;

    // Log to console (optional, but nice for debugging)
    console.log(ent.name + ": " + value + " [" + ent.units + "]");

    // Push into virtual component if mapped
    if (ent.vcHandle !== null) {
      ent.vcHandle.setValue(value);
    }
  }
}

/*
    Runs once at script start time.
    Here we register all MODBUS entities and virtual components based on ENTITIES.
*/
function init() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Create Modbus entity
    ent.handle = MODBUS_ENDPOINT.addEntity(ent.reg);

    // Attach virtual component handle if vcId is present
    if (ent.vcId) {
      ent.vcHandle = Virtual.getHandle(ent.vcId);
    }
  }

  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
