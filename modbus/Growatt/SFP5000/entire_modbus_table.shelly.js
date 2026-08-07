/**
 * @title Entire Modbus Table
 * @description Full register table reference for this device, printed to the console on a timer. Not the recommended entry point - use the paired _vc.shelly.js script for a self-deploying dashboard.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Growatt/SFP5000/entire_modbus_table.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    ENTITIES-based Modbus reader for Growatt SPF5000 Off-Grid/Hybrid Inverter

    Register map based on: growatt_register-map-user_1-2026-01-12.json
*/

// Update rate (sec)
var UPDATE_RATE = 3;

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

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), { baud: 9600, mode: "8N1" });
  registerEntities(MODBUS_ENDPOINT, ENTITIES);
}

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// This script prints all values to the console; only the Modbus Slave ID is
// backed by a Virtual Component (it is configuration, not sensor data).

var VIRTUAL_COMPONENTS = {
  components: [
    {
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
    }
  ],
  groups: [
    { id: 299, name: 'Growatt SFP5000 Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;

// ENTITIES table - Growatt SPF5000 Off-Grid/Hybrid
let ENTITIES = [
  // ========== SYSTEM ==========
  {
    name: "System Status",
    units: "",
    reg: { addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
    note: "0=Standby,2=Discharge,5=PVCharge,6=ACCharge,7=CombineCharge"
  },

  // ========== PV ==========
  {
    name: "PV1 Voltage",
    units: "V",
    reg: { addr: 1, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Voltage",
    units: "V",
    reg: { addr: 2, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: { addr: 3, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Power",
    units: "W",
    reg: { addr: 5, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck1 Current",
    units: "A",
    reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck2 Current",
    units: "A",
    reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== LOAD / OUTPUT ==========
  {
    name: "Output Power",
    units: "W",
    reg: { addr: 9, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output VA",
    units: "VA",
    reg: { addr: 11, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Power",
    units: "W",
    reg: { addr: 13, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge VA",
    units: "VA",
    reg: { addr: 15, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== BATTERY ==========
  {
    name: "Battery Voltage",
    units: "V",
    reg: { addr: 17, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: { addr: 18, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Bus Voltage",
    units: "V",
    reg: { addr: 19, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== GRID / AC INPUT ==========
  {
    name: "AC Input Voltage",
    units: "V",
    reg: { addr: 20, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input Frequency",
    units: "Hz",
    reg: { addr: 21, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Output Voltage",
    units: "V",
    reg: { addr: 22, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output Frequency",
    units: "Hz",
    reg: { addr: 23, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Output DC Voltage",
    units: "V",
    reg: { addr: 24, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== TEMPERATURES ==========
  {
    name: "Inverter Temperature",
    units: "C",
    reg: { addr: 25, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "DC-DC Temperature",
    units: "C",
    reg: { addr: 26, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Load Percent",
    units: "%",
    reg: { addr: 27, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Port Voltage",
    units: "V",
    reg: { addr: 28, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Battery Bus Voltage",
    units: "V",
    reg: { addr: 29, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.01,
    rights: "R"
  },
  {
    name: "Work Time Total",
    units: "s",
    reg: { addr: 30, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.5,
    rights: "R"
  },
  {
    name: "Buck1 Temperature",
    units: "C",
    reg: { addr: 32, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Buck2 Temperature",
    units: "C",
    reg: { addr: 33, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Output Current",
    units: "A",
    reg: { addr: 34, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Inverter Current",
    units: "A",
    reg: { addr: 35, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input Power",
    units: "W",
    reg: { addr: 36, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Input VA",
    units: "VA",
    reg: { addr: 38, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },

  // ========== FAULT/WARNING ==========
  {
    name: "Fault Code",
    units: "",
    reg: { addr: 40, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Warning Code",
    units: "",
    reg: { addr: 42, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },

  // ========== ENERGY COUNTERS ==========
  {
    name: "PV1 Energy Today",
    units: "kWh",
    reg: { addr: 48, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV1 Energy Total",
    units: "kWh",
    reg: { addr: 50, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Energy Today",
    units: "kWh",
    reg: { addr: 52, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "PV2 Energy Total",
    units: "kWh",
    reg: { addr: 54, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Energy Today",
    units: "kWh",
    reg: { addr: 56, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Energy Total",
    units: "kWh",
    reg: { addr: 58, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Today",
    units: "kWh",
    reg: { addr: 60, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Total",
    units: "kWh",
    reg: { addr: 62, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Energy Today",
    units: "kWh",
    reg: { addr: 64, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Energy Total",
    units: "kWh",
    reg: { addr: 66, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Charge Current",
    units: "A",
    reg: { addr: 68, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge Power",
    units: "W",
    reg: { addr: 69, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "AC Discharge VA",
    units: "VA",
    reg: { addr: 71, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge Power",
    units: "W",
    reg: { addr: 73, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Discharge VA",
    units: "VA",
    reg: { addr: 75, rtype: ModbusController.REGTYPE_INPUT, itype: "u32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "Battery Power",
    units: "W",
    reg: { addr: 77, rtype: ModbusController.REGTYPE_INPUT, itype: "i32", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R",
    note: "Positive=Discharge, Negative=Charge"
  },
  {
    name: "Battery Over Charge",
    units: "",
    reg: { addr: 80, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R",
    note: "0=Normal, 1=Over charge"
  },
  {
    name: "MPPT Fan Speed",
    units: "%",
    reg: { addr: 81, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "Inverter Fan Speed",
    units: "%",
    reg: { addr: 82, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },

  // ========== BMS ==========
  {
    name: "BMS Status",
    units: "",
    reg: { addr: 90, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Error",
    units: "",
    reg: { addr: 91, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Warning",
    units: "",
    reg: { addr: 92, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS SOC",
    units: "%",
    reg: { addr: 93, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 1,
    rights: "R"
  },
  {
    name: "BMS Battery Voltage",
    units: "V",
    reg: { addr: 94, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Battery Current",
    units: "A",
    reg: { addr: 95, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Battery Temp",
    units: "C",
    reg: { addr: 96, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS Max Current",
    units: "A",
    reg: { addr: 97, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  },
  {
    name: "BMS CV Voltage",
    units: "V",
    reg: { addr: 98, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE },
    scale: 0.1,
    rights: "R"
  }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  for (let i = 0; i < entities.length; i++) {
    entities[i]["entity"] = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Polling update
*/
function update() {
  var value = 0;
  for (var name in ENTITIES) {
    value = ENTITIES[name].entity.getValue() * ENTITIES[name].scale;
    console.log(ENTITIES[name].name + ": " + value + "[" + ENTITIES[name].units + "]");
  }
}

/*
    Initialization on Script Start
*/
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

// Start the application
init();
