/**
 * @title MODBUS Register Discovery Scanner
 * @description Walks a MODBUS-RTU device register space over RS485 using
 *   single-register holding/input reads via the native Shelly ModbusController.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/utils/modbus_register_scan.shelly.js
 */

/**
 * Generic MODBUS Register Discovery Scanner
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * This utility assumes the bus parameters are already known and controlled
 * from CONFIG at the top of the file.
 *
 * It probes the target register map one address at a time with quantity 1:
 * - REGTYPE_HOLDING, configured address range
 * - REGTYPE_INPUT,   configured address range
 *
 * Output behavior:
 * - Successful reads print the register address and 16-bit value
 * - Exception and timeout counts are reported only in the final summary
 *
 * This is intentionally slow and explicit because the goal is discovery, not
 * production polling. Once useful registers are identified, use those results
 * to build a dedicated reader script.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATES: [9600],
  MODE: "8N1",

  RTYPE_LIST: [ModbusController.REGTYPE_HOLDING, ModbusController.REGTYPE_INPUT],
  ADDR_START: 0,
  ADDR_END: 5000,
  QTY: 1,

  RESPONSE_TIMEOUT_MS: 400,
  INTER_FRAME_MS: 40
};

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
//
// Unlike modbus_scan.shelly.js, this utility targets ONE already-addressed
// device and sweeps register addresses/baud rates, not slave IDs, so it fits
// the single-target-device dynamic-ID model.

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
    { id: 299, name: 'MODBUS Register Discovery Scanner Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;

var state = {
  baudIdx: 0,
  rtypeIdx: 0,
  addr: CONFIG.ADDR_START,
  results: {},
  readable: {}
};

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

function currentRtype() {
  return CONFIG.RTYPE_LIST[state.rtypeIdx];
}

function currentBaud() {
  return CONFIG.BAUD_RATES[state.baudIdx];
}

function currentLabel() {
  return currentRtype() === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT";
}

function currentBucket() {
  return currentBaud() + "/" + currentLabel();
}

function currentReadableKey() {
  return currentBaud() + "_" + currentLabel().toLowerCase();
}

function printResult(status, extra) {
  var line = "[" + currentBaud() + "][" + currentLabel() + "] addr=" + state.addr + " (0x" + toHex16(state.addr) + ") -> " + status;
  if (extra) line += " " + extra;
  print(line);
}

function ensureResultBuckets() {
  var i;
  var j;
  var key;
  var readableKey;

  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    for (j = 0; j < CONFIG.RTYPE_LIST.length; j++) {
      key = CONFIG.BAUD_RATES[i] + "/" + (CONFIG.RTYPE_LIST[j] === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT");
      if (!state.results[key]) {
        state.results[key] = { ok: 0, exception: 0, timeout: 0 };
      }
      readableKey = CONFIG.BAUD_RATES[i] + "_" + (CONFIG.RTYPE_LIST[j] === ModbusController.REGTYPE_HOLDING ? "holding" : "input");
      if (!state.readable[readableKey]) {
        state.readable[readableKey] = [];
      }
    }
  }
}

function sendRead() {
  var endpoint = ModbusController.get(getSlaveId(), { baud: currentBaud(), mode: CONFIG.MODE });
  var timedOut = false;
  var timer;
  var bucket = state.results[currentBucket()];

  timer = Timer.set(CONFIG.RESPONSE_TIMEOUT_MS, false, function() {
    timedOut = true;
    bucket.timeout++;
    advance();
  });

  endpoint.readRegisters({ rtype: currentRtype(), addr: state.addr, qty: CONFIG.QTY }, function(result, error) {
    if (timedOut) return;
    Timer.clear(timer);

    if (result !== undefined && result !== null && result.length > 0) {
      bucket.ok++;
      state.readable[currentReadableKey()].push(state.addr);
      printResult("OK", "value=" + result[0] + " hex=0x" + toHex16(result[0]));
    } else {
      bucket.exception++;
    }

    advance();
  });
}

function advance() {
  state.addr++;

  if (state.addr > CONFIG.ADDR_END) {
    state.rtypeIdx++;
    if (state.rtypeIdx >= CONFIG.RTYPE_LIST.length) {
      state.rtypeIdx = 0;
      state.baudIdx++;
      if (state.baudIdx >= CONFIG.BAUD_RATES.length) {
        printSummary();
        return;
      }
      print("");
      print("=== Switching to baud " + currentBaud() + " ===");
    }

    state.addr = CONFIG.ADDR_START;
    print("");
    print("--- " + currentBaud() + " / " + currentLabel() + " REGISTERS ---");
  }

  Timer.set(CONFIG.INTER_FRAME_MS, false, sendRead);
}

function printFcSummary(baud, rtype) {
  var key = baud + "/" + (rtype === ModbusController.REGTYPE_HOLDING ? "HOLDING" : "INPUT");
  var item = state.results[key];
  var name = rtype === ModbusController.REGTYPE_HOLDING ? "Holding Registers" : "Input Registers";

  print(name + " (" + baud + "):");
  print("  OK: " + item.ok);
  print("  Exception: " + item.exception);
  print("  Timeout: " + item.timeout);
}

function printSummary() {
  var i;

  print("");
  print("========================================");
  print("MODBUS Register Discovery Summary");
  print("========================================");
  for (i = 0; i < CONFIG.BAUD_RATES.length; i++) {
    print("Baud " + CONFIG.BAUD_RATES[i] + ":");
    printFcSummary(CONFIG.BAUD_RATES[i], ModbusController.REGTYPE_HOLDING);
    printFcSummary(CONFIG.BAUD_RATES[i], ModbusController.REGTYPE_INPUT);
    print("  Readable holding addresses: " + state.readable[CONFIG.BAUD_RATES[i] + "_holding"].length);
    print("  Readable input addresses: " + state.readable[CONFIG.BAUD_RATES[i] + "_input"].length);
  }
  print("========================================");
}

function init() {
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;

    print("");
    print("MODBUS Register Discovery Scanner");
    print("=================================");
    print("Slave:   " + getSlaveId());
    print("UART:    " + CONFIG.BAUD_RATES.join(", ") + " " + CONFIG.MODE);
    print("Range:   " + CONFIG.ADDR_START + ".." + CONFIG.ADDR_END);
    print("Qty:     " + CONFIG.QTY);
    print("");

    ensureResultBuckets();

    print("--- " + currentBaud() + " / " + currentLabel() + " REGISTERS ---");
    Timer.set(300, false, sendRead);
  });
}

init();
