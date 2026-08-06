/**
 * @title V-TAC VT-66036103 six-register example
 * @description Reads six currently inferred live holding registers from the
 *   V-TAC VT-66036103 using the native Shelly ModbusController and prints
 *   them to the console every 15 seconds.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_six_register_example.shelly.js
 */

/**
 * V-TAC VT-66036103 Six-Register Example
 *
 * This is a minimal example reader built from current live-testing results.
 * It focuses only on the six most interesting live registers discovered so far:
 * - PV1 voltage
 * - PV2 voltage
 * - input voltage
 * - output voltage
 * - power
 * - frequency
 *
 * Important:
 * - These names and scales are still inferred, not vendor-confirmed.
 * - This script is intended as a compact example, not a final production map.
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

// Update rate (sec)
var UPDATE_RATE = 15;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

let ENTITIES = [
  { name: "PV1 Voltage", units: "V", reg: { addr: 5776, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "PV2 Voltage", units: "V", reg: { addr: 5778, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Input Voltage", units: "V", reg: { addr: 5784, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Output Voltage", units: "V", reg: { addr: 5786, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.1 },
  { name: "Power", units: "W", reg: { addr: 5790, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.01 },
  { name: "Frequency", units: "Hz", reg: { addr: 5792, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 0.01 }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  var i;
  var value;

  console.log("--- V-TAC six-register example ---");

  for (i = 0; i < ENTITIES.length; i++) {
    value = ENTITIES[i].entity.getValue() * ENTITIES[i].scale;
    console.log(ENTITIES[i].name + ": " + value + " [" + ENTITIES[i].units + "]");
  }
}

/*
    Runs once at script start time.
*/
function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
