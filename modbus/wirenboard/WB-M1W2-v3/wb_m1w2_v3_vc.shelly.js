/**
 * @title WB-M1W2 v3 MODBUS-RTU + Virtual Components
 * @description MODBUS-RTU reader for Wirenboard WB-M1W2 v3 1-Wire to RS-485
 *   converter using the native Shelly ModbusController. Self-deploys a
 *   Virtual Components dashboard for the 9 most valuable parameters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-M1W2-v3/wb_m1w2_v3_vc.shelly.js
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

var MODBUS_ENDPOINT = ModbusController.get(13, { baud: 9600, mode: '8N2' });

var ENTITIES = [
  { key: 'input1', name: 'Input #1 State', units: '', reg: { addr: 0, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'input2', name: 'Input #2 State', units: '', reg: { addr: 1, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'sensor1', name: 'Sensor #1 Status', units: '', reg: { addr: 16, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'sensor2', name: 'Sensor #2 Status', units: '', reg: { addr: 17, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'ntc', name: 'NTC Temperature', units: 'degC', reg: { addr: 6, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: 'R' },
  { key: 'ch1', name: 'Ch1 Temperature', units: 'degC', reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: 'R' },
  { key: 'ch2', name: 'Ch2 Temperature', units: 'degC', reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: 'R' },
  { key: 'supply', name: 'Supply Voltage', units: 'V', reg: { addr: 121, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: 'R' },
  { key: 'counter1', name: 'Counter Ch1', units: '', reg: { addr: 277, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'counter2', name: 'Counter Ch2', units: '', reg: { addr: 278, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'filterThreshold', name: 'Filter Threshold', units: 'degC', reg: { addr: 99, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: 'RW' },
  { key: 'baudRate', name: 'Baud Rate', units: 'bps', reg: { addr: 110, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 100, rights: 'RW' },
  { key: 'parity', name: 'Parity', units: '', reg: { addr: 111, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'stopBits', name: 'Stop Bits', units: '', reg: { addr: 112, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'reset', name: 'Reset', units: '', reg: { addr: 120, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'slaveAddress', name: 'Slave Address', units: '', reg: { addr: 128, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'input1Mode', name: 'Input #1 Mode', units: '', reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'input2Mode', name: 'Input #2 Mode', units: '', reg: { addr: 276, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' }
];

function findEntityByKey(key) {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    if (ENTITIES[i].key === key) return ENTITIES[i];
  }
  return null;
}

// The 9 most valuable parameters, promoted to Virtual Components.
var VC_KEYS = ['input1', 'input2', 'sensor1', 'sensor2', 'ch1', 'ch2', 'supply', 'counter1', 'counter2'];

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
      { id: 200, name: 'WB-M1W2 v3', components: groupMembers }
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

// ============================================================================
// MAIN LOGIC
// ============================================================================

function update() {
  var i;
  var entity;
  var raw;
  var value;

  console.log('--- WB-M1W2 v3 ---');

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    raw = entity.entity.getValue();

    if ((entity.key === 'ch1' || entity.key === 'ch2' || entity.key === 'ntc') && raw === 0x7FFF) {
      console.log(entity.name + ': absent/error');
      continue;
    }

    value = raw * entity.scale;
    console.log(entity.name + ': ' + value + ' [' + entity.units + ']');

    if (vcHandles && vcHandles[entity.key]) {
      vcHandles[entity.key].setValue(value);
    }
  }
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
    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

init();
