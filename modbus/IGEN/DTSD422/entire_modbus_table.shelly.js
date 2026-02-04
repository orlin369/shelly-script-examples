/**
 * @title Entire Modbus Table
 * @description Modbus RTU example script. Adjust registers and configuration for your target device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/IGEN/DTSD422/entire_modbus_table.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    ENTITIES-based Modbus reader for IGEN DTSD-422-D3

    MODBUS-RTU Table: https://www.solarfy.de/mediafiles/Sonstiges/WR/Six-circuitWiFi-DTSD422-D3-W-v1.0-EN.pdf
*/

// Update rate (sec)
var UPDATE_RATE = 3;

// Inverter / Meter ID.
let DEVICE_ID = 1;

// Get a MODBUS-RTU endpoint
let MODBUS_ENDPOINT = ModbusController.get(DEVICE_ID, {
  baud: 9600,
  mode: "8N1"
});

// ENTITIES table (converted from Python)
let ENTITIES = [
  // -------- CT1 --------
  {
    name: "Voltage CT1",
    units: "V",
    reg: { addr: 0x01, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1
  },
  {
    name: "Current CT1",
    units: "A",
    reg: { addr: 0x07, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Active Power CT1",
    units: "W",
    reg: { addr: 0x0F, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Reactive Power CT1",
    units: "Var",
    reg: { addr: 0x17, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Apparent Power CT1",
    units: "VA",
    reg: { addr: 0x1F, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Power Factor CT1",
    units: "",
    reg: { addr: 0x26, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Total Positive Energy CT1",
    units: "kWh",
    reg: { addr: 0x3E, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },
  {
    name: "Total Negative Energy CT1",
    units: "kWh",
    reg: { addr: 0x48, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },

  // -------- CT2 --------
  {
    name: "Voltage CT2",
    units: "V",
    reg: { addr: 0x02, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1
  },
  {
    name: "Current CT2",
    units: "A",
    reg: { addr: 0x09, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Active Power CT2",
    units: "W",
    reg: { addr: 0x11, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Reactive Power CT2",
    units: "Var",
    reg: { addr: 0x19, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Apparent Power CT2",
    units: "VA",
    reg: { addr: 0x21, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Power Factor CT2",
    units: "",
    reg: { addr: 0x27, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Total Positive Energy CT2",
    units: "kWh",
    reg: { addr: 0x52, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },
  {
    name: "Total Negative Energy CT2",
    units: "kWh",
    reg: { addr: 0x5C, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },

  // ------- CT3 --------
  {
    name: "Voltage CT3",
    units: "V",
    reg: { addr: 0x03, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1
  },
  {
    name: "Current CT3",
    units: "A",
    reg: { addr: 0x0B, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Active Power CT3",
    units: "W",
    reg: { addr: 0x13, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Reactive Power CT3",
    units: "Var",
    reg: { addr: 0x1B, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Apparent Power CT3",
    units: "VA",
    reg: { addr: 0x23, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Power Factor CT3",
    units: "",
    reg: { addr: 0x28, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Total Positive Energy CT3",
    units: "kWh",
    reg: { addr: 0x66, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },
  {
    name: "Total Negative Energy CT3",
    units: "kWh",
    reg: { addr: 0x70, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },

  // -------- CT4 --------
  {
    name: "Voltage CT4",
    units: "V",
    reg: { addr: 0x1001, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1
  },
  {
    name: "Current CT4",
    units: "A",
    reg: { addr: 0x1007, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Active Power CT4",
    units: "W",
    reg: { addr: 0x100F, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Reactive Power CT4",
    units: "Var",
    reg: { addr: 0x1017, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Apparent Power CT4",
    units: "VA",
    reg: { addr: 0x101F, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1
  },
  {
    name: "Power Factor CT4",
    units: "",
    reg: { addr: 0x1026, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.001
  },
  {
    name: "Total Positive Energy CT4",
    units: "kWh",
    reg: { addr: 0x103E, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },
  {
    name: "Total Negative Energy CT4",
    units: "kWh",
    reg: { addr: 0x1048, rtype: ModbusController.REGTYPE_HOLDING, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01
  },

  // (CT5 and CT6 omitted for brevity here, but included in downloadable file)
];

// ------------ Update Loop ------------
function update() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    MODBUS_ENDPOINT.readRegisters(
      ent.reg,
      function (data, error) {
        if (typeof error !== "undefined") {
          console.log("Error: " + error.message, error.code);
          return;
        }

        if (typeof data !== "undefined") {
          let value = data * ent.scale;
          console.log(ent.name + ": " + value + "[" + ent.units + "]");
        }
      }
    );
  }
}

// ------------ Init ------------
function init() {
  Timer.set(UPDATE_RATE * 1000, true, update);
}

init();
