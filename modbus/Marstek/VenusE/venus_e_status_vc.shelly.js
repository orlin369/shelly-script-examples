/**
 * @title Marstek VenusE status MODBUS-RTU reader + Virtual Components
 * @description Reads Marstek VenusE SOC, charge/discharge limits,
 *   temperatures, daily energy, operating state, and alarm/fault count
 *   using the native Shelly ModbusController, and self-deploys a status-
 *   focused Virtual Components dashboard.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_status_vc.shelly.js
 */

/**
 * Marstek VenusE Status MODBUS-RTU Reader + Virtual Components
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Virtual Components created:
 * - group:220   Marstek VenusE Status
 * - number:220  Battery SOC, 0..100 %
 * - number:221  Charge Current Limit, 0..100 A
 * - number:222  Discharge Current Limit, 0..100 A
 * - number:223  Internal Temperature, -10..55 C
 * - number:224  Max Cell Temperature, -10..80 C
 * - number:225  Daily Charging Energy, 0..100 kWh
 * - number:226  Daily Discharging Energy, 0..100 kWh
 * - number:227  Inverter State, 0..6
 * - number:228  Alarm/Fault Count, 0..45 active bits
 *
 * Important:
 * - This VC variant is read-only. It does not write control registers.
 * - The alarm/fault component is a count of active bits across registers
 *   36000, 36001, 36100, 36101, 36103, and 36104.
 * - This is a different curated dashboard from venus_e_vc.shelly.js (which
 *   focuses on live power flow); this one focuses on operational status.
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

var UPDATE_RATE = 15; // seconds

var MODBUS_ENDPOINT = ModbusController.get(1, { baud: 115200, mode: '8N1' });

var COMPONENT_IDS = {
  group: 220,
  firstNumber: 220
};

var COMPONENTS = [
  { name: 'Battery SOC', reg: { addr: 32104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, unit: '%', min: 0, max: 100 },
  { name: 'Charge Current Limit', reg: { addr: 35111, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, unit: 'A', min: 0, max: 100 },
  { name: 'Discharge Current Limit', reg: { addr: 35112, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, unit: 'A', min: 0, max: 100 },
  { name: 'Internal Temperature', reg: { addr: 35000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, unit: 'C', min: -10, max: 55 },
  { name: 'Max Cell Temperature', reg: { addr: 35010, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, unit: 'C', min: -10, max: 80 },
  { name: 'Daily Charging Energy', reg: { addr: 33004, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, unit: 'kWh', min: 0, max: 100 },
  { name: 'Daily Discharging Energy', reg: { addr: 33006, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01, unit: 'kWh', min: 0, max: 100 },
  { name: 'Inverter State', reg: { addr: 35100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, unit: '', min: 0, max: 6, isState: true },
  { name: 'Alarm/Fault Count', computed: true, scale: 1, unit: '', min: 0, max: 45 }
];

var ALARM_FAULT_REGS = [
  { name: 'Alarm Word 36000', reg: { addr: 36000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } },
  { name: 'Alarm Word 36001', reg: { addr: 36001, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } },
  { name: 'Fault Word 36100', reg: { addr: 36100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } },
  { name: 'Fault Word 36101', reg: { addr: 36101, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } },
  { name: 'Fault Word 36103', reg: { addr: 36103, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } },
  { name: 'Fault Word 36104', reg: { addr: 36104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE } }
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

function countBits(value) {
  var n = value & 0xFFFF;
  var count = 0;

  while (n > 0) {
    if (n & 1) count++;
    n = n >> 1;
  }

  return count;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function numberConfig(component) {
  return {
    name: component.name,
    default_value: 0,
    min: component.min,
    max: component.max,
    meta: {
      ui: {
        view: 'progressbar',
        unit: component.unit,
        step: component.scale < 1 ? component.scale : 1
      },
      cloud: ['measurement']
    }
  };
}

function componentVcKey(index) {
  return 'component' + String(index);
}

function buildVirtualComponentsManifest() {
  var manifest = { components: [] };
  var members = [];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    COMPONENTS[i].vcKey = componentVcKey(i);
    manifest.components.push({
      key: COMPONENTS[i].vcKey,
      type: 'number',
      id: COMPONENT_IDS.firstNumber + i,
      config: numberConfig(COMPONENTS[i])
    });
    members.push(COMPONENTS[i].vcKey);
  }

  manifest.groups = [
    { id: COMPONENT_IDS.group, name: 'Marstek VenusE Status', components: members }
  ];

  return manifest;
}

var VIRTUAL_COMPONENTS = buildVirtualComponentsManifest();
var vcHandles = null;

// ============================================================================
// MAIN LOGIC
// ============================================================================

function update() {
  var i;
  var component;
  var raw;
  var value;
  var alarmFaultCount = 0;

  for (i = 0; i < COMPONENTS.length; i++) {
    component = COMPONENTS[i];
    if (component.computed) continue;

    raw = component.entity.getValue();
    value = raw * component.scale;

    console.log(component.name + ': ' + value + (component.unit ? ' [' + component.unit + ']' : '') + (component.isState ? ' (' + stateName(raw) + ')' : ''));

    if (vcHandles && vcHandles[component.vcKey]) {
      vcHandles[component.vcKey].setValue(value);
    }
  }

  for (i = 0; i < ALARM_FAULT_REGS.length; i++) {
    raw = ALARM_FAULT_REGS[i].entity.getValue();
    alarmFaultCount += countBits(raw);
    if (raw !== 0) console.log(ALARM_FAULT_REGS[i].name + ': 0x' + raw.toString(16));
  }

  console.log('Alarm/Fault Count: ' + alarmFaultCount);
  if (vcHandles && vcHandles[COMPONENTS[8].vcKey]) {
    vcHandles[COMPONENTS[8].vcKey].setValue(alarmFaultCount);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    if (!COMPONENTS[i].computed) {
      COMPONENTS[i].entity = MODBUS_ENDPOINT.addEntity(COMPONENTS[i].reg);
    }
  }
  for (i = 0; i < ALARM_FAULT_REGS.length; i++) {
    ALARM_FAULT_REGS[i].entity = MODBUS_ENDPOINT.addEntity(ALARM_FAULT_REGS[i].reg);
  }

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

init();
