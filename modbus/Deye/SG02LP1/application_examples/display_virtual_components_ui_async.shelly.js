/**
 * @title Display Virtual Components Ui Async
 * @description Application example demonstrating an asynchronous Virtual Components UI update pattern.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/display_virtual_components_ui_async.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.
    ENTITIES-based version + Virtual Components.
*/

const INVERTER_MODBUS_SERVER_ID = 1;

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
const MODBUS_ENDPOINT = ModbusController.get(INVERTER_MODBUS_SERVER_ID, { baud: 9600, mode: "8N1", pause_ms: 2000 });

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

// ENTITIES table describing all parameters + mapping to virtual components
const ENTITIES = [
  {
    name: "Total Power",
    units: "W",
    reg: {
      addr: 175,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:200",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Battery Power",
    units: "W",
    reg: {
      addr: 190,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:201",
    handle: null,
    vcHandle: null,
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: {
      addr: 186,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:202",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 10, // as in your original script
    rights: "R",
    vcId: "number:203",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: {
      addr: 184,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
      poll_int: 10000, // poll less frequently
    },
    scale: 1,
    rights: "R",
    vcId: "number:204",
    handle: null,
    vcHandle: null,
  },
  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 109,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
    vcId: "number:205",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Grid Voltage L1",
    units: "V",
    reg: {
      addr: 150,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
      poll_int: 10000, // poll less frequently
    },
    scale: 0.1,
    rights: "R",
    vcId: "number:206",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Current L1",
    units: "A",
    reg: {
      addr: 164,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
    rights: "R",
    vcId: "number:207",
    handle: null,
    vcHandle: null,
  },
  {
    name: "AC Frequency",
    units: "Hz",
    reg: {
      addr: 192,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
      poll_int: 10000, // poll less frequently
    },
    scale: 0.01,
    rights: "R",
    vcId: "number:208",
    handle: null,
    vcHandle: null,
  },
];

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

function buildVirtualComponentsManifest() {
  var components = [];
  var groupMembers = [];
  var i;
  var key;
  var parts;

  for (i = 0; i < ENTITIES.length; i++) {
    if (!ENTITIES[i].vcId) continue;
    parts = ENTITIES[i].vcId.split(':');
    key = 'p' + i;
    components.push({
      key: key,
      type: parts[0],
      id: parseInt(parts[1]),
      config: {
        name: ENTITIES[i].name,
        default_value: 0,
        unit: ENTITIES[i].units,
        persisted: false,
        meta: { ui: { view: 'label' }, cloud: ['measurement'] }
      }
    });
    groupMembers.push(key);
  }

  return {
    components: components,
    groups: [
      { id: 200, name: 'Deye SG02LP1 Async Display', components: groupMembers }
    ]
  };
}

var VIRTUAL_COMPONENTS = buildVirtualComponentsManifest();

function getScaledValue(ent) {
  return ent.handle.getValue() * ent.scale;
}

function updateVc(ent) {
    if (!ent.vcHandle) return;
    const new_val = getScaledValue(ent);
    const old_val = ent.vcHandle.getValue();
    console.log(ent.name + ": " + old_val + " -> " + new_val + " [" + ent.units + "]");
    ent.vcHandle.setValue(new_val);
    return old_val;
}

function dump() {
  console.log("--- PERIODIC DATA DUMP BEGIN ---")
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Refresh value from Modbus
    // you are already polling, this does nothing
    //ent.handle.readOnce();

    console.log(ent.name + ": " + getScaledValue(ent) + " [" + ent.units + "]");
  }
  console.log("--- PERIODIC DATA DUMP END ---")
}

function init() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];
    ent.handle = MODBUS_ENDPOINT.addEntity(ent.reg);
  }

  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }

    for (let i = 0; i < ENTITIES.length; i++) {
      let ent = ENTITIES[i];
      if (ent.vcId) {
        ent.vcHandle = readyVc.handles['p' + i];
        ent.handle.on("change", function(handle) {
          updateVc(ent);
        });
      }
    }

    // wait 10 seconds, update all entities once
    Timer.set(10000, false, function() {
      for (let i = 0; i < ENTITIES.length; i++) {
        updateVc(ENTITIES[i]);
      }
    });
    // Timer.set(30 * 1000, true, dump);
  });
}

// Run the application.
init();