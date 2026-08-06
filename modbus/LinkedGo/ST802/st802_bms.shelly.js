/**
 * @title LinkedGo ST802 Thermostat - BMS Modbus RTU Client
 * @description Modbus RTU master that simulates BMS (Building Management System)
 *   commands for the LinkedGo ST802 Youth Smart Thermostat over RS485 using
 *   the native Shelly ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LinkedGo/ST802/st802_bms.shelly.js
 */

/**
 * LinkedGo ST802 Youth Smart Thermostat - BMS Client
 *
 * Communicates via RS485-2 (terminals A2/B2) which defaults to slave mode.
 *
 * Thermostat RS485-2 factory defaults:
 *   P05 = 0  (Slave)
 *   P06 = 3  (9600 baud)
 *   P07 = 1  (LinkedGo protocol 3.0)
 *   P08 = 1  (Slave ID 1)
 *
 * Register map (LinkedGo 3.0, all addresses in hex):
 *
 *   FC 03/06 - Read/Write holding registers:
 *     0x1001 (H00) Power          0=OFF 1=ON
 *     0x1003 (H02) System type    0=2pipe-AC 1=DC-fan 2=floor-only 3=AC+floor 17=4pipe-AC
 *     0x1004 (H03) Operating mode 0=Cooling 3=Dry 4=Heating 5=Floor 7=Ventilation
 *     0x1006 (H05) Heat/cool sel  0=Both 1=CoolOnly 2=HeatOnly
 *     0x1007 (H06) Fan speed      0=Auto 1=Low 2=Medium 3=High 4=Speed4 5=Speed5
 *     0x1008 (H07) Setpoint temp  raw * 0.1 = degC  (step 0.5degC, range H23-H24)
 *     0x1009 (H08) Humidity SP    raw * 0.1 = %   (range 40-75%)
 *     0x1018 (H23) Min setpoint   raw * 0.1 = degC  (default 50 = 5degC)
 *     0x1019 (H24) Max setpoint   raw * 0.1 = degC  (default 500 = 50degC -> clamp to 35degC)
 *
 *   FC 03 - Read only:
 *     0x2101 (O00) Room temp      raw * 0.1 = degC
 *     0x2102 (O01) Humidity       raw * 0.1 = %
 *     0x2103 (O02) Floor temp     raw * 0.1 = degC
 *     0x2110 (O14) Relay status   bitmask (see RELAYS below)
 *     0x211A       Alarm          bit0 = room sensor failure
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var POLL_INTERVAL = 30; // seconds
var CMD_INTERVAL = 60; // seconds

// Set any flag to false to disable that BMS command scenario.
var ENABLE = {
  CMD_MORNING_HEAT: false,
  CMD_COOLING: false,
  CMD_ECONOMY_HEAT: false,
  CMD_VENTILATION: false,
  CMD_DRY: false,
  CMD_FLOOR_HEAT: false,
  CMD_NIGHT_SETBACK: false,
  CMD_STANDBY: false
};

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8N1.
let MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: "8N1" });

let ENTITIES = [
  // --- Control registers (Read / Write, FC 03 / 06) ---
  { key: "POWER", name: "Power", units: "", reg: { addr: 0x1001, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { key: "SYS_TYPE", name: "System Type", units: "", reg: { addr: 0x1003, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { key: "MODE", name: "Operating Mode", units: "", reg: { addr: 0x1004, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { key: "HC_SELECT", name: "Heat/Cool Select", units: "", reg: { addr: 0x1006, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { key: "FAN_SPEED", name: "Fan Speed", units: "", reg: { addr: 0x1007, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { key: "SETPOINT", name: "Setpoint Temp", units: "degC", reg: { addr: 0x1008, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "RW" },
  { key: "HUMIDITY_SP", name: "Humidity Setpoint", units: "%", reg: { addr: 0x1009, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "RW" },
  { key: "MIN_SP", name: "Min Setpoint", units: "degC", reg: { addr: 0x1018, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "RW" },
  { key: "MAX_SP", name: "Max Setpoint", units: "degC", reg: { addr: 0x1019, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "RW" },
  // --- Sensor registers (Read only, FC 03) ---
  { key: "ROOM_TEMP", name: "Room Temperature", units: "degC", reg: { addr: 0x2101, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { key: "HUMIDITY", name: "Humidity", units: "%", reg: { addr: 0x2102, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { key: "FLOOR_TEMP", name: "Floor Temperature", units: "degC", reg: { addr: 0x2103, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R" },
  { key: "RELAY_STATE", name: "Relay Status", units: "", reg: { addr: 0x2110, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { key: "ALARM", name: "Alarm", units: "", reg: { addr: 0x211A, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" }
];

var REG = {};
(function buildRegLookup() {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    REG[ENTITIES[i].key] = ENTITIES[i].reg;
  }
})();

function findEntityByKey(key) {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    if (ENTITIES[i].key === key) return ENTITIES[i];
  }
  return null;
}

/* === ENUMERATION VALUES === */
var POWER = { OFF: 0, ON: 1 };

var MODE = {
  COOLING: 0,
  DRY: 3,
  HEATING: 4,
  FLOOR_HEATING: 5,
  VENTILATION: 7
};

var FAN = {
  AUTO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  SPD4: 4,
  SPD5: 5
};

var HC = { BOTH: 0, COOL_ONLY: 1, HEAT_ONLY: 2 };

/* Relay bitmask positions (O14 / 0x2110) */
var RELAYS = {
  HIGH_SPEED: 0,
  MEDIUM_SPEED: 1,
  LOW_SPEED: 2,
  FAN_COIL_VALVE: 3,
  FLOOR_VALVE: 4,
  DRY_CONTACT: 5
};

function decodeRelayStatus(mask) {
  return {
    highSpeed: !!(mask & (1 << RELAYS.HIGH_SPEED)),
    mediumSpeed: !!(mask & (1 << RELAYS.MEDIUM_SPEED)),
    lowSpeed: !!(mask & (1 << RELAYS.LOW_SPEED)),
    fanCoilValve: !!(mask & (1 << RELAYS.FAN_COIL_VALVE)),
    floorValve: !!(mask & (1 << RELAYS.FLOOR_VALVE)),
    dryContact: !!(mask & (1 << RELAYS.DRY_CONTACT))
  };
}

function modeLabel(v) {
  switch (v) {
    case MODE.COOLING: return "Cooling";
    case MODE.DRY: return "Dry";
    case MODE.HEATING: return "Heating";
    case MODE.FLOOR_HEATING: return "FloorHeating";
    case MODE.VENTILATION: return "Ventilation";
    default: return "Unknown(" + v + ")";
  }
}

function fanLabel(v) {
  switch (v) {
    case FAN.AUTO: return "Auto";
    case FAN.LOW: return "Low";
    case FAN.MEDIUM: return "Medium";
    case FAN.HIGH: return "High";
    case FAN.SPD4: return "Speed4";
    case FAN.SPD5: return "Speed5";
    default: return "Unknown(" + v + ")";
  }
}

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

/* === ST802 CONTROL API (call from the Shelly script console) === */

function setPower(onOff, callback) {
  MODBUS_ENDPOINT.writeRegisters(REG.POWER, [onOff], function(success, error) {
    if (success) {
      console.log("Power set to " + (onOff ? "ON" : "OFF"));
    } else {
      console.log("setPower error: " + error);
    }
    if (callback) callback(success ? null : error, success);
  });
}

function setMode(mode, callback) {
  MODBUS_ENDPOINT.writeRegisters(REG.MODE, [mode], function(success, error) {
    if (success) {
      console.log("Mode set to " + modeLabel(mode));
    } else {
      console.log("setMode error: " + error);
    }
    if (callback) callback(success ? null : error, success);
  });
}

function setFanSpeed(speed, callback) {
  MODBUS_ENDPOINT.writeRegisters(REG.FAN_SPEED, [speed], function(success, error) {
    if (success) {
      console.log("Fan speed set to " + fanLabel(speed));
    } else {
      console.log("setFanSpeed error: " + error);
    }
    if (callback) callback(success ? null : error, success);
  });
}

// degC in 0.5 step -> raw register value.
function tempToRaw(degC) {
  return Math.round(degC * 2) * 5;
}

function setSetpoint(degC, callback) {
  var raw = tempToRaw(degC);
  MODBUS_ENDPOINT.writeRegisters(REG.SETPOINT, [raw], function(success, error) {
    if (success) {
      console.log("Setpoint set to " + degC + "degC (raw " + raw + ")");
    } else {
      console.log("setSetpoint error: " + error);
    }
    if (callback) callback(success ? null : error, success);
  });
}

function setHumiditySetpoint(pct, callback) {
  var raw = pct * 10;
  if (raw < 400) raw = 400;
  if (raw > 750) raw = 750;
  MODBUS_ENDPOINT.writeRegisters(REG.HUMIDITY_SP, [raw], function(success, error) {
    if (success) {
      console.log("Humidity setpoint set to " + pct + "% (raw " + raw + ")");
    } else {
      console.log("setHumiditySetpoint error: " + error);
    }
    if (callback) callback(success ? null : error, success);
  });
}

/* === BMS STATUS POLL === */

function pollStatus() {
  var roomTemp = findEntityByKey("ROOM_TEMP").entity.getValue() * 0.1;
  var humidity = findEntityByKey("HUMIDITY").entity.getValue() * 0.1;
  var floorTemp = findEntityByKey("FLOOR_TEMP").entity.getValue() * 0.1;
  var relays = decodeRelayStatus(findEntityByKey("RELAY_STATE").entity.getValue());
  var alarmMask = findEntityByKey("ALARM").entity.getValue();
  var mode = findEntityByKey("MODE").entity.getValue();
  var fan = findEntityByKey("FAN_SPEED").entity.getValue();

  console.log("--- ST802 status ---");
  console.log("Room: " + roomTemp.toFixed(1) + "degC  Humidity: " + humidity.toFixed(0) + "%  Floor: " + floorTemp.toFixed(1) + "degC");
  console.log("Relays: Hi=" + (relays.highSpeed ? "1" : "0") +
    " Med=" + (relays.mediumSpeed ? "1" : "0") +
    " Lo=" + (relays.lowSpeed ? "1" : "0") +
    " FanValve=" + (relays.fanCoilValve ? "1" : "0") +
    " FloorValve=" + (relays.floorValve ? "1" : "0") +
    " DryContact=" + (relays.dryContact ? "1" : "0"));
  console.log("Alarm: " + ((alarmMask & 0x01) ? "Room sensor failure!" : "OK"));
  console.log("Mode: " + modeLabel(mode));
  console.log("Fan: " + fanLabel(fan));

  // Print remaining entities not covered above.
  console.log("Power: " + (findEntityByKey("POWER").entity.getValue() ? "ON" : "OFF"));
  console.log("System Type: " + findEntityByKey("SYS_TYPE").entity.getValue());
  console.log("Heat/Cool Select: " + findEntityByKey("HC_SELECT").entity.getValue());
  console.log("Setpoint Temp: " + (findEntityByKey("SETPOINT").entity.getValue() * 0.1).toFixed(1) + " degC");
  console.log("Humidity Setpoint: " + (findEntityByKey("HUMIDITY_SP").entity.getValue() * 0.1).toFixed(0) + " %");
  console.log("Min Setpoint: " + (findEntityByKey("MIN_SP").entity.getValue() * 0.1).toFixed(1) + " degC");
  console.log("Max Setpoint: " + (findEntityByKey("MAX_SP").entity.getValue() * 0.1).toFixed(1) + " degC");
}

/* === BMS COMMAND SIMULATION === */

var cmdStep = 0;

var CMD_SCENARIOS = [
  {
    key: "CMD_MORNING_HEAT",
    label: "Morning start - Heating 22degC, Auto fan",
    fn: function() {
      setPower(POWER.ON, function() {
        Timer.set(300, false, function() {
          setMode(MODE.HEATING, function() {
            Timer.set(300, false, function() {
              setSetpoint(22.0, function() {
                Timer.set(300, false, function() {
                  setFanSpeed(FAN.AUTO, null);
                });
              });
            });
          });
        });
      });
    }
  },
  {
    key: "CMD_COOLING",
    label: "Occupied - Cooling 24degC, Medium fan",
    fn: function() {
      setMode(MODE.COOLING, function() {
        Timer.set(300, false, function() {
          setSetpoint(24.0, function() {
            Timer.set(300, false, function() {
              setFanSpeed(FAN.MEDIUM, null);
            });
          });
        });
      });
    }
  },
  {
    key: "CMD_ECONOMY_HEAT",
    label: "Economy - Heating 20degC, Low fan",
    fn: function() {
      setMode(MODE.HEATING, function() {
        Timer.set(300, false, function() {
          setSetpoint(20.0, function() {
            Timer.set(300, false, function() {
              setFanSpeed(FAN.LOW, null);
            });
          });
        });
      });
    }
  },
  {
    key: "CMD_VENTILATION",
    label: "Ventilation only, Auto fan",
    fn: function() {
      setMode(MODE.VENTILATION, function() {
        Timer.set(300, false, function() {
          setFanSpeed(FAN.AUTO, null);
        });
      });
    }
  },
  {
    key: "CMD_DRY",
    label: "Dehumidify (Dry mode) 24degC",
    fn: function() {
      setMode(MODE.DRY, function() {
        Timer.set(300, false, function() {
          setSetpoint(24.0, null);
        });
      });
    }
  },
  {
    key: "CMD_FLOOR_HEAT",
    label: "Floor heating 21degC",
    fn: function() {
      setMode(MODE.FLOOR_HEATING, function() {
        Timer.set(300, false, function() {
          setSetpoint(21.0, null);
        });
      });
    }
  },
  {
    key: "CMD_NIGHT_SETBACK",
    label: "Night setback - Heating 18degC, Low fan",
    fn: function() {
      setMode(MODE.HEATING, function() {
        Timer.set(300, false, function() {
          setSetpoint(18.0, function() {
            Timer.set(300, false, function() {
              setFanSpeed(FAN.LOW, null);
            });
          });
        });
      });
    }
  },
  {
    key: "CMD_STANDBY",
    label: "Standby - Power OFF",
    fn: function() {
      setPower(POWER.OFF, null);
    }
  }
];

function runNextBmsCommand() {
  var total = CMD_SCENARIOS.length;
  var checked = 0;
  var scenario;

  while (checked < total) {
    scenario = CMD_SCENARIOS[cmdStep % total];
    cmdStep++;
    checked++;
    if (ENABLE[scenario.key] === false) continue;
    console.log("Sending BMS command: " + scenario.label);
    scenario.fn();
    return;
  }
  console.log("All command scenarios disabled -- nothing to send.");
}

/* === INITIALIZATION === */

function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);

  console.log("LinkedGo ST802 - BMS Modbus RTU Client");
  console.log("API: setPower(POWER.ON/OFF), setMode(MODE.*), setFanSpeed(FAN.*), setSetpoint(degC), setHumiditySetpoint(pct)");

  // Initial BMS command after 1s
  Timer.set(1000, false, runNextBmsCommand);

  // Periodic status poll
  Timer.set(3000, false, pollStatus);
  Timer.set(POLL_INTERVAL * 1000, true, pollStatus);

  // Periodic BMS command rotation
  Timer.set(CMD_INTERVAL * 1000, true, runNextBmsCommand);
}

// Run the application.
init();
