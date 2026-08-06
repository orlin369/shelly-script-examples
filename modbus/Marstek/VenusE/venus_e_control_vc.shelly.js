/**
 * @title Marstek VenusE charge/discharge control + Virtual Components
 * @description Monitors Marstek VenusE SOC, power, and operating state using
 *   the native Shelly ModbusController, and provides guarded Virtual
 *   Component controls for charge, stop, and discharge.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_control_vc.shelly.js
 */

/**
 * Marstek VenusE Charge/Discharge Control + Virtual Components
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Components created (8 total):
 * - group:220   Marstek VenusE Control
 * - number:220  Battery SOC, 0..100 %
 * - number:221  Battery Power, -2500..2500 W
 * - number:222  Inverter State, 0..6
 * - number:223  Control Power, 100..2500 W (persisted)
 * - button:220  Force Charge
 * - button:221  Stop
 * - button:222  Discharge
 *
 * Control sequence:
 * - Force Charge: write 0x55AA to 42000, power to 42020, then 1 to 42010.
 * - Stop: write 0 to 42010.
 * - Discharge: write 0x55AA to 42000, power to 42021, then 2 to 42010.
 *
 * Safety:
 * - Default control power is 500 W.
 * - Control power is clamped to 100..2500 W before every command.
 * - Only one control sequence runs at a time (a queued mode waits for the
 *   current sequence to finish).
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

var CONFIG = {
  INTER_REQUEST_DELAY: 100,
  POLL_INTERVAL: 5000,
  DEFAULT_POWER: 500,
  MIN_POWER: 100,
  MAX_POWER: 2500
};

var REG = {
  SOC: { addr: 32104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE },
  BATTERY_POWER: { addr: 32102, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE },
  INVERTER_STATE: { addr: 35100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE },
  RS485_CONTROL: { addr: 42000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  CONTROL_COMMAND: { addr: 42010, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  CHARGE_POWER: { addr: 42020, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
  DISCHARGE_POWER: { addr: 42021, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' }
};

var COMPONENTS = {
  soc: 'soc',
  batteryPower: 'batteryPower',
  inverterState: 'inverterState',
  controlPower: 'controlPower',
  forceCharge: 'button:220',
  stop: 'button:221',
  discharge: 'button:222'
};

// Get a MODBUS-RTU endpoint: ID 1, baud rate 115200, 8N1.
var MODBUS_ENDPOINT = ModbusController.get(1, { baud: 115200, mode: '8N1' });

var TELEMETRY = [
  { key: 'soc', name: 'Battery SOC', units: '%', reg: REG.SOC, scale: 1 },
  { key: 'batteryPower', name: 'Battery Power', units: 'W', reg: REG.BATTERY_POWER, scale: 1 },
  { key: 'inverterState', name: 'Inverter State', units: '', reg: REG.INVERTER_STATE, scale: 1 }
];

function stateName(raw) {
  if (raw === 0) return 'sleep';
  if (raw === 1) return 'standby';
  if (raw === 2) return 'charge';
  if (raw === 3) return 'discharge';
  if (raw === 4) return 'backup mode';
  if (raw === 5) return 'OTA upgrade';
  if (raw === 6) return 'bypass';
  return 'unknown';
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function numberConfig(name, min, max, unit, defaultValue, persisted, view) {
  return {
    name: name,
    min: min,
    max: max,
    unit: unit,
    default_value: defaultValue,
    persisted: !!persisted,
    meta: { ui: { view: view || 'label' }, cloud: ['measurement'] }
  };
}

function buttonConfig(name, icon) {
  return {
    name: name,
    meta: { ui: { view: 'button', icon: icon } }
  };
}

var VIRTUAL_COMPONENTS = {
  components: [
    { key: 'soc', type: 'number', id: 220, config: numberConfig('Battery SOC', 0, 100, '%', 0, false, 'progressbar') },
    { key: 'batteryPower', type: 'number', id: 221, config: numberConfig('Battery Power', -2500, 2500, 'W', 0, false, 'label') },
    { key: 'inverterState', type: 'number', id: 222, config: numberConfig('Inverter State', 0, 6, '', 0, false, 'label') },
    { key: 'controlPower', type: 'number', id: 223, config: numberConfig('Control Power', CONFIG.MIN_POWER, CONFIG.MAX_POWER, 'W', CONFIG.DEFAULT_POWER, true, 'slider') },
    { key: 'forceCharge', type: 'button', id: 220, config: buttonConfig('Force Charge', 'mdi:battery-charging') },
    { key: 'stop', type: 'button', id: 221, config: buttonConfig('Stop', 'mdi:stop-circle-outline') },
    { key: 'discharge', type: 'button', id: 222, config: buttonConfig('Discharge', 'mdi:battery-arrow-down-outline') }
  ],
  groups: [
    { id: 220, name: 'Marstek VenusE Control', components: ['soc', 'batteryPower', 'inverterState', 'controlPower', 'forceCharge', 'stop', 'discharge'] }
  ]
};

var vcHandles = null;

var state = {
  isControlling: false,
  queuedMode: null,
  controlRetryTimer: null,
  stopRequested: false,
  stopRetryTimer: null,
  pollTimer: null
};

function getControlPower() {
  var value = CONFIG.DEFAULT_POWER;

  if (vcHandles && vcHandles.controlPower) value = Number(vcHandles.controlPower.getValue());
  if (value !== value) value = CONFIG.DEFAULT_POWER;
  value = Math.round(value);
  if (value < CONFIG.MIN_POWER) value = CONFIG.MIN_POWER;
  if (value > CONFIG.MAX_POWER) value = CONFIG.MAX_POWER;

  if (vcHandles && vcHandles.controlPower && vcHandles.controlPower.getValue() !== value) {
    vcHandles.controlPower.setValue(value);
  }

  return value;
}

// ============================================================================
// CONTROL SEQUENCE
// ============================================================================

function finishControl(err, message) {
  state.isControlling = false;

  if (err) {
    console.log('Control error: ' + err);
  } else if (message) {
    console.log(message);
  }

  if (state.stopRequested) {
    state.stopRequested = false;
    stopControl();
    return;
  }

  if (state.queuedMode) {
    var queuedMode = state.queuedMode;
    state.queuedMode = null;
    startControl(queuedMode);
  }
}

function stopControl() {
  if (state.isControlling) {
    state.stopRequested = true;
    return;
  }

  state.isControlling = true;
  MODBUS_ENDPOINT.writeRegisters(REG.CONTROL_COMMAND, [0], function(success, error) {
    finishControl(success ? null : error, 'Charge/discharge stopped');
  });
}

function startControl(mode) {
  var power;
  var powerRegister;
  var command;
  var modeName;

  if (state.isControlling) {
    state.queuedMode = mode;
    console.log(mode + ' queued: waiting for the current control sequence');
    return;
  }

  state.queuedMode = null;
  power = getControlPower();
  powerRegister = mode === 'charge' ? REG.CHARGE_POWER : REG.DISCHARGE_POWER;
  command = mode === 'charge' ? 1 : 2;
  modeName = mode === 'charge' ? 'Charging' : 'Discharging';
  state.isControlling = true;

  MODBUS_ENDPOINT.writeRegisters(REG.RS485_CONTROL, [0x55AA], function(enableSuccess, enableErr) {
    if (!enableSuccess) {
      finishControl('RS485 control enable failed: ' + enableErr, '');
      return;
    }

    Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
      MODBUS_ENDPOINT.writeRegisters(powerRegister, [power], function(powerSuccess, powerErr) {
        if (!powerSuccess) {
          finishControl('Power setting failed: ' + powerErr, '');
          return;
        }

        Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
          MODBUS_ENDPOINT.writeRegisters(REG.CONTROL_COMMAND, [command], function(commandSuccess, commandErr) {
            finishControl(commandSuccess ? null : commandErr, modeName + ' started at ' + power + ' W');
          });
        });
      });
    });
  });
}

function onEvent(event) {
  var action;

  action = event.name;
  if (event.info && event.info.event) action = event.info.event;
  if (action !== 'single_push' && action !== 'push') return;

  if (event.component === COMPONENTS.forceCharge) startControl('charge');
  else if (event.component === COMPONENTS.stop) stopControl();
  else if (event.component === COMPONENTS.discharge) startControl('discharge');
}

// ============================================================================
// TELEMETRY
// ============================================================================

function registerTelemetry(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

function poll() {
  var i;
  var item;
  var raw;
  var value;

  if (state.isControlling) return;

  for (i = 0; i < TELEMETRY.length; i++) {
    item = TELEMETRY[i];
    raw = item.entity.getValue();
    value = raw * item.scale;

    console.log(item.name + ': ' + value + (item.units ? ' [' + item.units + ']' : ''));
    if (item.reg === REG.INVERTER_STATE) {
      console.log('Inverter state: ' + raw + ' (' + stateName(raw) + ')');
    }

    if (vcHandles && vcHandles[item.key]) {
      vcHandles[item.key].setValue(value);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  console.log('Marstek VenusE charge/discharge control + VC');

  registerTelemetry(MODBUS_ENDPOINT, TELEMETRY);
  Shelly.addEventHandler(onEvent);

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }

    vcHandles = readyVc.handles;
    console.log('Ready; default control power is ' + getControlPower() + ' W');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
