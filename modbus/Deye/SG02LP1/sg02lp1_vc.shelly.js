/**
 * @title Deye SG02LP1 MODBUS-RTU monitor + Virtual Components
 * @description Reads the full Deye SG02LP1 register set (PV, battery, grid,
 *   inverter, time-of-use, BMS) over the native Shelly ModbusController.
 *   The 9 most valuable parameters are published as a self-created,
 *   grouped set of Virtual Components; every other parameter is printed to
 *   the console log each poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/sg02lp1_vc.shelly.js
 */

/**
 * Deye SG02LP1 MODBUS-RTU Monitor + Virtual Components
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly Pro devices with RS485 Modbus RTU Add-on.
 * External hardware: Deye SG02LP1 hybrid solar inverter over RS485.
 *
 * Virtual Components created (9 + 1 group = 10 total):
 * - group:200   Deye SG02LP1
 * - number:200  Battery SOC, %
 * - number:201  Battery Power, W
 * - number:202  Battery Voltage, V
 * - number:203  Battery Temperature, C
 * - number:204  PV1 Power, W
 * - number:205  Daily Production, kWh
 * - number:206  Total Power (inverter AC output), W
 * - number:207  Total Grid Power, W
 * - number:208  Grid Voltage L1, V
 *
 * Every other register in the full entity table (PV2/PV3, time-of-use
 * schedule, BMS detail, temperatures, per-phase currents, ...) is read and
 * printed to the console log every poll, but is not backed by a Virtual
 * Component - The Pill/Shelly Pro Virtual Component budget on tested
 * firmware is limited, so only the 9 parameters above are promoted to the
 * dashboard. Adjust VC_KEYS below to change the selection.
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
  batterySoc: true,
  batteryPower: true,
  batteryVoltage: true,
  batteryTemp: true,
  pv1Power: true,
  dailyProduction: true,
  totalPower: true,
  totalGridPower: true,
  gridVoltageL1: true
};

// Full Deye SG02LP1 register catalog (PV, battery, grid, inverter, ToU, BMS).
// Entries with a `vcKey` matching VC_KEYS get a Virtual Component; every
// entry is printed to the console log on each poll regardless.
var ENTITIES = [
  // --- Solar PV (DC Input) ---
  { name: 'PV1 Power', units: 'W', vcKey: 'pv1Power', reg: { addr: 186, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'PV2 Power', units: 'W', reg: { addr: 187, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'PV3 Power', units: 'W', reg: { addr: 188, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'PV1 Voltage', units: 'V', reg: { addr: 109, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Voltage', units: 'V', reg: { addr: 111, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV3 Voltage', units: 'V', reg: { addr: 113, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV1 Current', units: 'A', reg: { addr: 110, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Current', units: 'A', reg: { addr: 112, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV3 Current', units: 'A', reg: { addr: 114, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Production', units: 'kWh', vcKey: 'dailyProduction', reg: { addr: 108, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Production', units: 'kWh', reg: { addr: 96, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Micro-inverter Power', units: 'W', reg: { addr: 166, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  // --- Battery (DC Storage System) ---
  { name: 'Total Battery Charge', units: 'kWh', reg: { addr: 72, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Battery Discharge', units: 'kWh', reg: { addr: 74, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Battery Charge', units: 'kWh', reg: { addr: 70, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Battery Discharge', units: 'kWh', reg: { addr: 71, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery Status', units: '', reg: { addr: 189, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery Power', units: 'W', vcKey: 'batteryPower', reg: { addr: 190, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery Voltage', units: 'V', vcKey: 'batteryVoltage', reg: { addr: 183, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery SOC', units: '%', vcKey: 'batterySoc', reg: { addr: 184, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery Current', units: 'A', reg: { addr: 191, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery Temperature', units: 'C', vcKey: 'batteryTemp', reg: { addr: 182, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  // --- Grid Sensors (AC Import/Export) ---
  { name: 'Total Grid Power', units: 'W', vcKey: 'totalGridPower', reg: { addr: 169, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Grid Voltage L1', units: 'V', vcKey: 'gridVoltageL1', reg: { addr: 150, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Grid Voltage L2', units: 'V', reg: { addr: 151, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Internal CT L1 Power', units: 'W', reg: { addr: 167, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Internal CT L2 Power', units: 'W', reg: { addr: 168, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'External CT L1 Power', units: 'W', reg: { addr: 170, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'External CT L2 Power', units: 'W', reg: { addr: 171, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Daily Energy Bought', units: 'kWh', reg: { addr: 76, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Energy Bought', units: 'kWh', reg: { addr: 78, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Energy Sold', units: 'kWh', reg: { addr: 77, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Energy Sold', units: 'kWh', reg: { addr: 81, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  // --- Inverter (AC Output) ---
  { name: 'Total Power', units: 'W', vcKey: 'totalPower', reg: { addr: 175, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Current L1', units: 'A', reg: { addr: 164, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Current L2', units: 'A', reg: { addr: 165, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Inverter L1 Power', units: 'W', reg: { addr: 173, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Inverter L2 Power', units: 'W', reg: { addr: 174, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Load Frequency', units: 'Hz', reg: { addr: 192, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'DC Temperature', units: 'C', reg: { addr: 90, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Temperature', units: 'C', reg: { addr: 91, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  // --- Time of Use (Energy Management Schedules) ---
  { name: 'Time of Use Time 1', units: '', reg: { addr: 250, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 2', units: '', reg: { addr: 251, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 3', units: '', reg: { addr: 252, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 4', units: '', reg: { addr: 253, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 5', units: '', reg: { addr: 254, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 6', units: '', reg: { addr: 255, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 1', units: '', reg: { addr: 256, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 2', units: '', reg: { addr: 257, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 3', units: '', reg: { addr: 258, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 4', units: '', reg: { addr: 259, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 5', units: '', reg: { addr: 260, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 6', units: '', reg: { addr: 261, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 1', units: '', reg: { addr: 268, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 2', units: '', reg: { addr: 269, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 3', units: '', reg: { addr: 270, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 4', units: '', reg: { addr: 271, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 5', units: '', reg: { addr: 272, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 6', units: '', reg: { addr: 273, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 1', units: '', reg: { addr: 274, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 2', units: '', reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 3', units: '', reg: { addr: 276, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 4', units: '', reg: { addr: 277, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 5', units: '', reg: { addr: 278, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Enable 6', units: '', reg: { addr: 279, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use', units: '', reg: { addr: 248, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Voltage 1', units: 'V', reg: { addr: 262, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Time of Use Voltage 2', units: 'V', reg: { addr: 263, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Time of Use Voltage 3', units: 'V', reg: { addr: 264, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Time of Use Voltage 4', units: 'V', reg: { addr: 265, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Time of Use Voltage 5', units: 'V', reg: { addr: 266, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Time of Use Voltage 6', units: 'V', reg: { addr: 267, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },

  // --- BMS Data (Battery Management System) ---
  { name: 'BMS1 Charging Voltage', units: 'V', reg: { addr: 312, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'BMS1 Discharge Voltage', units: 'V', reg: { addr: 313, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'BMS1 Charge Current Limit', units: 'A', reg: { addr: 314, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Discharge Current Limit', units: 'A', reg: { addr: 315, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 SOC', units: '%', reg: { addr: 316, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Voltage', units: 'V', reg: { addr: 317, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'BMS1 Current', units: 'A', reg: { addr: 318, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Temp', units: 'C', reg: { addr: 319, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 }
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
      { id: 200, name: 'Deye SG02LP1', components: groupMembers }
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
  print('Deye SG02LP1 MODBUS-RTU monitor + VC');

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
