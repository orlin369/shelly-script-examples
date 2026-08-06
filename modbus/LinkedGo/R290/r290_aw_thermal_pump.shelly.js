/**
 * @title LinkedGo R290 A/W Thermal Pump MODBUS example
 * @description MODBUS-RTU polling and basic control example for LinkedGo
 *   R290 air-to-water thermal pumps over RS485 using the native Shelly
 *   ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LinkedGo/R290/r290_aw_thermal_pump.shelly.js
 */

/**
 * LinkedGo R290 A/W Thermal Pump - MODBUS RTU Example
 *
 * Source protocol file:
 *   R290 A_W modbus protocol.xlsx
 *
 * Transport defaults from protocol:
 *   - Baud rate: 9600
 *   - Framing: 8N1
 *   - Slave ID: 0x10 (decimal 16)
 *
 * The protocol document labels function usage as "03/16" for many holding
 * registers (read/write). This script reads with FC03 and writes with FC06
 * (single register), which is typically accepted for single-word settings.
 *
 * Data type notes from protocol:
 *   - Temperature values are signed 16-bit with 0.1 degC scale
 *   - Value 32767 indicates sensor failure
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Example API calls from this script console:
 *   setPower(true);        // register 1011
 *   setMode(1);            // register 1012 (1=heating)
 *   setHotWaterTarget(50); // register 1157
 *   setHeatingTarget(42);  // register 1158
 *   setCoolingTarget(10);  // register 1159
 */

// Update rate (sec)
var UPDATE_RATE = 12;

// Get a MODBUS-RTU endpoint: ID 16, baud rate 9600, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(16, { baud: 9600, mode: "8N1" });

let ENTITIES = [
  // Read/write control registers
  { key: "SYSTEM_STATE", name: "System State", units: "", reg: { addr: 1011, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "RW" },
  { key: "MODE", name: "Mode", units: "", reg: { addr: 1012, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "RW" },
  { key: "HOT_WATER_TARGET", name: "Hot Water Target", units: "degC", reg: { addr: 1157, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "RW" },
  { key: "HEATING_TARGET", name: "Heating Target", units: "degC", reg: { addr: 1158, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "RW" },
  { key: "COOLING_TARGET", name: "Cooling Target", units: "degC", reg: { addr: 1159, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "RW" },

  // Read-only status registers
  { key: "RUNNING_MODE", name: "Running Mode", units: "", reg: { addr: 2012, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "LOAD_OUTPUT", name: "Load Output Bitmask", units: "", reg: { addr: 2019, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "SWITCH_STATE", name: "Switch State Bitmask", units: "", reg: { addr: 2034, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },

  { key: "HEAT_RETURN_TEMP", name: "Heating Return Water Temp", units: "degC", reg: { addr: 2035, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "HEAT_OUTLET_TEMP", name: "Heating Outlet Water Temp", units: "degC", reg: { addr: 2036, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "INLET_WATER_TEMP", name: "Inlet Water Temp", units: "degC", reg: { addr: 2045, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "OUTLET_WATER_TEMP", name: "Outlet Water Temp", units: "degC", reg: { addr: 2046, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "DHW_TANK_TEMP", name: "DHW Tank Water Temp", units: "degC", reg: { addr: 2047, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "AMBIENT_TEMP", name: "Ambient Temp", units: "degC", reg: { addr: 2048, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "COIL_TEMP", name: "Coil Temp", units: "degC", reg: { addr: 2049, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "SUCTION_TEMP", name: "Suction Temp", units: "degC", reg: { addr: 2051, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "DISCHARGE_TEMP", name: "Discharge Temp", units: "degC", reg: { addr: 2053, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "ANTI_FREEZE_TEMP", name: "Anti-Freeze Temp", units: "degC", reg: { addr: 2055, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },
  { key: "ROOM_TEMP", name: "Room Temp", units: "degC", reg: { addr: 2058, rtype: ModbusController.REGTYPE_HOLDING, itype: "i16" }, scale: 0.1, rights: "R" },

  { key: "COMPRESSOR_FREQ_SET", name: "Compressor Frequency Set", units: "Hz", reg: { addr: 2071, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "COMPRESSOR_FREQ_RUN", name: "Compressor Frequency Running", units: "Hz", reg: { addr: 2072, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "DC_FAN1_SPEED", name: "DC Fan 1 Speed", units: "rpm", reg: { addr: 2074, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "DC_FAN2_SPEED", name: "DC Fan 2 Speed", units: "rpm", reg: { addr: 2075, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "WATER_FLOW", name: "Water Flow", units: "raw", reg: { addr: 2077, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },

  { key: "FAILURE_1", name: "Failure 1 Bitmask", units: "", reg: { addr: 2085, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_2", name: "Failure 2 Bitmask", units: "", reg: { addr: 2086, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_3", name: "Failure 3 Bitmask", units: "", reg: { addr: 2087, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_4", name: "Failure 4 Bitmask", units: "", reg: { addr: 2088, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_5", name: "Failure 5 Bitmask", units: "", reg: { addr: 2089, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_6", name: "Failure 6 Bitmask", units: "", reg: { addr: 2090, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_7", name: "Failure 7 Bitmask", units: "", reg: { addr: 2081, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_8", name: "Failure 8 Bitmask", units: "", reg: { addr: 2082, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" },
  { key: "FAILURE_9", name: "Failure 9 Bitmask", units: "", reg: { addr: 2083, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, scale: 1, rights: "R" }
];

var REG = {};
(function buildRegLookup() {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    REG[ENTITIES[i].key] = ENTITIES[i].reg.addr;
  }
})();

function findEntityByKey(key) {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    if (ENTITIES[i].key === key) return ENTITIES[i];
  }
  return null;
}

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

// ============================================================================
// PUBLIC CONTROL HELPERS (call from the Shelly script console)
// ============================================================================

function setPower(isOn) {
  MODBUS_ENDPOINT.writeRegisters({ addr: REG.SYSTEM_STATE, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [isOn ? 1 : 0], function(success, error) {
    if (success) console.log("setPower OK -> " + (isOn ? "ON" : "OFF"));
    else console.log("setPower failed: " + error);
  });
}

function setMode(modeValue) {
  MODBUS_ENDPOINT.writeRegisters({ addr: REG.MODE, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [modeValue], function(success, error) {
    if (success) console.log("setMode OK -> " + modeValue);
    else console.log("setMode failed: " + error);
  });
}

function setHotWaterTarget(tempDegC) {
  MODBUS_ENDPOINT.writeRegisters({ addr: REG.HOT_WATER_TARGET, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [tempDegC], function(success, error) {
    if (success) console.log("setHotWaterTarget OK -> " + tempDegC + " degC");
    else console.log("setHotWaterTarget failed: " + error);
  });
}

function setHeatingTarget(tempDegC) {
  MODBUS_ENDPOINT.writeRegisters({ addr: REG.HEATING_TARGET, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [tempDegC], function(success, error) {
    if (success) console.log("setHeatingTarget OK -> " + tempDegC + " degC");
    else console.log("setHeatingTarget failed: " + error);
  });
}

function setCoolingTarget(tempDegC) {
  MODBUS_ENDPOINT.writeRegisters({ addr: REG.COOLING_TARGET, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" }, [tempDegC], function(success, error) {
    if (success) console.log("setCoolingTarget OK -> " + tempDegC + " degC");
    else console.log("setCoolingTarget failed: " + error);
  });
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  var i;
  var raw;
  var value;

  for (i = 0; i < ENTITIES.length; i++) {
    raw = ENTITIES[i].entity.getValue();

    if (ENTITIES[i].reg.itype === "i16" && raw === 32767) {
      console.log(ENTITIES[i].name + ": SENSOR_ERROR");
      continue;
    }

    value = raw * ENTITIES[i].scale;
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
