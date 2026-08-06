/**
 * @title LinkedGo ST802 Thermostat - BMS Modbus RTU + Virtual Components
 * @description Modbus RTU BMS simulation client for the LinkedGo ST802
 *   thermostat using the native Shelly ModbusController. Self-deploys a
 *   Virtual Components dashboard for the 9 most valuable parameters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/LinkedGo/ST802/st802_bms_vc.shelly.js
 */

// ============================================================================
// VIRTUAL COMPONENT STANDARD HELPER
// ============================================================================

function ensureVirtualComponents(manifest, done) {
  var VC_HELPER_DELAY_MS = 150;
  var state = {
    existing: [],
    ids: {},
    keys: {},
    handles: {},
    ok: true
  };

  function log(msg) {
    print('[VC] ' + msg);
  }

  function componentKey(type, id) {
    return type + ':' + String(id);
  }

  function shallowConfigMatches(desired, current) {
    var k;

    if (!desired || !current) return false;

    for (k in desired) {
      if (k === 'meta') {
        if (JSON.stringify(desired.meta) !== JSON.stringify(current.meta || {})) return false;
      } else if (typeof desired[k] === 'object' && desired[k] !== null) {
        if (JSON.stringify(desired[k]) !== JSON.stringify(current[k])) return false;
      } else if (desired[k] !== current[k]) {
        return false;
      }
    }

    return true;
  }

  function normalizeComponent(spec) {
    if (!spec.config) spec.config = {};
    if (!spec.config.name) spec.config.name = spec.key;
    return spec;
  }

  function findExistingByName(type, name) {
    var i;
    var c;

    for (i = 0; i < state.existing.length; i++) {
      c = state.existing[i];
      if (c.type === type && c.name === name) return c;
    }

    return null;
  }

  function remember(spec, id) {
    var key = componentKey(spec.type, id);
    state.ids[spec.key] = id;
    state.keys[spec.key] = key;
    state.handles[spec.key] = Virtual.getHandle(key);
  }

  function getConfig(type, id) {
    return Shelly.getComponentConfig(type, id);
  }

  function deleteComponent(key, cb) {
    Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Delete skipped for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
      }
      Timer.set(VC_HELPER_DELAY_MS, false, cb);
    });
  }

  function addComponent(spec, cb) {
    var params = { type: spec.type, config: spec.config };
    var id;

    if (spec.id !== undefined && spec.id !== null) params.id = spec.id;

    Shelly.call('Virtual.Add', params, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('Virtual.Add failed for ' + spec.key + ': ' + String(errCode) + ' ' + String(errMsg));
        state.ok = false;
        cb(false);
        return;
      }

      id = spec.id;
      if ((id === undefined || id === null) && res && res.id !== undefined) id = res.id;
      if (id === undefined || id === null) {
        log('Virtual.Add did not return id for ' + spec.key);
        state.ok = false;
        cb(false);
        return;
      }

      remember(spec, id);
      log('Created ' + state.keys[spec.key] + ' ' + spec.config.name);
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        cb(true);
      });
    });
  }

  function ensureOne(spec, cb) {
    var current;
    var existing;
    var key;

    spec = normalizeComponent(spec);

    if (spec.id !== undefined && spec.id !== null) {
      current = getConfig(spec.type, spec.id);
      key = componentKey(spec.type, spec.id);

      if (current) {
        if (shallowConfigMatches(spec.config, current)) {
          remember(spec, spec.id);
          cb(true);
          return;
        }

        log('Recreating mismatched ' + key + ' ' + spec.config.name);
        deleteComponent(key, function() {
          addComponent(spec, cb);
        });
        return;
      }

      addComponent(spec, cb);
      return;
    }

    existing = findExistingByName(spec.type, spec.config.name);
    if (existing && shallowConfigMatches(spec.config, existing.config)) {
      remember(spec, existing.id);
      cb(true);
      return;
    }

    if (existing) {
      log('Existing ' + existing.key + ' does not fit ' + spec.config.name + '; creating a new one');
    }
    addComponent(spec, cb);
  }

  function ensureList(index, cb) {
    var list = manifest.components || [];
    if (index >= list.length) {
      cb();
      return;
    }

    ensureOne(list[index], function() {
      Timer.set(VC_HELPER_DELAY_MS, false, function() {
        ensureList(index + 1, cb);
      });
    });
  }

  function createGroupConfig(name) {
    return { name: name, meta: { ui: { view: 'group' } } };
  }

  function groupMembers(group) {
    var members = [];
    var i;
    var logicalKey;

    for (i = 0; i < group.components.length; i++) {
      logicalKey = group.components[i];
      if (state.keys[logicalKey]) members.push(state.keys[logicalKey]);
    }

    return members;
  }

  function ensureGroup(index, cb) {
    var groups = manifest.groups || [];
    var group;
    var cfg;
    var current;
    var key;

    if (index >= groups.length) {
      cb();
      return;
    }

    group = groups[index];
    cfg = createGroupConfig(group.name);
    key = componentKey('group', group.id);
    current = getConfig('group', group.id);

    function setMembersAndContinue() {
      Shelly.call('Group.Set', { id: group.id, value: groupMembers(group) }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state.ok = false;
        }
        Timer.set(VC_HELPER_DELAY_MS, false, function() {
          ensureGroup(index + 1, cb);
        });
      });
    }

    function addGroup() {
      Shelly.call('Virtual.Add', { type: 'group', id: group.id, config: cfg }, function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Virtual.Add group failed for ' + key + ': ' + String(errCode) + ' ' + String(errMsg));
          state.ok = false;
          Timer.set(VC_HELPER_DELAY_MS, false, function() {
            ensureGroup(index + 1, cb);
          });
          return;
        }
        setMembersAndContinue();
      });
    }

    if (current && shallowConfigMatches(cfg, current)) {
      setMembersAndContinue();
      return;
    }

    if (current) {
      deleteComponent(key, addGroup);
    } else {
      addGroup();
    }
  }

  function readExistingPage(offset, cb) {
    Shelly.call('Shelly.GetComponents', { dynamic_only: true, offset: offset }, function(res, errCode, errMsg) {
      var raw;
      var total;
      var i;
      var c;
      var cfg;
      var keyParts;

      if (errCode !== 0) {
        log('Shelly.GetComponents failed: ' + String(errCode) + ' ' + String(errMsg));
        state.ok = false;
        cb();
        return;
      }

      raw = (res && res.components) ? res.components : [];
      total = res ? (res.total || raw.length) : raw.length;

      for (i = 0; i < raw.length; i++) {
        c = raw[i];
        cfg = c.config || {};
        keyParts = (c.key || '').split(':');
        state.existing.push({
          key: c.key || componentKey(c.type || keyParts[0], cfg.id),
          type: c.type || keyParts[0],
          id: cfg.id,
          name: cfg.name,
          config: cfg
        });
      }

      if (offset + raw.length < total && raw.length > 0) {
        readExistingPage(offset + raw.length, cb);
      } else {
        cb();
      }
    });
  }

  readExistingPage(0, function() {
    ensureList(0, function() {
      ensureGroup(0, function() {
        done(state.ok, {
          ids: state.ids,
          keys: state.keys,
          handles: state.handles
        });
      });
    });
  });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

var POLL_INTERVAL = 30; // seconds
var CMD_INTERVAL = 60; // seconds

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

var MODBUS_ENDPOINT = ModbusController.get(1, { baud: 9600, mode: '8N1' });

var ENTITIES = [
  { key: 'POWER', name: 'Power', units: '', reg: { addr: 0x1001, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'SYS_TYPE', name: 'System Type', units: '', reg: { addr: 0x1003, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'MODE', name: 'Operating Mode', units: '', reg: { addr: 0x1004, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'HC_SELECT', name: 'Heat/Cool Select', units: '', reg: { addr: 0x1006, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'FAN_SPEED', name: 'Fan Speed', units: '', reg: { addr: 0x1007, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'SETPOINT', name: 'Setpoint Temp', units: 'degC', reg: { addr: 0x1008, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'RW' },
  { key: 'HUMIDITY_SP', name: 'Humidity Setpoint', units: '%', reg: { addr: 0x1009, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'RW' },
  { key: 'MIN_SP', name: 'Min Setpoint', units: 'degC', reg: { addr: 0x1018, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'RW' },
  { key: 'MAX_SP', name: 'Max Setpoint', units: 'degC', reg: { addr: 0x1019, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'RW' },
  { key: 'ROOM_TEMP', name: 'Room Temperature', units: 'degC', reg: { addr: 0x2101, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { key: 'HUMIDITY', name: 'Humidity', units: '%', reg: { addr: 0x2102, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { key: 'FLOOR_TEMP', name: 'Floor Temperature', units: 'degC', reg: { addr: 0x2103, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { key: 'RELAY_STATE', name: 'Relay Status', units: '', reg: { addr: 0x2110, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'ALARM', name: 'Alarm', units: '', reg: { addr: 0x211A, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' }
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

// The 9 most valuable parameters, promoted to Virtual Components.
var VC_KEYS = ['ROOM_TEMP', 'HUMIDITY', 'FLOOR_TEMP', 'RELAY_STATE', 'ALARM', 'MODE', 'FAN_SPEED', 'SETPOINT', 'POWER'];

var POWER = { OFF: 0, ON: 1 };
var MODE = { COOLING: 0, DRY: 3, HEATING: 4, FLOOR_HEATING: 5, VENTILATION: 7 };
var FAN = { AUTO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, SPD4: 4, SPD5: 5 };
var HC = { BOTH: 0, COOL_ONLY: 1, HEAT_ONLY: 2 };

var RELAYS = { HIGH_SPEED: 0, MEDIUM_SPEED: 1, LOW_SPEED: 2, FAN_COIL_VALVE: 3, FLOOR_VALVE: 4, DRY_CONTACT: 5 };

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
    case MODE.COOLING: return 'Cooling';
    case MODE.DRY: return 'Dry';
    case MODE.HEATING: return 'Heating';
    case MODE.FLOOR_HEATING: return 'FloorHeating';
    case MODE.VENTILATION: return 'Ventilation';
    default: return 'Unknown(' + v + ')';
  }
}

function fanLabel(v) {
  switch (v) {
    case FAN.AUTO: return 'Auto';
    case FAN.LOW: return 'Low';
    case FAN.MEDIUM: return 'Medium';
    case FAN.HIGH: return 'High';
    case FAN.SPD4: return 'Speed4';
    case FAN.SPD5: return 'Speed5';
    default: return 'Unknown(' + v + ')';
  }
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var nextId = 200;
  var i;
  var entity;

  for (i = 0; i < VC_KEYS.length; i++) {
    entity = findEntityByKey(VC_KEYS[i]);
    components.push({
      key: entity.key,
      type: 'number',
      id: nextId,
      config: {
        name: entity.name,
        default_value: 0,
        unit: entity.units,
        persisted: false,
        meta: { ui: { view: 'label' }, cloud: ['measurement'] }
      }
    });
    groupMembers.push(entity.key);
    nextId += 1;
  }

  return {
    components: components,
    groups: [
      { id: 200, name: 'LinkedGo ST802 Thermostat', components: groupMembers }
    ]
  };
}

var VIRTUAL_COMPONENTS = buildVirtualComponentsManifest();
var vcHandles = null;

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
    if (success) console.log('Power set to ' + (onOff ? 'ON' : 'OFF'));
    else console.log('setPower error: ' + error);
    if (callback) callback(success ? null : error, success);
  });
}

function setMode(mode, callback) {
  MODBUS_ENDPOINT.writeRegisters(REG.MODE, [mode], function(success, error) {
    if (success) console.log('Mode set to ' + modeLabel(mode));
    else console.log('setMode error: ' + error);
    if (callback) callback(success ? null : error, success);
  });
}

function setFanSpeed(speed, callback) {
  MODBUS_ENDPOINT.writeRegisters(REG.FAN_SPEED, [speed], function(success, error) {
    if (success) console.log('Fan speed set to ' + fanLabel(speed));
    else console.log('setFanSpeed error: ' + error);
    if (callback) callback(success ? null : error, success);
  });
}

function tempToRaw(degC) {
  return Math.round(degC * 2) * 5;
}

function setSetpoint(degC, callback) {
  var raw = tempToRaw(degC);
  MODBUS_ENDPOINT.writeRegisters(REG.SETPOINT, [raw], function(success, error) {
    if (success) console.log('Setpoint set to ' + degC + 'degC (raw ' + raw + ')');
    else console.log('setSetpoint error: ' + error);
    if (callback) callback(success ? null : error, success);
  });
}

function setHumiditySetpoint(pct, callback) {
  var raw = pct * 10;
  if (raw < 400) raw = 400;
  if (raw > 750) raw = 750;
  MODBUS_ENDPOINT.writeRegisters(REG.HUMIDITY_SP, [raw], function(success, error) {
    if (success) console.log('Humidity setpoint set to ' + pct + '% (raw ' + raw + ')');
    else console.log('setHumiditySetpoint error: ' + error);
    if (callback) callback(success ? null : error, success);
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function pollStatus() {
  var i;
  var entity;
  var value;

  console.log('--- ST802 status ---');

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    value = entity.entity.getValue() * entity.scale;

    if (entity.key === 'RELAY_STATE') {
      var relays = decodeRelayStatus(entity.entity.getValue());
      console.log('Relays: Hi=' + (relays.highSpeed ? '1' : '0') +
        ' Med=' + (relays.mediumSpeed ? '1' : '0') +
        ' Lo=' + (relays.lowSpeed ? '1' : '0') +
        ' FanValve=' + (relays.fanCoilValve ? '1' : '0') +
        ' FloorValve=' + (relays.floorValve ? '1' : '0') +
        ' DryContact=' + (relays.dryContact ? '1' : '0'));
    } else if (entity.key === 'ALARM') {
      console.log('Alarm: ' + ((entity.entity.getValue() & 0x01) ? 'Room sensor failure!' : 'OK'));
    } else if (entity.key === 'MODE') {
      console.log('Mode: ' + modeLabel(value));
    } else if (entity.key === 'FAN_SPEED') {
      console.log('Fan: ' + fanLabel(value));
    } else if (entity.key === 'POWER') {
      console.log('Power: ' + (value ? 'ON' : 'OFF'));
    } else {
      console.log(entity.name + ': ' + value + ' [' + entity.units + ']');
    }

    if (vcHandles && vcHandles[entity.key]) {
      vcHandles[entity.key].setValue(value);
    }
  }
}

/* === BMS COMMAND SIMULATION === */

var cmdStep = 0;

var CMD_SCENARIOS = [
  { key: 'CMD_MORNING_HEAT', label: 'Morning start - Heating 22degC, Auto fan', fn: function() {
    setPower(POWER.ON, function() {
      Timer.set(300, false, function() {
        setMode(MODE.HEATING, function() {
          Timer.set(300, false, function() {
            setSetpoint(22.0, function() {
              Timer.set(300, false, function() { setFanSpeed(FAN.AUTO, null); });
            });
          });
        });
      });
    });
  } },
  { key: 'CMD_COOLING', label: 'Occupied - Cooling 24degC, Medium fan', fn: function() {
    setMode(MODE.COOLING, function() {
      Timer.set(300, false, function() {
        setSetpoint(24.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.MEDIUM, null); });
        });
      });
    });
  } },
  { key: 'CMD_ECONOMY_HEAT', label: 'Economy - Heating 20degC, Low fan', fn: function() {
    setMode(MODE.HEATING, function() {
      Timer.set(300, false, function() {
        setSetpoint(20.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.LOW, null); });
        });
      });
    });
  } },
  { key: 'CMD_VENTILATION', label: 'Ventilation only, Auto fan', fn: function() {
    setMode(MODE.VENTILATION, function() {
      Timer.set(300, false, function() { setFanSpeed(FAN.AUTO, null); });
    });
  } },
  { key: 'CMD_DRY', label: 'Dehumidify (Dry mode) 24degC', fn: function() {
    setMode(MODE.DRY, function() {
      Timer.set(300, false, function() { setSetpoint(24.0, null); });
    });
  } },
  { key: 'CMD_FLOOR_HEAT', label: 'Floor heating 21degC', fn: function() {
    setMode(MODE.FLOOR_HEATING, function() {
      Timer.set(300, false, function() { setSetpoint(21.0, null); });
    });
  } },
  { key: 'CMD_NIGHT_SETBACK', label: 'Night setback - Heating 18degC, Low fan', fn: function() {
    setMode(MODE.HEATING, function() {
      Timer.set(300, false, function() {
        setSetpoint(18.0, function() {
          Timer.set(300, false, function() { setFanSpeed(FAN.LOW, null); });
        });
      });
    });
  } },
  { key: 'CMD_STANDBY', label: 'Standby - Power OFF', fn: function() {
    setPower(POWER.OFF, null);
  } }
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
    console.log('Sending BMS command: ' + scenario.label);
    scenario.fn();
    return;
  }
  console.log('All command scenarios disabled -- nothing to send.');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  registerEntities(MODBUS_ENDPOINT, ENTITIES);

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;

    // Initial BMS command after 1s
    Timer.set(1000, false, runNextBmsCommand);

    // Periodic status poll
    Timer.set(3000, false, pollStatus);
    Timer.set(POLL_INTERVAL * 1000, true, pollStatus);

    // Periodic BMS command rotation
    Timer.set(CMD_INTERVAL * 1000, true, runNextBmsCommand);
  });
}

init();
