/**
 * @title ComWinTop CWT-MB308V MODBUS-RTU monitor + Virtual Components
 * @description Reads all 8 analog inputs, all 8 digital inputs, all 4 analog
 *   outputs, and all 12 digital outputs of a ComWinTop CWT-MB308V IO
 *   expansion module over the native Shelly ModbusController. The 8 analog
 *   inputs plus a combined digital-input summary are published as a
 *   self-created, grouped set of Virtual Components; every channel is
 *   printed to the console log each poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/mb308v_vc.shelly.js
 */

/**
 * ComWinTop CWT-MB308V MODBUS-RTU Monitor + Virtual Components
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly Pro devices with RS485 Modbus RTU Add-on.
 * External hardware: ComWinTop CWT-MB308V generic IO expansion module over
 * RS485.
 *
 * Device specifications:
 * - 8 Analog Inputs (AI0-AI7): 4-20mA / 0-5V / 0-10V, read via FC 0x04
 * - 4 Analog Outputs (AO0-AO3): 0-10V / 4-20mA, read via FC 0x03
 * - 8 Digital Inputs (DI0-DI7): dry contact / NPN, read via FC 0x02
 * - 12 Digital Outputs (DO0-DO11): relay outputs, read via FC 0x01
 *
 * Unlike the inverter/meter families in this repo, this is a generic IO
 * module with no fixed "most valuable" measurement - every analog input is
 * an independent sensor signal. This script promotes all 8 analog inputs
 * (the highest-information channels) plus one combined digital-input
 * summary bitmask (bit N set = DI{N} is high) to Virtual Components,
 * keeping the 9-Virtual-Component budget used throughout this repo. Analog
 * outputs and individual digital output states are read and printed to the
 * console log every poll, but are not backed by a Virtual Component.
 *
 * Virtual Components created (9 + 1 group = 10 total):
 * - group:200   ComWinTop CWT-MB308V
 * - number:200  AI0, V
 * - number:201  AI1, V
 * - number:202  AI2, V
 * - number:203  AI3, V
 * - number:204  AI4, V
 * - number:205  AI5, V
 * - number:206  AI6, V
 * - number:207  AI7, V
 * - number:208  DI Summary (bitmask, bit N = DI{N} state)
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

var UPDATE_RATE = 3; // seconds
var DEVICE_ID = 2;

var MODBUS_ENDPOINT = ModbusController.get(DEVICE_ID, { baud: 9600, mode: '8N1' });
var AI_SCALE = 1 / 1100; // matches example_input_register.shelly.js voltage formula

// Analog inputs - each gets a Virtual Component (AI0..AI7).
var AI_ENTITIES = [
  { name: 'AI0', vcKey: 'ai0', handle: null },
  { name: 'AI1', vcKey: 'ai1', handle: null },
  { name: 'AI2', vcKey: 'ai2', handle: null },
  { name: 'AI3', vcKey: 'ai3', handle: null },
  { name: 'AI4', vcKey: 'ai4', handle: null },
  { name: 'AI5', vcKey: 'ai5', handle: null },
  { name: 'AI6', vcKey: 'ai6', handle: null },
  { name: 'AI7', vcKey: 'ai7', handle: null }
];

// Digital inputs - printed individually, combined into the "DI Summary" VC.
var DI_ENTITIES = [
  { name: 'DI0', handle: null }, { name: 'DI1', handle: null },
  { name: 'DI2', handle: null }, { name: 'DI3', handle: null },
  { name: 'DI4', handle: null }, { name: 'DI5', handle: null },
  { name: 'DI6', handle: null }, { name: 'DI7', handle: null }
];

// Analog outputs - print-only (read-back current AO value).
var AO_ENTITIES = [
  { name: 'AO0', handle: null }, { name: 'AO1', handle: null },
  { name: 'AO2', handle: null }, { name: 'AO3', handle: null }
];

// Digital outputs (relays) - print-only (read-back current DO state).
var DO_ENTITIES = [
  { name: 'DO0', handle: null }, { name: 'DO1', handle: null },
  { name: 'DO2', handle: null }, { name: 'DO3', handle: null },
  { name: 'DO4', handle: null }, { name: 'DO5', handle: null },
  { name: 'DO6', handle: null }, { name: 'DO7', handle: null },
  { name: 'DO8', handle: null }, { name: 'DO9', handle: null },
  { name: 'DO10', handle: null }, { name: 'DO11', handle: null }
];

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function aiComponentSpec(id, entity) {
  return {
    key: entity.vcKey,
    type: 'number',
    id: id,
    config: {
      name: entity.name,
      default_value: 0,
      min: 0,
      max: 10,
      unit: 'V',
      persisted: false,
      meta: { ui: { view: 'progressbar' }, cloud: ['measurement'] }
    }
  };
}

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var i;

  for (i = 0; i < AI_ENTITIES.length; i++) {
    components.push(aiComponentSpec(200 + i, AI_ENTITIES[i]));
    groupMembers.push(AI_ENTITIES[i].vcKey);
  }

  components.push({
    key: 'diSummary',
    type: 'number',
    id: 208,
    config: {
      name: 'DI Summary',
      default_value: 0,
      min: 0,
      max: 255,
      unit: '',
      persisted: false,
      meta: { ui: { view: 'label' } }
    }
  });
  groupMembers.push('diSummary');

  return {
    components: components,
    groups: [
      { id: 200, name: 'ComWinTop CWT-MB308V', components: groupMembers }
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
  var voltage;
  var diBit;
  var diSummary = 0;

  for (i = 0; i < AI_ENTITIES.length; i++) {
    ent = AI_ENTITIES[i];
    ent.handle.readOnce();
    raw = ent.handle.getValue();
    voltage = raw * AI_SCALE;

    console.log(ent.name + ': ' + voltage + ' [V]');
    if (vcHandles && vcHandles[ent.vcKey]) {
      vcHandles[ent.vcKey].setValue(voltage);
    }
  }

  for (i = 0; i < DI_ENTITIES.length; i++) {
    ent = DI_ENTITIES[i];
    ent.handle.readOnce();
    diBit = ent.handle.getValue() ? 1 : 0;
    console.log(ent.name + ': ' + diBit);
    if (diBit) diSummary |= (1 << i);
  }
  console.log('DI Summary: 0x' + diSummary.toString(16));
  if (vcHandles && vcHandles.diSummary) {
    vcHandles.diSummary.setValue(diSummary);
  }

  for (i = 0; i < AO_ENTITIES.length; i++) {
    ent = AO_ENTITIES[i];
    ent.handle.readOnce();
    console.log(ent.name + ': ' + ent.handle.getValue());
  }

  for (i = 0; i < DO_ENTITIES.length; i++) {
    ent = DO_ENTITIES[i];
    ent.handle.readOnce();
    console.log(ent.name + ': ' + (ent.handle.getValue() ? 1 : 0));
  }
}

function registerEntities() {
  var i;

  for (i = 0; i < AI_ENTITIES.length; i++) {
    AI_ENTITIES[i].handle = MODBUS_ENDPOINT.addEntity({ addr: i, rtype: ModbusController.REGTYPE_INPUT, itype: 'i16' });
  }
  for (i = 0; i < DI_ENTITIES.length; i++) {
    DI_ENTITIES[i].handle = MODBUS_ENDPOINT.addEntity({ addr: i, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: 'i16' });
  }
  for (i = 0; i < AO_ENTITIES.length; i++) {
    AO_ENTITIES[i].handle = MODBUS_ENDPOINT.addEntity({ addr: i, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16' });
  }
  for (i = 0; i < DO_ENTITIES.length; i++) {
    DO_ENTITIES[i].handle = MODBUS_ENDPOINT.addEntity({ addr: i, rtype: ModbusController.REGTYPE_COIL, itype: 'i16' });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  print('ComWinTop CWT-MB308V MODBUS-RTU monitor + VC');

  registerEntities();

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      print('ERROR: Virtual component setup failed');
      return;
    }

    vcHandles = readyVc.handles;
    print('Ready; polling every ' + UPDATE_RATE + 's, 8 AI + 8 DI + 4 AO + 12 DO channels (' +
      VIRTUAL_COMPONENTS.components.length + ' on Virtual Components)');

    Timer.set(UPDATE_RATE * 1000, true, update);
  });
}

main();
