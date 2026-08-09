/**
 * @title WB-MIR v3 MODBUS-RTU + Virtual Components
 * @description MODBUS-RTU reader for Wirenboard WB-MIR v3 IR transceiver and
 *   environment sensor over RS485 using the native Shelly ModbusController.
 *   Self-deploys a Virtual Components dashboard for the 7 most valuable
 *   parameters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-MIR-v-3/wb_mir_v3_vc.shelly.js
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

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

var MIN_SLAVE_ID = 1;
var MAX_SLAVE_ID = 247;
var DEFAULT_SLAVE_ID = 62;
var slaveIdHandle = null;

function getSlaveId() {
  var value = DEFAULT_SLAVE_ID;

  if (slaveIdHandle) value = Number(slaveIdHandle.getValue());
  if (value !== value) value = DEFAULT_SLAVE_ID; // NaN guard
  value = Math.round(value);
  if (value < MIN_SLAVE_ID) value = MIN_SLAVE_ID;
  if (value > MAX_SLAVE_ID) value = MAX_SLAVE_ID;

  if (slaveIdHandle && slaveIdHandle.getValue() !== value) {
    slaveIdHandle.setValue(value);
  }

  return value;
}

// MODBUS-RTU endpoint; rebuilt whenever the slave ID Virtual Component changes.
var MODBUS_ENDPOINT = null;
var MODBUS_ENDPOINT_OPTS = { baud: 9600, mode: '8N2' };

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), MODBUS_ENDPOINT_OPTS);
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
}

var ENTITIES = [
  { key: 'input1w', name: 'Input 1W State', units: '', reg: { addr: 0, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'probeStatus', name: '1-Wire Probe Status', units: '', reg: { addr: 16, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' }, scale: 1, rights: 'R' },
  { key: 'temperature', name: '1-Wire Temperature', units: 'degC', reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: 'R' },
  { key: 'uptime', name: 'Uptime', units: 's', reg: { addr: 104, rtype: ModbusController.REGTYPE_INPUT, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'supply', name: 'Supply Voltage', units: 'V', reg: { addr: 121, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001, rights: 'R' },
  { key: 'minSupply', name: 'Min Supply Voltage', units: 'mV', reg: { addr: 122, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'mcuSupply', name: 'MCU Supply Voltage', units: 'mV', reg: { addr: 123, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'mcuTemp', name: 'MCU Temperature', units: 'degC', reg: { addr: 124, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: 'R' },
  { key: 'irPresent', name: 'IR Transceiver', units: '', reg: { addr: 375, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'owPresent', name: '1-Wire Sensor', units: '', reg: { addr: 376, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'shortPress', name: 'Short Press Counter', units: '', reg: { addr: 464, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'longPress', name: 'Long Press Counter', units: '', reg: { addr: 480, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'doublePress', name: 'Double Press Counter', units: '', reg: { addr: 496, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'slPress', name: 'Short+Long Counter', units: '', reg: { addr: 512, rtype: ModbusController.REGTYPE_INPUT, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'R' },
  { key: 'connLossTimeout', name: 'Conn Loss Timeout', units: 's', reg: { addr: 8, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'sensorPollPeriod', name: 'Sensor Poll Period', units: 's', reg: { addr: 101, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'input1wMode', name: 'Input 1W Mode', units: '', reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'debounceTime', name: 'Debounce Time', units: 'ms', reg: { addr: 340, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'longPressDuration', name: 'Long Press Duration', units: 'ms', reg: { addr: 1100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' },
  { key: 'doublePressWait', name: 'Double Press Wait', units: 'ms', reg: { addr: 1140, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: 'RW' }
];

function findEntityByKey(key) {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    if (ENTITIES[i].key === key) return ENTITIES[i];
  }
  return null;
}

// The 7 most valuable parameters, promoted to Virtual Components.
var VC_KEYS = ['input1w', 'probeStatus', 'temperature', 'supply', 'mcuTemp', 'irPresent', 'owPresent'];

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

  components.push({
    key: 'slaveId',
    type: 'number',
    id: 299,
    config: {
      name: 'Modbus Slave ID',
      min: MIN_SLAVE_ID,
      max: MAX_SLAVE_ID,
      default_value: DEFAULT_SLAVE_ID,
      persisted: true,
      meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
    }
  });
  groupMembers.push('slaveId');

  return {
    components: components,
    groups: [
      { id: 200, name: 'WB-MIR v3', components: groupMembers }
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

  console.log('--- WB-MIR v3 ---');

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    raw = entity.entity.getValue();

    if (entity.key === 'temperature' && raw === 0x7FFF) {
      console.log(entity.name + ': sensor error');
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
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;

    rebuildModbusEndpoint();
    slaveIdHandle.on('change', function() {
      console.log('Modbus Slave ID changed -> ' + getSlaveId());
      rebuildModbusEndpoint();
    });
    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

init();
