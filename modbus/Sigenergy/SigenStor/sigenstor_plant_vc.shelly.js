/**
 * @title Sigenergy SigenStor MODBUS-RTU plant monitor
 * @description Reads SigenStor plant PV, battery, grid, load, SOC, and grid-state values into Virtual Components.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Sigenergy/SigenStor/sigenstor_plant_vc.shelly.js
 */

/**
 * Sigenergy SigenStor MODBUS-RTU Plant Monitor
 *
 * Firmware requirements: Shelly Pro firmware with scripting, Virtual
 * Components, Shelly Pro RS485 Addon, and `MbRtuClient.*` RPC support.
 *
 * Hardware:
 * - Shelly Pro device with Shelly Pro RS485 Addon
 * - Sigenergy RS485-1 wired to the RS485 Addon:
 *   - A+  -> pin 15
 *   - B-  -> pin 16
 *   - GND -> pin 11
 *
 * Required device configuration:
 * - Shelly Pro RS485 Addon present
 * - Serial id 100 configured as MODBUS client (`mb_client`)
 * - Serial settings: 9600 baud, 8N1
 * - Sigenergy MODBUS enabled by installer
 * - Sigenergy RS485-1 configured as MODBUS-RTU slave, 9600 8N1
 *
 * Virtual Components created:
 * - group:200    Sigenergy SigenStor
 * - number:200   PV Power, W
 * - number:201   Battery SOC, %
 * - number:202   Battery Power, W, positive means charging
 * - number:203   Grid Power, W, positive means export
 * - number:204   Load Power, W
 * - boolean:200  On Grid
 *
 * Protocol notes:
 * - Sigenergy plant data uses MODBUS slave ID 247.
 * - Registers are read with FC04 (`MbRtuClient.ReadInputRegisters`).
 * - PDU address is the full register number from the Sigenergy protocol.
 * - If reads return `-115` with `id 0`, A/B is commonly reversed.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  serialId: 100,
  slaveId: 247,
  pollMs: 1000,
  heartbeatEvery: 10,
};

var COMPONENT_IDS = {
  group: 200,
  pvPower: 200,
  batterySoc: 201,
  batteryPower: 202,
  gridPower: 203,
  loadPower: 204,
  onGrid: 200,
};

var COMPONENTS = [
  {
    type: 'number',
    id: COMPONENT_IDS.pvPower,
    key: 'number:' + COMPONENT_IDS.pvPower,
    name: 'PV Power',
    unit: 'W',
    min: 0,
    max: 50000,
    step: 1,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.batterySoc,
    key: 'number:' + COMPONENT_IDS.batterySoc,
    name: 'Battery SOC',
    unit: '%',
    min: 0,
    max: 100,
    step: 0.1,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.batteryPower,
    key: 'number:' + COMPONENT_IDS.batteryPower,
    name: 'Battery Power',
    unit: 'W',
    min: -50000,
    max: 50000,
    step: 1,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.gridPower,
    key: 'number:' + COMPONENT_IDS.gridPower,
    name: 'Grid Power',
    unit: 'W',
    min: -50000,
    max: 50000,
    step: 1,
    vcHandle: null,
  },
  {
    type: 'number',
    id: COMPONENT_IDS.loadPower,
    key: 'number:' + COMPONENT_IDS.loadPower,
    name: 'Load Power',
    unit: 'W',
    min: 0,
    max: 50000,
    step: 1,
    vcHandle: null,
  },
  {
    type: 'boolean',
    id: COMPONENT_IDS.onGrid,
    key: 'boolean:' + COMPONENT_IDS.onGrid,
    name: 'On Grid',
    vcHandle: null,
  },
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  tick: 0,
  pollTimer: null,
  pollActive: false,
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[sigenstor-vc] ' + msg);
}

function s32(hi, lo) {
  var value = hi * 65536 + lo;
  if (value > 2147483647) value = value - 4294967296;
  return value;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function componentConfig(component) {
  if (component.type === 'boolean') {
    return {
      name: component.name,
      default_value: false,
      meta: {
        ui: {
          titles: {
            'false': 'off-grid',
            'true': 'on-grid',
          },
        },
        persist: false,
      },
    };
  }

  return {
    name: component.name,
    default_value: 0,
    min: component.min,
    max: component.max,
    meta: {
      ui: {
        view: 'progressbar',
        unit: component.unit,
        step: component.step,
      },
      persist: false,
    },
  };
}

function setComponent(component, value) {
  if (!component.vcHandle) {
    component.vcHandle = Virtual.getHandle(component.key);
  }

  if (!component.vcHandle) {
    log('Missing Virtual Component ' + component.key);
    return;
  }

  component.vcHandle.setValue(value);
}

function findComponent(key) {
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    if (COMPONENTS[i].key === key) return COMPONENTS[i];
  }

  return null;
}

function setNumber(id, value) {
  var component = findComponent('number:' + id);
  if (component) setComponent(component, value);
}

function setBoolean(id, value) {
  var component = findComponent('boolean:' + id);
  if (component) setComponent(component, value);
}

function schedulePoll() {
  if (state.pollTimer) Timer.clear(state.pollTimer);
  state.pollTimer = Timer.set(CONFIG.pollMs, false, poll);
}

// ============================================================================
// VIRTUAL COMPONENT SETUP
// ============================================================================

function ensureComponent(type, id, config, cb) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finalize() {
    var finalHandle = Virtual.getHandle(key);
    if (!finalHandle) {
      log('Failed to get handle for ' + key);
      cb(false);
      return;
    }

    finalHandle.setConfig(config);
    cb(true);
  }

  if (handle) {
    handle.setConfig(config);
    cb(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      cb(false);
      return;
    }

    finalize();
  });
}

function setGroupMembers(done) {
  var members = [];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) members.push(COMPONENTS[i].key);

  Shelly.call('Group.Set', { id: COMPONENT_IDS.group, value: members }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Group.Set failed: ' + errCode + ' ' + errMsg);
    }

    done();
  });
}

function setupComponents(done) {
  var specs = [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: { name: 'Sigenergy SigenStor' },
    },
  ];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    specs.push({
      type: COMPONENTS[i].type,
      id: COMPONENTS[i].id,
      config: componentConfig(COMPONENTS[i]),
    });
  }

  function next(index) {
    if (index >= specs.length) {
      for (i = 0; i < COMPONENTS.length; i++) {
        COMPONENTS[i].vcHandle = Virtual.getHandle(COMPONENTS[i].key);
      }
      setGroupMembers(done);
      return;
    }

    ensureComponent(specs[index].type, specs[index].id, specs[index].config, function() {
      Timer.set(80, false, function() {
        next(index + 1);
      });
    });
  }

  next(0);
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function readInputRegisters(addr, qty, cb) {
  Shelly.call(
    'MbRtuClient.ReadInputRegisters',
    { id: CONFIG.serialId, sid: CONFIG.slaveId, addr: addr, qty: qty },
    function(res, errCode, errMsg) {
      if (errCode !== 0 || !res || !res.values) {
        cb(null, errCode, errMsg);
        return;
      }

      cb(res.values, 0, null);
    }
  );
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  if (state.pollActive) return;
  state.pollActive = true;

  readInputRegisters(30005, 10, function(a, errA, msgA) {
    var grid;
    var onGridRaw;
    var soc;

    if (!a) {
      log('read block A failed: ' + errA + ' ' + msgA);
      state.pollActive = false;
      schedulePoll();
      return;
    }

    grid = s32(a[0], a[1]);
    onGridRaw = a[4];
    soc = round1(a[9] / 10);

    readInputRegisters(30035, 4, function(b, errB, msgB) {
      var pv;
      var battery;
      var gridExport;
      var load;
      var onGrid;

      if (!b) {
        log('read block B failed: ' + errB + ' ' + msgB);
        state.pollActive = false;
        schedulePoll();
        return;
      }

      pv = s32(b[0], b[1]);
      battery = s32(b[2], b[3]);
      gridExport = -grid;
      load = pv + grid - battery;
      if (load < 0) load = 0;
      onGrid = onGridRaw === 0;

      setNumber(COMPONENT_IDS.pvPower, pv);
      setNumber(COMPONENT_IDS.batterySoc, soc);
      setNumber(COMPONENT_IDS.batteryPower, battery);
      setNumber(COMPONENT_IDS.gridPower, gridExport);
      setNumber(COMPONENT_IDS.loadPower, load);
      setBoolean(COMPONENT_IDS.onGrid, onGrid);

      state.tick++;
      if (state.tick % CONFIG.heartbeatEvery === 0) {
        log(
          'PV=' +
            pv +
            'W SOC=' +
            soc +
            '% Bat=' +
            battery +
            'W Grid=' +
            gridExport +
            'W Load=' +
            load +
            'W OnGrid=' +
            onGrid
        );
      }

      state.pollActive = false;
      schedulePoll();
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Sigenergy SigenStor MODBUS monitor');
  log('Serial=' + CONFIG.serialId + ' Slave=' + CONFIG.slaveId + ' Poll=' + CONFIG.pollMs + 'ms');

  setupComponents(function() {
    log('Virtual Components ready');
    poll();
  });
}

init();
