/**
 * @title Display Virtual Components
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/application_examples/display_virtual_components.shelly.js
 */


/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Growatt SFP 5000 solar inverter.
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
    vcId: "number:200",
    handle: null,
    vcHandle: null,
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
    vcId: "number:201",
    handle: null,
    vcHandle: null,
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
    vcId: "number:202",
    handle: null,
    vcHandle: null,
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
    vcId: "number:203",
    handle: null,
    vcHandle: null,
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
    vcId: "number:204",
    handle: null,
    vcHandle: null,
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
    vcId: "number:205",
    handle: null,
    vcHandle: null,
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
    vcId: "number:206",
    handle: null,
    vcHandle: null,
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
    vcId: "number:207",
    handle: null,
    vcHandle: null,
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
