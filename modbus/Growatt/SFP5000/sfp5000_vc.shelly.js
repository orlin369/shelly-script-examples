/**
 * @title Growatt SPF5000 MODBUS-RTU monitor + Virtual Components
 * @description Reads the full Growatt SPF5000 off-grid/hybrid register set
 *   (system status, PV, load/output, battery, grid/AC input, temperatures,
 *   BMS) over the native Shelly ModbusController. The 9 most valuable
 *   parameters are published as a self-created, grouped set of Virtual
 *   Components; every other parameter is printed to the console log each
 *   poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/SFP5000/sfp5000_vc.shelly.js
 */

/**
 * Growatt SPF5000 MODBUS-RTU Monitor + Virtual Components
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly Pro devices with RS485 Modbus RTU Add-on.
 * External hardware: Growatt SPF5000 off-grid/hybrid inverter over RS485.
 * Register map based on growatt_register-map-user_1-2026-01-12.json. All
 * registers are input registers.
 *
 * Virtual Components created (9 + 1 group = 10 total):
 * - group:200   Growatt SPF5000
 * - number:200  System Status
 * - number:201  Battery SOC, %
 * - number:202  Battery Voltage, V
 * - number:203  Battery Power, W (positive = discharge, negative = charge)
 * - number:204  PV1 Power, W
 * - number:205  PV2 Power, W
 * - number:206  Output Power, W
 * - number:207  AC Input Voltage, V
 * - number:208  Inverter Temperature, C
 *
 * Every other register in the full entity table (Buck converter detail,
 * bus voltages, fault/warning codes, energy counters, BMS detail, fan
 * speeds, ...) is read and printed to the console log every poll, but is
 * not backed by a Virtual Component. Adjust VC_KEYS below to change the
 * selection.
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

var UPDATE_RATE = 5; // seconds
var DEVICE_ID = 1;

var MODBUS_ENDPOINT = ModbusController.get(DEVICE_ID, { baud: 9600, mode: '8N1' });

// Logical keys of the 9 parameters promoted to Virtual Components below.
var VC_KEYS = {
  systemStatus: true,
  batterySoc: true,
  batteryVoltage: true,
  batteryPower: true,
  pv1Power: true,
  pv2Power: true,
  outputPower: true,
  acInputVoltage: true,
  inverterTemperature: true
};

// Full Growatt SPF5000 register catalog (input registers throughout).
var ENTITIES = [
  { name: 'System Status', units: '', vcKey: 'systemStatus', reg: { addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  { name: 'PV1 Voltage', units: 'V', reg: { addr: 1, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Voltage', units: 'V', reg: { addr: 2, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV1 Power', units: 'W', vcKey: 'pv1Power', reg: { addr: 3, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Power', units: 'W', vcKey: 'pv2Power', reg: { addr: 5, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Buck1 Current', units: 'A', reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Buck2 Current', units: 'A', reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Output Power', units: 'W', vcKey: 'outputPower', reg: { addr: 9, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Output VA', units: 'VA', reg: { addr: 11, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Charge Power', units: 'W', reg: { addr: 13, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Charge VA', units: 'VA', reg: { addr: 15, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Battery Voltage', units: 'V', vcKey: 'batteryVoltage', reg: { addr: 17, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery SOC', units: '%', vcKey: 'batterySoc', reg: { addr: 18, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Bus Voltage', units: 'V', reg: { addr: 19, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'AC Input Voltage', units: 'V', vcKey: 'acInputVoltage', reg: { addr: 20, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Input Frequency', units: 'Hz', reg: { addr: 21, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Output Voltage', units: 'V', reg: { addr: 22, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Output Frequency', units: 'Hz', reg: { addr: 23, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Output DC Voltage', units: 'V', reg: { addr: 24, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Inverter Temperature', units: 'C', vcKey: 'inverterTemperature', reg: { addr: 25, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'DC-DC Temperature', units: 'C', reg: { addr: 26, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Load Percent', units: '%', reg: { addr: 27, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Port Voltage', units: 'V', reg: { addr: 28, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery Bus Voltage', units: 'V', reg: { addr: 29, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Work Time Total', units: 's', reg: { addr: 30, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.5 },
  { name: 'Buck1 Temperature', units: 'C', reg: { addr: 32, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Buck2 Temperature', units: 'C', reg: { addr: 33, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Output Current', units: 'A', reg: { addr: 34, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Inverter Current', units: 'A', reg: { addr: 35, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Input Power', units: 'W', reg: { addr: 36, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Input VA', units: 'VA', reg: { addr: 38, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Fault Code', units: '', reg: { addr: 40, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Warning Code', units: '', reg: { addr: 42, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  { name: 'PV1 Energy Today', units: 'kWh', reg: { addr: 48, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV1 Energy Total', units: 'kWh', reg: { addr: 50, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Energy Today', units: 'kWh', reg: { addr: 52, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Energy Total', units: 'kWh', reg: { addr: 54, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Charge Energy Today', units: 'kWh', reg: { addr: 56, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Charge Energy Total', units: 'kWh', reg: { addr: 58, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Discharge Today', units: 'kWh', reg: { addr: 60, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Discharge Total', units: 'kWh', reg: { addr: 62, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Discharge Energy Today', units: 'kWh', reg: { addr: 64, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Discharge Energy Total', units: 'kWh', reg: { addr: 66, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Charge Current', units: 'A', reg: { addr: 68, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Discharge Power', units: 'W', reg: { addr: 69, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Discharge VA', units: 'VA', reg: { addr: 71, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Discharge Power', units: 'W', reg: { addr: 73, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Discharge VA', units: 'VA', reg: { addr: 75, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Power', units: 'W', vcKey: 'batteryPower', reg: { addr: 77, rtype: ModbusController.REGTYPE_INPUT, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Over Charge', units: '', reg: { addr: 80, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'MPPT Fan Speed', units: '%', reg: { addr: 81, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Inverter Fan Speed', units: '%', reg: { addr: 82, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  { name: 'BMS Status', units: '', reg: { addr: 90, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS Error', units: '', reg: { addr: 91, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS Warning', units: '', reg: { addr: 92, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS SOC', units: '%', reg: { addr: 93, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS Battery Voltage', units: 'V', reg: { addr: 94, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS Battery Current', units: 'A', reg: { addr: 95, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS Battery Temp', units: 'C', reg: { addr: 96, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS Max Current', units: 'A', reg: { addr: 97, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS CV Voltage', units: 'V', reg: { addr: 98, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 }
];

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function vcComponentSpec(id, entity) {
  return {
    key: entity.vcKey,
    type: 'number',
    id: id,
    config: {
      name: entity.name,
      default_value: 0,
      unit: entity.units,
      persisted: false,
      meta: { ui: { view: 'label' }, cloud: ['measurement'] }
    }
  };
}

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var nextId = 200;
  var i;
  var entity;

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    if (!entity.vcKey || !VC_KEYS[entity.vcKey]) continue;

    components.push(vcComponentSpec(nextId, entity));
    groupMembers.push(entity.vcKey);
    nextId += 1;
  }

  return {
    components: components,
    groups: [
      { id: 200, name: 'Growatt SPF5000', components: groupMembers }
    ]
  };
}

var VIRTUAL_COMPONENTS = buildVirtualComponentsManifest();

// ============================================================================
// STATE
// ============================================================================

var vcHandles = null;

// ============================================================================
// MAIN LOGIC
// ============================================================================

function update() {
  var i;
  var ent;
  var raw;
  var value;

  for (i = 0; i < ENTITIES.length; i++) {
    ent = ENTITIES[i];

    ent.handle.readOnce();
    raw = ent.handle.getValue();
    value = raw * ent.scale;

    console.log(ent.name + ': ' + value + ' [' + ent.units + ']');

    if (ent.vcKey && vcHandles && vcHandles[ent.vcKey]) {
      vcHandles[ent.vcKey].setValue(value);
    }
  }
}

function registerEntities() {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    ENTITIES[i].handle = MODBUS_ENDPOINT.addEntity(ENTITIES[i].reg);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  print('Growatt SPF5000 MODBUS-RTU monitor + VC');

  registerEntities();

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      print('ERROR: Virtual component setup failed');
      return;
    }

    vcHandles = readyVc.handles;
    print('Ready; polling every ' + UPDATE_RATE + 's, ' + ENTITIES.length + ' parameters (' +
      VIRTUAL_COMPONENTS.components.length + ' on Virtual Components)');

    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

main();
