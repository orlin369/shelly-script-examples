/**
 * @title JK200 BMS MODBUS-RTU + Virtual Components
 * @description MODBUS-RTU reader for Jikong JK-PB series BMS over RS485
 *   using the native Shelly ModbusController. Self-deploys a Virtual
 *   Components dashboard for the 9 pack-level parameters; all 16 cell
 *   voltages and alarm decoding are printed to the console every poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/JKESS/JK200-MBS/jk200_vc.shelly.js
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

var UPDATE_RATE = 10; // seconds
var CELL_COUNT = 16;

var MODBUS_ENDPOINT = ModbusController.get(1, { baud: 115200, mode: '8N1' });

var CELL_ENTITIES = [];
(function buildCellEntities() {
  var i;
  for (i = 0; i < CELL_COUNT; i++) {
    CELL_ENTITIES.push({
      name: 'Cell ' + (i + 1),
      units: 'mV',
      reg: { addr: 0x1200 + i, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16' },
      scale: 1,
      rights: 'R'
    });
  }
})();

// Pack Voltage/Power/Current use V/W/A (scale 0.001) for VC display,
// matching the mV/mW/mA raw registers.
var MAIN_ENTITIES = [
  { name: 'MOSFET Temperature', units: 'degC', reg: { addr: 0x128A, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { name: 'Pack Voltage', units: 'V', reg: { addr: 0x128D, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: 'R' },
  { name: 'Pack Power', units: 'W', reg: { addr: 0x128F, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: 'R' },
  { name: 'Pack Current', units: 'A', reg: { addr: 0x1291, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: 'R' },
  { name: 'Temperature 1', units: 'degC', reg: { addr: 0x1293, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { name: 'Temperature 2', units: 'degC', reg: { addr: 0x1294, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { name: 'Alarm Bitmask', units: '', reg: { addr: 0x1295, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { name: 'Balance Current', units: 'mA', reg: { addr: 0x1297, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { name: 'State of Charge', units: '%', reg: { addr: 0x1298, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' }
];

var ALARM_LABELS = [
  'Cell undervoltage',
  'Cell overvoltage',
  'Discharge overcurrent',
  'Charge overcurrent',
  'Low temperature (chg)',
  'High temperature (dis)',
  'MOS overtemperature',
  'Short circuit',
  'Cell delta too large',
  'Pack undervoltage',
  'Pack overvoltage',
  'Low SOC'
];

function alarmsText(bitmask) {
  var active = [];
  var b;
  if (bitmask === 0) return 'none';
  for (b = 0; b < ALARM_LABELS.length; b++) {
    if (bitmask & (1 << b)) active.push(ALARM_LABELS[b]);
  }
  if (bitmask & 0x8000) active.push('Manual shutdown');
  return active.join(', ');
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var nextId = 200;
  var i;
  var key;

  for (i = 0; i < MAIN_ENTITIES.length; i++) {
    key = 'p' + i;
    components.push({
      key: key,
      type: 'number',
      id: nextId,
      config: {
        name: MAIN_ENTITIES[i].name,
        default_value: 0,
        unit: MAIN_ENTITIES[i].units,
        persisted: false,
        meta: { ui: { view: 'label' }, cloud: ['measurement'] }
      }
    });
    groupMembers.push(key);
    nextId += 1;
  }

  return {
    components: components,
    groups: [
      { id: 200, name: 'JK200 BMS', components: groupMembers }
    ]
  };
}

var VIRTUAL_COMPONENTS = buildVirtualComponentsManifest();
var vcHandles = null;

// Registers all MODBUS entities from an array.
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function update() {
  var i;
  var value;
  var key;
  var minV = 65535;
  var maxV = 0;
  var minCell = 0;
  var maxCell = 0;
  var v;

  console.log('--- JK200 BMS ---');

  for (i = 0; i < CELL_ENTITIES.length; i++) {
    v = CELL_ENTITIES[i].entity.getValue();
    console.log(CELL_ENTITIES[i].name + ': ' + v + ' [mV]');
    if (v < minV) { minV = v; minCell = i + 1; }
    if (v > maxV) { maxV = v; maxCell = i + 1; }
  }
  console.log('Cell Delta: ' + (maxV - minV) + ' mV (min cell ' + minCell + ', max cell ' + maxCell + ')');

  for (i = 0; i < MAIN_ENTITIES.length; i++) {
    value = MAIN_ENTITIES[i].entity.getValue() * MAIN_ENTITIES[i].scale;

    if (MAIN_ENTITIES[i].name === 'Alarm Bitmask') {
      console.log('Alarms: ' + alarmsText(value));
    } else {
      console.log(MAIN_ENTITIES[i].name + ': ' + value + ' [' + MAIN_ENTITIES[i].units + ']');
    }

    key = 'p' + i;
    if (vcHandles && vcHandles[key]) {
      vcHandles[key].setValue(value);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  registerEntities(MODBUS_ENDPOINT, CELL_ENTITIES);
  registerEntities(MODBUS_ENDPOINT, MAIN_ENTITIES);

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
