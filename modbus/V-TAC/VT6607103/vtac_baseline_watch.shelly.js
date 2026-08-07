/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher
 * @description Polls all currently known readable holding registers from the
 *   V-TAC VT-66036103 using the native Shelly ModbusController and compares
 *   them against embedded baseline values captured from local discovery.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_baseline_watch.shelly.js
 */

/**
 * V-TAC VT-66036103 Baseline MODBUS Watcher
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Latest working hypotheses from live testing:
 * - 5776 (0x1690) = pv1_voltage, scale 0.1 V
 * - 5778 (0x1692) = pv2_voltage, scale 0.1 V
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5788 (0x169C) = igbt_temperature, scale 0.01 degC
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 *
 * All blocks below use FC 0x03 (Read Holding Registers). Each block is
 * "start,len,nz" where nz is an optional "offset=baseline|offset=baseline"
 * list of non-zero baseline values (omitted offsets default to baseline 0).
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: "8N1",
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60
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
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), { baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE });
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
    { id: 299, name: 'V-TAC VT6607103 Baseline Watch Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;

var BLOCKS = [
  "5632,12,",
  "5664,1,",
  "5674,1,",
  "5684,1,",
  "5694,1,",
  "5704,1,",
  "5714,1,",
  "5724,1,",
  "5734,1,",
  "5744,1,0=4",
  "5752,1,0=6405",
  "5756,3,0=7",
  "5760,16,",
  "5777,1,",
  "5779,5,",
  "5785,1,",
  "5787,3,0=1|1=10|2=1",
  "5791,1,",
  "5793,2,0=100",
  "5796,1,",
  "5798,4,0=240|1=540|2=240",
  "5804,1,",
  "5810,1,",
  "5824,8,0=7|2=9|4=7|6=10",
  "5873,2,",
  "5936,1,",
  "5960,1,"
];

var state = {
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0
};

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

function makeKey(addr) {
  return "" + addr;
}

function parseBlock(s) {
  var parts = s.split(",");
  return {
    start: JSON.parse(parts[0]),
    len: JSON.parse(parts[1]),
    nz: parts.length > 2 ? parts[2] : ""
  };
}

function baselineAt(block, offset) {
  if (block.nz === "") return 0;
  var items = block.nz.split("|");
  var i;
  for (i = 0; i < items.length; i++) {
    var kv = items[i].split("=");
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function handleValue(addr, baseline, raw) {
  var key = makeKey(addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print("[HOLDING] CHANGED addr=" + addr + " (0x" + toHex16(addr) + ") default=" + baseline + " current=" + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print("[HOLDING] RESTORED addr=" + addr + " (0x" + toHex16(addr) + ") value=" + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print("[V-TAC] Previous cycle still running; skipping this interval");
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    var block;

    if (index >= BLOCKS.length) {
      print("[V-TAC] Cycle done: blocks=" + BLOCKS.length + " deviations=" + state.cycleDeviations + " errors=" + state.cycleErrors);
      print("");
      state.cycleRunning = false;
      return;
    }

    block = parseBlock(BLOCKS[index]);
    MODBUS_ENDPOINT.readRegisters({ rtype: ModbusController.REGTYPE_HOLDING, addr: block.start, qty: block.len }, function(result, error) {
      if (result === undefined || result === null) {
        state.cycleErrors++;
        print("[HOLDING] ERROR addr=" + block.start + " qty=" + block.len + " (" + error + ")");
      } else {
        processBlock(block, result);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print("[V-TAC] Starting baseline comparison cycle");
  readNext(0);
}

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

    print("V-TAC VT-66036103 baseline MODBUS watcher");
    print("==========================================");
    print("Baseline blocks: " + BLOCKS.length);
    print("Polling every " + CONFIG.POLL_INTERVAL / 1000 + "s");
    print("");

    Timer.set(500, false, runCycle);
    Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);
  });
}

init();
