/**
 * @title WB-M1W2 v3 MODBUS-RTU Reader
 * @description MODBUS-RTU reader for Wirenboard WB-M1W2 v3 1-Wire to RS-485
 *   converter using the native Shelly ModbusController. Reads two external
 *   DS18B20 1-Wire channels, discrete input states, sensor presence flags,
 *   supply voltage, and pulse counters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/wirenboard/WB-M1W2-v3/wb_m1w2_v3.shelly.js
 */

/**
 * Wirenboard WB-M1W2 v3 - MODBUS-RTU Reader
 *
 * WB-M1W2 v3 features:
 *   - Two universal inputs, each supporting up to 20 DS18B20 1-Wire sensors in parallel
 *   - Built-in NTC thermistor for internal/ambient temperature
 *   - Discrete input detection with debounce and pulse counting
 *   - RS485 MODBUS-RTU slave (9-28 V supply)
 *
 * Default RS485 settings: 9600 baud, 8N2, Slave ID 1 (printed on device label).
 * NOTE: factory default stop-bits = 2, so mode is "8N2" not "8N1".
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * References:
 *   WB-M1W2 Product Page:  https://wirenboard.com/en/product/WB-M1W2/
 *   WB-M1W2 Wiki (EN):     https://wiki.wirenboard.com/wiki/WB-M1W2_1-Wire_to_Modbus_Temperature_Measurement_Module/en
 */

// Update rate (sec)
var UPDATE_RATE = 5;

// Get a MODBUS-RTU endpoint: ID 13, baud rate 9600, 8N2.
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
var DEFAULT_SLAVE_ID = 13;
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
var MODBUS_ENDPOINT_OPTS = { baud: 9600, mode: "8N2" };

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), MODBUS_ENDPOINT_OPTS);
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
    { id: 299, name: 'WB-M1W2-v3 Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


let ENTITIES = [
  // --- Discrete Inputs (FC 0x02) ---
  { name: "Input #1 State", units: "", reg: { addr: 0, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Input #2 State", units: "", reg: { addr: 1, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Sensor #1 Status", units: "", reg: { addr: 16, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  { name: "Sensor #2 Status", units: "", reg: { addr: 17, rtype: ModbusController.REGTYPE_DISCRETEINPUT, itype: "i16" }, scale: 1, rights: "R" },
  // --- Input Registers (FC 0x04) - read-only sensor data ---
  { name: "NTC Temperature", units: "degC", reg: { addr: 6, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Ch1 Temperature", units: "degC", reg: { addr: 7, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Ch2 Temperature", units: "degC", reg: { addr: 8, rtype: ModbusController.REGTYPE_INPUT, itype: "i16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "R" },
  { name: "Supply Voltage", units: "mV", reg: { addr: 121, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Counter Ch1", units: "", reg: { addr: 277, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  { name: "Counter Ch2", units: "", reg: { addr: 278, rtype: ModbusController.REGTYPE_INPUT, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "R" },
  // --- Holding Registers (FC 0x03) - configuration (read FC3, write FC6/FC16) ---
  { name: "Filter Threshold", units: "degC", reg: { addr: 99, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.0625, rights: "RW" },
  { name: "Baud Rate", units: "bps", reg: { addr: 110, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 100, rights: "RW" },
  { name: "Parity", units: "", reg: { addr: 111, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Stop Bits", units: "", reg: { addr: 112, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Reset", units: "", reg: { addr: 120, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Slave Address", units: "", reg: { addr: 128, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Input #1 Mode", units: "", reg: { addr: 275, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" },
  { name: "Input #2 Mode", units: "", reg: { addr: 276, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW" }
];

// Registers all MODBUS entities from ENTITIES[].
function registerEntities(endpoint, entities) {
  var i;
  for (i = 0; i < entities.length; i++) {
    entities[i].entity = endpoint.addEntity(entities[i].reg);
  }
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  var i;
  var value;
  var raw;

  console.log("--- WB-M1W2 v3 ---");

  for (i = 0; i < ENTITIES.length; i++) {
    raw = ENTITIES[i].entity.getValue();

    if ((ENTITIES[i].name === "Ch1 Temperature" || ENTITIES[i].name === "Ch2 Temperature" || ENTITIES[i].name === "NTC Temperature") && raw === 0x7FFF) {
      console.log(ENTITIES[i].name + ": absent/error");
      continue;
    }

    value = raw * ENTITIES[i].scale;
    console.log(ENTITIES[i].name + ": " + value + " [" + ENTITIES[i].units + "]");
  }
}

/*
    Runs once at script start time.
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

// Run the application.
init();
