/**
 * @title IGEN DTSD422-D3 MODBUS-RTU monitor + Virtual Components
 * @description Reads the documented IGEN DTSD422-D3 six-circuit energy meter
 *   register set (CT1-CT4: voltage, current, active/reactive/apparent power,
 *   power factor, energy totals) over the native Shelly ModbusController.
 *   The 9 most valuable parameters are published as a self-created, grouped
 *   set of Virtual Components; every other parameter is printed to the
 *   console log each poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/IGEN/DTSD422/dtsd422_vc.shelly.js
 */

/**
 * IGEN DTSD422-D3 MODBUS-RTU Monitor + Virtual Components
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly Pro devices with RS485 Modbus RTU Add-on.
 * External hardware: IGEN DTSD422-D3 six-circuit energy meter over RS485.
 * Register map: Six-circuit WiFi DTSD422-D3-W v1.0 EN. Only CT1-CT4 are
 * documented in this source table; CT5/CT6 registers are not included.
 *
 * Virtual Components created (9 + 1 group = 10 total):
 * - group:200   IGEN DTSD422-D3
 * - number:200  Active Power CT1, W
 * - number:201  Active Power CT2, W
 * - number:202  Active Power CT3, W
 * - number:203  Active Power CT4, W
 * - number:204  Voltage CT1, V
 * - number:205  Total Positive Energy CT1, kWh
 * - number:206  Total Positive Energy CT2, kWh
 * - number:207  Total Positive Energy CT3, kWh
 * - number:208  Total Positive Energy CT4, kWh
 *
 * Every other register in the full entity table (per-circuit current,
 * reactive/apparent power, power factor, negative energy totals, ...) is
 * read and printed to the console log every poll, but is not backed by a
 * Virtual Component. Adjust VC_KEYS below to change the selection.
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

var UPDATE_RATE = 5; // ============================================================================
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
var MODBUS_ENDPOINT_OPTS = { baud: 9600, mode: '8N1' };

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), MODBUS_ENDPOINT_OPTS);
  registerEntities();
}


// Logical keys of the 9 parameters promoted to Virtual Components below.
var VC_KEYS = {
  activePowerCt1: true,
  activePowerCt2: true,
  activePowerCt3: true,
  activePowerCt4: true,
  voltageCt1: true,
  totalPositiveEnergyCt1: true,
  totalPositiveEnergyCt2: true,
  totalPositiveEnergyCt3: true,
  totalPositiveEnergyCt4: true
};

// Full IGEN DTSD422-D3 register catalog (CT1-CT4; CT5/CT6 not documented
// in the source register table).
var ENTITIES = [
  // -------- CT1 --------
  { name: 'Voltage CT1', units: 'V', vcKey: 'voltageCt1', reg: { addr: 0x01, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Current CT1', units: 'A', reg: { addr: 0x07, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Active Power CT1', units: 'W', vcKey: 'activePowerCt1', reg: { addr: 0x0F, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Reactive Power CT1', units: 'Var', reg: { addr: 0x17, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Apparent Power CT1', units: 'VA', reg: { addr: 0x1F, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Power Factor CT1', units: '', reg: { addr: 0x26, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Total Positive Energy CT1', units: 'kWh', vcKey: 'totalPositiveEnergyCt1', reg: { addr: 0x3E, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Total Negative Energy CT1', units: 'kWh', reg: { addr: 0x48, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },

  // -------- CT2 --------
  { name: 'Voltage CT2', units: 'V', reg: { addr: 0x02, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Current CT2', units: 'A', reg: { addr: 0x09, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Active Power CT2', units: 'W', vcKey: 'activePowerCt2', reg: { addr: 0x11, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Reactive Power CT2', units: 'Var', reg: { addr: 0x19, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Apparent Power CT2', units: 'VA', reg: { addr: 0x21, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Power Factor CT2', units: '', reg: { addr: 0x27, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Total Positive Energy CT2', units: 'kWh', vcKey: 'totalPositiveEnergyCt2', reg: { addr: 0x52, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Total Negative Energy CT2', units: 'kWh', reg: { addr: 0x5C, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },

  // -------- CT3 --------
  { name: 'Voltage CT3', units: 'V', reg: { addr: 0x03, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Current CT3', units: 'A', reg: { addr: 0x0B, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Active Power CT3', units: 'W', vcKey: 'activePowerCt3', reg: { addr: 0x13, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Reactive Power CT3', units: 'Var', reg: { addr: 0x1B, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Apparent Power CT3', units: 'VA', reg: { addr: 0x23, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Power Factor CT3', units: '', reg: { addr: 0x28, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Total Positive Energy CT3', units: 'kWh', vcKey: 'totalPositiveEnergyCt3', reg: { addr: 0x66, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Total Negative Energy CT3', units: 'kWh', reg: { addr: 0x70, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },

  // -------- CT4 --------
  { name: 'Voltage CT4', units: 'V', reg: { addr: 0x1001, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Current CT4', units: 'A', reg: { addr: 0x1007, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Active Power CT4', units: 'W', vcKey: 'activePowerCt4', reg: { addr: 0x100F, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Reactive Power CT4', units: 'Var', reg: { addr: 0x1017, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Apparent Power CT4', units: 'VA', reg: { addr: 0x101F, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Power Factor CT4', units: '', reg: { addr: 0x1026, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.001 },
  { name: 'Total Positive Energy CT4', units: 'kWh', vcKey: 'totalPositiveEnergyCt4', reg: { addr: 0x103E, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Total Negative Energy CT4', units: 'kWh', reg: { addr: 0x1048, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 }
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
      { id: 200, name: 'IGEN DTSD422-D3', components: groupMembers }
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
  print('IGEN DTSD422-D3 MODBUS-RTU monitor + VC');

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      print('ERROR: Virtual component setup failed');
      return;
    }

    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;

    rebuildModbusEndpoint();
    slaveIdHandle.on('change', function() {
      print('Modbus Slave ID changed -> ' + getSlaveId());
      rebuildModbusEndpoint();
    });
    print('Ready; polling every ' + UPDATE_RATE + 's, ' + ENTITIES.length + ' parameters (' +
      VIRTUAL_COMPONENTS.components.length + ' on Virtual Components)');

    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

main();
