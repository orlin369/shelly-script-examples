/**
 * @title Marstek VenusE MODBUS-RTU + Virtual Components
 * @description Reads live battery, AC, energy, temperature, state, alarm, and
 *   limit registers from a Marstek VenusE device over MODBUS-RTU using the
 *   native Shelly ModbusController. Self-deploys a Virtual Components
 *   dashboard for the 9 most valuable parameters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Marstek/VenusE/venus_e_vc.shelly.js
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
var DEFAULT_SLAVE_ID = 1;
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
var MODBUS_ENDPOINT_OPTS = { baud: 115200, mode: '8N1' };

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), MODBUS_ENDPOINT_OPTS);
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
}

var ENTITIES = [
  { name: 'Battery Voltage', units: 'V', reg: { addr: 32100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery Current', units: 'A', reg: { addr: 32101, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery Power', units: 'W', reg: { addr: 32102, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery SOC', units: '%', reg: { addr: 32104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery Total Energy', units: 'kWh', reg: { addr: 32105, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'AC Voltage', units: 'V', reg: { addr: 32200, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Power', units: 'W', reg: { addr: 32202, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'AC Frequency', units: 'Hz', reg: { addr: 32204, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Offgrid Voltage', units: 'V', reg: { addr: 32300, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Offgrid Power', units: 'W', reg: { addr: 32302, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Daily Charging Energy', units: 'kWh', reg: { addr: 33004, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Daily Discharging Energy', units: 'kWh', reg: { addr: 33006, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Internal Temperature', units: 'C', reg: { addr: 35000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Max Cell Temperature', units: 'C', reg: { addr: 35010, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Min Cell Temperature', units: 'C', reg: { addr: 35011, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Inverter State', units: '', reg: { addr: 35100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, isState: true },
  { name: 'Alarm Word 36000', units: '', reg: { addr: 36000, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'alarm36000' },
  { name: 'Alarm Word 36001', units: '', reg: { addr: 36001, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'alarm36001' },
  { name: 'Fault Word 36100', units: '', reg: { addr: 36100, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'fault36100' },
  { name: 'Fault Word 36101', units: '', reg: { addr: 36101, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'fault36101' },
  { name: 'Fault Word 36103', units: '', reg: { addr: 36103, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'fault36103' },
  { name: 'Fault Word 36104', units: '', reg: { addr: 36104, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, bits: 'fault36104' },
  { name: 'Charge Voltage Limit', units: 'V', reg: { addr: 35110, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Charge Current Limit', units: 'A', reg: { addr: 35111, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Discharge Current Limit', units: 'A', reg: { addr: 35112, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 }
];

var BIT_NAMES = {
  alarm36000: ['PLL Abnormal Restart', 'Overtemperature Limit', 'Low Temperature Limit', 'Fan Abnormal Warning', 'Low Battery SOC Warning', 'Output Overcurrent Warning', 'Abnormal Line Sequence Detection'],
  alarm36001: ['WIFI abnormal', 'BLE abnormal', 'Network abnormal', 'CT connection abnormal'],
  fault36100: ['Grid overvoltage', 'Grid undervoltage', 'Grid overfrequency', 'Grid underfrequency', 'Grid peak voltage abnormal', 'Current Dcover', 'Voltage Dcover'],
  fault36101: ['BAT overvoltage', 'BAT undervoltage', 'BAT overcurrent', 'BAT low SOC', 'BAT communication failure', 'BMS protect'],
  fault36103: ['hardware Bus overvoltage', 'hardware Output overcurrent', 'hardware trans overcurrent', 'hardware Battery overcurrent', 'Hardware protection', 'Output overcurrent', 'High voltage bus overvoltage', 'High voltage bus undervoltage', 'Overpower protection', 'FSM abnormal', 'Overtemperature protection', 'Inverter soft start timeout'],
  fault36104: ['self-test fault', 'eeprom fault', 'other system fault']
};

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

function describeBits(raw, key) {
  var names = BIT_NAMES[key];
  var active = [];
  var i;

  if (!names) return '';
  for (i = 0; i < names.length; i++) {
    if (raw & (1 << i)) active.push(names[i]);
  }
  if (active.length === 0) return 'normal';
  return active.join(', ');
}

// The 9 most valuable parameters, promoted to Virtual Components
// (matches the upstream 10-total-VC budget: 9 + 1 group).
var VC_SPECS = [
  { name: 'Battery Voltage', min: 0, max: 100 },
  { name: 'Battery Current', min: -100, max: 100 },
  { name: 'Battery Power', min: -2500, max: 2500 },
  { name: 'Battery SOC', min: 0, max: 100 },
  { name: 'AC Voltage', min: 187, max: 253 },
  { name: 'AC Power', min: -2500, max: 2500 },
  { name: 'AC Frequency', min: 45, max: 55 },
  { name: 'Internal Temperature', min: -10, max: 55 },
  { name: 'Inverter State', min: 0, max: 6 }
];

function findEntityByName(name) {
  var i;
  for (i = 0; i < ENTITIES.length; i++) {
    if (ENTITIES[i].name === name) return ENTITIES[i];
  }
  return null;
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var nextId = 200;
  var i;
  var spec;
  var entity;
  var key;

  for (i = 0; i < VC_SPECS.length; i++) {
    spec = VC_SPECS[i];
    entity = findEntityByName(spec.name);
    key = 'p' + i;
    entity.vcKey = key;
    components.push({
      key: key,
      type: 'number',
      id: nextId,
      config: {
        name: entity.name,
        default_value: 0,
        min: spec.min,
        max: spec.max,
        unit: entity.units,
        persisted: false,
        meta: { ui: { view: 'label' }, cloud: ['measurement'] }
      }
    });
    groupMembers.push(key);
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
      { id: 200, name: 'Marstek VenusE', components: groupMembers }
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
  var line;

  console.log('--- Marstek VenusE ---');

  for (i = 0; i < ENTITIES.length; i++) {
    entity = ENTITIES[i];
    raw = entity.entity.getValue();
    value = raw * entity.scale;

    line = entity.name + ': ' + value;
    if (entity.units !== '') line += ' [' + entity.units + ']';
    if (entity.isState) line += ' (' + stateName(raw) + ')';
    if (entity.bits) line += ' (' + describeBits(raw, entity.bits) + ')';

    console.log(line);

    if (entity.vcKey && vcHandles && vcHandles[entity.vcKey]) {
      vcHandles[entity.vcKey].setValue(value);
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
