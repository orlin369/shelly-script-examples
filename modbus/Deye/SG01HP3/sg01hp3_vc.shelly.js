/**
 * @title Deye SG01HP3 MODBUS-RTU monitor + Virtual Components
 * @description Reads the full Deye SG01HP3 register set (PV, dual-battery
 *   BMS, UPS/load, generator port, time-of-use, currents/temps) over the
 *   native Shelly ModbusController. The 9 most valuable parameters are
 *   published as a self-created, grouped set of Virtual Components; every
 *   other parameter is printed to the console log each poll.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG01HP3/sg01hp3_vc.shelly.js
 */

/**
 * Deye SG01HP3 MODBUS-RTU Monitor + Virtual Components
 *
 * Firmware requirements: Shelly firmware with ModbusController support.
 * Device compatibility: Shelly Pro devices with RS485 Modbus RTU Add-on.
 * External hardware: Deye SG01HP3 hybrid solar inverter (dual battery input,
 * generator port, 3-phase UPS/load) over RS485.
 *
 * Virtual Components created (9 + 1 group = 10 total):
 * - group:200   Deye SG01HP3
 * - number:200  Running Status
 * - number:201  Battery1 SOC, %
 * - number:202  Battery1 Power, W
 * - number:203  Battery1 Temperature, C
 * - number:204  PV1 Power, W
 * - number:205  Daily Production, kWh
 * - number:206  Total Load Power, W
 * - number:207  Total Power of Gen Ports, W
 * - number:208  AC Temperature, C
 *
 * Every other register in the full entity table (PV2-4, battery2, per-phase
 * load/current/voltage, BMS1/BMS2 detail, time-of-use schedule, generator
 * per-phase detail, ...) is read and printed to the console log every poll,
 * but is not backed by a Virtual Component. Adjust VC_KEYS below to change
 * the selection.
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
  runningStatus: true,
  battery1Soc: true,
  battery1Power: true,
  battery1Temp: true,
  pv1Power: true,
  dailyProduction: true,
  totalLoadPower: true,
  totalGenPower: true,
  acTemperature: true
};

// Full Deye SG01HP3 register catalog (PV, dual battery, UPS/load,
// currents/temps, dual BMS, time-of-use, generator).
var ENTITIES = [
  { name: 'Running status', units: '', vcKey: 'runningStatus', reg: { addr: 500, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'AC relays status', units: '', reg: { addr: 552, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'PV1 Power', units: 'W', vcKey: 'pv1Power', reg: { addr: 672, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'PV2 Power', units: 'W', reg: { addr: 673, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'PV3 Power', units: 'W', reg: { addr: 674, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'PV4 Power', units: 'W', reg: { addr: 675, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'PV1 Voltage', units: 'V', reg: { addr: 676, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Voltage', units: 'V', reg: { addr: 678, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV3 Voltage', units: 'V', reg: { addr: 680, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV4 Voltage', units: 'V', reg: { addr: 682, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV1 Current', units: 'A', reg: { addr: 677, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV2 Current', units: 'A', reg: { addr: 679, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV3 Current', units: 'A', reg: { addr: 681, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'PV4 Current', units: 'A', reg: { addr: 683, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Production', units: 'kWh', vcKey: 'dailyProduction', reg: { addr: 529, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Production', units: 'kWh', reg: { addr: 534, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Daily Battery Charge', units: 'kWh', reg: { addr: 514, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Battery Discharge', units: 'kWh', reg: { addr: 515, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Battery Charge', units: 'kWh', reg: { addr: 516, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Battery Discharge', units: 'kWh', reg: { addr: 518, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery1 Power', units: 'W', vcKey: 'battery1Power', reg: { addr: 590, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Battery1 Voltage', units: 'V', reg: { addr: 587, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery1 SOC', units: '%', vcKey: 'battery1Soc', reg: { addr: 588, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery1 Current', units: 'A', reg: { addr: 591, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery1 Temperature', units: 'C', vcKey: 'battery1Temp', reg: { addr: 586, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery2 SOC', units: '%', reg: { addr: 589, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Battery2 Voltage', units: 'V', reg: { addr: 593, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Battery2 Current', units: 'A', reg: { addr: 594, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Battery2 Power', units: 'W', reg: { addr: 595, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Battery2 Temperature', units: 'C', reg: { addr: 596, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Total Load Power', units: 'W', vcKey: 'totalLoadPower', reg: { addr: 653, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Load L1 Power', units: 'W', reg: { addr: 650, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Load L2 Power', units: 'W', reg: { addr: 651, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Load L3 Power', units: 'W', reg: { addr: 652, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Load Voltage L1', units: 'V', reg: { addr: 644, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Load Voltage L2', units: 'V', reg: { addr: 645, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Load Voltage L3', units: 'V', reg: { addr: 646, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Daily Load Consumption', units: 'kWh', reg: { addr: 526, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Load Consumption', units: 'kWh', reg: { addr: 527, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u32', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'Current L1', units: 'A', reg: { addr: 630, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Current L2', units: 'A', reg: { addr: 631, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Current L3', units: 'A', reg: { addr: 632, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.01 },
  { name: 'Inverter L1 Power', units: 'W', reg: { addr: 633, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Inverter L2 Power', units: 'W', reg: { addr: 634, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Inverter L3 Power', units: 'W', reg: { addr: 635, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'DC Temperature', units: 'C', reg: { addr: 540, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'AC Temperature', units: 'C', vcKey: 'acTemperature', reg: { addr: 541, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },

  { name: 'BMS1 Charging Voltage', units: 'V', reg: { addr: 210, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS1 Discharge Voltage', units: 'V', reg: { addr: 211, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS1 Charge Current Limit', units: 'A', reg: { addr: 212, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Discharge Current Limit', units: 'A', reg: { addr: 213, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 SOC', units: '%', reg: { addr: 214, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Voltage', units: 'V', reg: { addr: 215, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS1 Current', units: 'A', reg: { addr: 216, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS1 Temp', units: 'C', reg: { addr: 217, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS1 Charging Max Current', units: 'A', reg: { addr: 218, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS1 Discharge Max Current', units: 'A', reg: { addr: 219, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS2 Charging Voltage', units: 'V', reg: { addr: 241, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS2 Discharge Voltage', units: 'V', reg: { addr: 242, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS2 Charge Current Limit', units: 'A', reg: { addr: 243, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS2 Discharge Current Limit', units: 'A', reg: { addr: 244, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS2 SOC', units: '%', reg: { addr: 245, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS2 Voltage', units: 'V', reg: { addr: 246, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS2 Current', units: 'A', reg: { addr: 247, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS2 Temp', units: 'C', reg: { addr: 248, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'BMS2 Charging Max Current', units: 'A', reg: { addr: 249, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'BMS2 Discharge Max Current', units: 'A', reg: { addr: 250, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  { name: 'Time of Use Weekly Selling Schedule', units: '', reg: { addr: 146, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 1', units: '', reg: { addr: 148, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 2', units: '', reg: { addr: 149, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 3', units: '', reg: { addr: 150, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 4', units: '', reg: { addr: 151, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 5', units: '', reg: { addr: 152, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Time 6', units: '', reg: { addr: 153, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Power 1', units: 'W', reg: { addr: 154, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Power 2', units: 'W', reg: { addr: 155, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Power 3', units: 'W', reg: { addr: 156, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Power 4', units: 'W', reg: { addr: 157, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Power 5', units: 'W', reg: { addr: 158, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Power 6', units: 'W', reg: { addr: 159, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 10 },
  { name: 'Time of Use Voltage 1', units: 'V', reg: { addr: 160, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use Voltage 2', units: 'V', reg: { addr: 161, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use Voltage 3', units: 'V', reg: { addr: 162, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use Voltage 4', units: 'V', reg: { addr: 163, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use Voltage 5', units: 'V', reg: { addr: 164, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use Voltage 6', units: 'V', reg: { addr: 165, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Time of Use SOC 1', units: '%', reg: { addr: 166, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 2', units: '%', reg: { addr: 167, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 3', units: '%', reg: { addr: 168, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 4', units: '%', reg: { addr: 169, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 5', units: '%', reg: { addr: 170, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use SOC 6', units: '%', reg: { addr: 171, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 1', units: '', reg: { addr: 172, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 2', units: '', reg: { addr: 173, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 3', units: '', reg: { addr: 174, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 4', units: '', reg: { addr: 175, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 5', units: '', reg: { addr: 176, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Time of Use Charge Enable 6', units: '', reg: { addr: 177, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },

  { name: 'Phase voltage of Gen port L1', units: 'V', reg: { addr: 661, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Phase voltage of Gen port L2', units: 'V', reg: { addr: 662, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Phase voltage of Gen port L3', units: 'V', reg: { addr: 663, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Phase power of Gen port L1', units: 'W', reg: { addr: 664, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Phase power of Gen port L2', units: 'W', reg: { addr: 665, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Phase power of Gen port L3', units: 'W', reg: { addr: 666, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Total Power of Gen Ports', units: 'W', vcKey: 'totalGenPower', reg: { addr: 667, rtype: ModbusController.REGTYPE_HOLDING, itype: 'i16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1 },
  { name: 'Daily Generator Production', units: 'kWh', reg: { addr: 536, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 },
  { name: 'Total Generator Production', units: 'kWh', reg: { addr: 537, rtype: ModbusController.REGTYPE_HOLDING, itype: 'u16', bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1 }
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
      { id: 200, name: 'Deye SG01HP3', components: groupMembers }
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
  print('Deye SG01HP3 MODBUS-RTU monitor + VC');

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
