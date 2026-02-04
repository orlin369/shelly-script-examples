/**
 * @title Display Virtual Components Ui Async
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/display_virtual_components_ui_async.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.
    ENTITIES-based version + Virtual Components.
*/

const INVERTER_MODBUS_SERVER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
const MODBUS_ENDPOINT = ModbusController.get(INVERTER_MODBUS_SERVER_ID, { baud: 9600, mode: "8N1", pause_ms: 2000 });

// ENTITIES table describing all parameters + mapping to virtual components
const ENTITIES = [
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
      poll_int: 10000, // poll less frequently
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
      poll_int: 10000, // poll less frequently
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
      poll_int: 10000, // poll less frequently
    },
    scale: 0.01,
    rights: "R",
    vcId: "number:208",
    handle: null,
    vcHandle: null,
  },
];

function getScaledValue(ent) {
  return ent.handle.getValue() * ent.scale;
}

function updateVc(ent) {
    if (!ent.vcHandle) return;
    const new_val = getScaledValue(ent);
    const old_val = ent.vcHandle.getValue();
    console.log(ent.name + ": " + old_val + " -> " + new_val + " [" + ent.units + "]");
    ent.vcHandle.setValue(new_val);
    return old_val;
}

function dump() {
  console.log("--- PERIODIC DATA DUMP BEGIN ---")
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Refresh value from Modbus
    // you are already polling, this does nothing
    //ent.handle.readOnce();

    console.log(ent.name + ": " + getScaledValue(ent) + " [" + ent.units + "]");
  }
  console.log("--- PERIODIC DATA DUMP END ---")
}

function init() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];
    ent.handle = MODBUS_ENDPOINT.addEntity(ent.reg);
    if (ent.vcId) {
      ent.vcHandle = Virtual.getHandle(ent.vcId);
      ent.handle.on("change", function(handle) {
        updateVc(ent);
      });
    }
  }
  // wait 10 seconds, update all entities once
  Timer.set(10000, false, function() {
    for (let i = 0; i < ENTITIES.length; i++) {
      updateVc(ENTITIES[i]);
    }
  });
// Timer.set(30 * 1000, true, dump);
}

// Run the application.
init();