/**
 * @title MarsRock G2 SUN Series Grid-Tie Inverter - MODBUS-RTU reader
 * @description Reads AC output power, grid voltage, DC input voltage, and
 *   temperature from a MarsRock G2 (Generation 2) SUN Series grid-tie
 *   micro-inverter over MODBUS-RTU and prints values to the console.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/MarsRock/G2_SUN_Series_Grid_Tie_Inverter/get_live_status.shelly.js
 */

/**
 * MarsRock G2 (Generation 2) SUN Series Grid-Tie Micro-Inverter
 * MODBUS-RTU Reader
 *
 * Communication parameters (factory defaults):
 *   Slave ID  : 1  (configurable 1–16 via jumpers J1–J4 on the RS485 module)
 *   Baud rate : 9600
 *   Mode      : 8N1
 *
 * Register map (FC 0x03 – Read Holding Registers):
 *
 *   Addr  Name                  Type    Scale  Unit   Access  Notes
 *   ----  --------------------  ------  -----  -----  ------  ----------------------
 *   0x00  AC Power Setpoint     UINT16  ×10    W      W       Set inverter output power
 *   0x01  AC Output Power       UINT16  ×10    W      R       Displayed AC output power
 *   0x02  Grid Voltage          UINT16  ×10    V      R       Grid (AC) voltage
 *   0x03  DC Input Voltage      UINT16  ×10    V      R       Solar panel / DC bus voltage
 *   0x04  DAC Value             UINT16  raw    -      R/W     Analog control output (0–33187)
 *   0x05  Calibration Control   UINT16  -      -      W       Write 0x01 to start calibration
 *   0x06  AC Power Mirror       UINT16  ×10    W      R       Mirror of register 0x00 (FW ≥ 1.06)
 *   0x07  Temperature           UINT16  1      °C     R       Inverter temperature (FW ≥ 1.06)
 *
 * Example frame (read AC output power, register 0x01, slave 0x01):
 *   TX: 01 03 00 01 00 01 D5 CA
 *   RX: 01 03 02 03 E8 xx xx  -> 0x03E8 = 1000 → 100.0 W
 *
 * The Pill 5-Terminal Add-on wiring:
 *   IO1 (TX)  --- B (D-)   --> Inverter RS485 B
 *   IO2 (RX)  --- A (D+)   --> Inverter RS485 A
 *   IO3       --- DE/RE        direction control (automatic)
 *   GND       --- GND      --> Inverter GND
 *
 * Reference:
 *   https://marsrock.com.cn/u_file/2405/09/file/G2SeriesMicroinverterSolarUserManual.pdf
 *   https://github.com/trucki-eu/RS485-Interface-for-Sun-GTIL2-1000
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
var MODBUS_ENDPOINT_OPTS = { baud: 9600, mode: "8N1" };

function rebuildModbusEndpoint() {
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), MODBUS_ENDPOINT_OPTS);
  registerEntities(MODBUS_ENDPOINT, ENTITIES_INVERTER);
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
    { id: 299, name: 'MarsRock G2 SUN Slave ID', components: ['slaveId'] }
  ]
};

var vcHandles = null;


// Inverter (AC Output) register map
let ENTITIES_INVERTER = [
    { key: "AC_OUTPUT_POWER",   name: "AC Output Power",   units: "W",  reg: { addr: 0x01, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.LE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "AC_GRID_VOLTAGE",   name: "AC Grid Voltage",   units: "V",  reg: { addr: 70, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "DC_INPUT_VOLTAGE",  name: "DC Input Voltage",  units: "V",  reg: { addr: 109, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 0.1, rights: "R", vcId: null, handle: null, vcHandle: null },
    { key: "DAC_VALUE",         name: "DAC Value",         units: "-",  reg: { addr: 0x04, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, rights: "RW", vcId: null, handle: null, vcHandle: null },
    { key: "TEMPERATURE",       name: "Temperature",       units: "C",  reg: { addr: 63, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16", bo: ModbusController.BE, wo: ModbusController.BE }, scale: 1, offset: 2, rights: "R", vcId: null, handle: null, vcHandle: null },
];


// Registers all MODBUS entities from ENTITIES_INVERTER[].
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
  for (var name in ENTITIES_INVERTER) {
    value = ENTITIES_INVERTER[name].entity.getValue() * ENTITIES_INVERTER[name].scale;
    if (ENTITIES_INVERTER[name].offset !== undefined) {
      value += ENTITIES_INVERTER[name].offset;
    }
    console.log(ENTITIES_INVERTER[name].name + ": " +
    value +
    "[" + ENTITIES_INVERTER[name].units + "]");
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
