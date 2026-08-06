/**
 * @title GACIA AICB2SP Smart IoT MCB - MODBUS-RTU reader/controller
 * @description Reads metering data (voltage, current, power, energy, frequency,
 *   power factor, temperature) and controls the breaker switch via native
 *   ModbusController from a GACIA AICB2SP smart circuit breaker.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/GACIA/AICB2SP/aicb2sp.shelly.js
 */

/**
 * GACIA AICB2SP Smart IoT MCB - MODBUS-RTU Client
 *
 * NOTE: No official register map was published by GACIA at the time this
 * script was written. The register addresses below are derived from the
 * KWS-303L / Tuya RS485 smart-breaker reference implementation and are
 * confirmed to work with devices that share the same metering firmware
 * (Tuya HS01-485-WR3 bridge). Verify against the actual device manual if
 * registers do not respond as expected.
 *
 * RS485 parameters (factory defaults):
 *   Baud rate  : 9600
 *   Frame      : 8N1  (try 8E1 if 8N1 does not respond)
 *   Slave ID   : 1
 *
 * Register map (FC 0x03 - Read Holding Registers):
 *
 *   Addr    Parameter        Type   Unit   Scale
 *   ------  ---------------  -----  -----  -------
 *   0x000D  Voltage (live)   INT16  V      0.01
 *   0x0011  Current (live)   INT16  A      0.001
 *   0x0019  Active Power     INT16  W      0.01
 *   0x002F  Power Factor     INT16  -      0.001
 *   0x0032  Frequency        INT16  Hz     0.01
 *   0x0036  Energy Total     INT16  kWh    0.001
 *   0x003B  Temperature      INT16  degC   1
 *
 * Switch control register (FC 0x06 - Write Single Register):
 *   0x003E  Switch ON/OFF    INT16  -      1=ON  0=OFF
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

// Update rate (sec)
var UPDATE_RATE = 10;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

let ENTITIES = [
  { name: "Voltage", units: "V", reg: { addr: 0x000D, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.01, rights: "R" },
  { name: "Current", units: "A", reg: { addr: 0x0011, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.001, rights: "R" },
  { name: "Active Power", units: "W", reg: { addr: 0x0019, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.01, rights: "R" },
  { name: "Power Factor", units: "", reg: { addr: 0x002F, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.001, rights: "R" },
  { name: "Frequency", units: "Hz", reg: { addr: 0x0032, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.01, rights: "R" },
  { name: "Energy Total", units: "kWh", reg: { addr: 0x0036, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.001, rights: "R" },
  { name: "Temperature", units: "degC", reg: { addr: 0x003B, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 1, rights: "R" }
];

var SWITCH_REG = { addr: 0x003E, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" };

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

/**
 * Turn the breaker ON. Call manually from the Shelly script console.
 */
function switchOn() {
  MODBUS_ENDPOINT.writeRegisters(SWITCH_REG, [1], function(success, error) {
    if (success) {
      console.log("Breaker switched ON");
    } else {
      console.log("Switch ON failed: " + error);
    }
  });
}

/**
 * Turn the breaker OFF. Call manually from the Shelly script console.
 */
function switchOff() {
  MODBUS_ENDPOINT.writeRegisters(SWITCH_REG, [0], function(success, error) {
    if (success) {
      console.log("Breaker switched OFF");
    } else {
      console.log("Switch OFF failed: " + error);
    }
  });
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  var i;
  var value;

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
