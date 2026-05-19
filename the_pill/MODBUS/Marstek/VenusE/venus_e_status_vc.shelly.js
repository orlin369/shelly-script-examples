/**
 * @title Marstek VenusE status MODBUS-RTU reader + Virtual Components
 * @description Reads Marstek VenusE SOC, charge/discharge limits,
 *   temperatures, daily energy, operating state, and alarm/fault count.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e_status_vc.shelly.js
 */

/**
 * Marstek VenusE Status MODBUS-RTU Reader + Virtual Components
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting, UART, and Virtual
 * Components support.
 *
 * Virtual Components created:
 * - group:220   Marstek VenusE Status
 * - number:220  Battery SOC, 0..100 %
 * - number:221  Charge Current Limit, 0..100 A
 * - number:222  Discharge Current Limit, 0..100 A
 * - number:223  Internal Temperature, -10..55 C
 * - number:224  Max Cell Temperature, -10..80 C
 * - number:225  Daily Charging Energy, 0..100 kWh
 * - number:226  Daily Discharging Energy, 0..100 kWh
 * - number:227  Inverter State, 0..6
 * - number:228  Alarm/Fault Count, 0..45 active bits
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This VC variant is read-only. It does not write control registers.
 * - The alarm/fault component is a count of active bits across registers
 *   36000, 36001, 36100, 36101, 36103, and 36104.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 115200,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1000,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 80,
  DEBUG: false,
};

var COMPONENT_IDS = {
  group: 220,
  firstNumber: 220,
};

var COMPONENTS = [
  { name: 'Battery SOC', addr: 32104, qty: 1, type: 'u16', scale: 1, unit: '%', min: 0, max: 100, vcId: 'number:220', vcHandle: null },
  { name: 'Charge Current Limit', addr: 35111, qty: 1, type: 'u16', scale: 0.1, unit: 'A', min: 0, max: 100, vcId: 'number:221', vcHandle: null },
  { name: 'Discharge Current Limit', addr: 35112, qty: 1, type: 'u16', scale: 0.1, unit: 'A', min: 0, max: 100, vcId: 'number:222', vcHandle: null },
  { name: 'Internal Temperature', addr: 35000, qty: 1, type: 's16', scale: 0.1, unit: 'C', min: -10, max: 55, vcId: 'number:223', vcHandle: null },
  { name: 'Max Cell Temperature', addr: 35010, qty: 1, type: 's16', scale: 0.1, unit: 'C', min: -10, max: 80, vcId: 'number:224', vcHandle: null },
  { name: 'Daily Charging Energy', addr: 33004, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh', min: 0, max: 100, vcId: 'number:225', vcHandle: null },
  { name: 'Daily Discharging Energy', addr: 33006, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh', min: 0, max: 100, vcId: 'number:226', vcHandle: null },
  { name: 'Inverter State', addr: 35100, qty: 1, type: 'u16', scale: 1, unit: '', min: 0, max: 6, vcId: 'number:227', vcHandle: null },
  { name: 'Alarm/Fault Count', computed: true, scale: 1, unit: '', min: 0, max: 45, vcId: 'number:228', vcHandle: null },
];

var ALARM_FAULT_REGS = [
  { name: 'Alarm Word 36000', addr: 36000, qty: 1, type: 'u16' },
  { name: 'Alarm Word 36001', addr: 36001, qty: 1, type: 'u16' },
  { name: 'Fault Word 36100', addr: 36100, qty: 1, type: 'u16' },
  { name: 'Fault Word 36101', addr: 36101, qty: 1, type: 'u16' },
  { name: 'Fault Word 36103', addr: 36103, qty: 1, type: 'u16' },
  { name: 'Fault Word 36104', addr: 36104, qty: 1, type: 'u16' },
];

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  isReady: false,
};

// ============================================================================
// HELPERS
// ============================================================================

function log(msg) {
  print('[venus-e-status-vc] ' + msg);
}

function debug(msg) {
  if (CONFIG.DEBUG) log(msg);
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  var j;

  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    for (j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc = crc >> 1;
    }
  }

  return crc & 0xFFFF;
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function buildReadFrame(addr, qty) {
  var frame = [
    CONFIG.SLAVE_ID & 0xFF,
    0x03,
    (addr >> 8) & 0xFF,
    addr & 0xFF,
    (qty >> 8) & 0xFF,
    qty & 0xFF,
  ];
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function clearResponseTimer() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function decodePayload(payload, type) {
  var raw16;
  var hi;
  var lo;
  var value;

  if (type === 'u16' || type === 's16') {
    raw16 = (payload[0] << 8) | payload[1];
    if (type === 's16' && raw16 >= 0x8000) raw16 = raw16 - 0x10000;
    return raw16;
  }

  hi = (payload[0] << 8) | payload[1];
  lo = (payload[2] << 8) | payload[3];
  value = hi * 65536 + lo;

  if (type === 's32' && value >= 2147483648) value = value - 4294967296;
  return value;
}

function scaledValue(raw, scale) {
  var value = raw * scale;
  if (scale === 0.1) return Math.round(value * 10) / 10;
  if (scale === 0.01) return Math.round(value * 100) / 100;
  if (scale === 0.001) return Math.round(value * 1000) / 1000;
  return value;
}

function countBits(value) {
  var n = value & 0xFFFF;
  var count = 0;

  while (n > 0) {
    if (n & 1) count++;
    n = n >> 1;
  }

  return count;
}

function stateName(raw) {
  if (raw === 0) return 'sleep';
  if (raw === 1) return 'standby';
  if (raw === 2) return 'charge';
  if (raw === 3) return 'discharge';
  if (raw === 4) return 'backup mode';
  if (raw === 5) return 'OTA upgrade';
  if (raw === 6) return 'bypass';
  return 'unknown';
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

function numberConfig(component) {
  return {
    name: component.name,
    default_value: 0,
    min: component.min,
    max: component.max,
    meta: {
      ui: {
        view: 'progressbar',
        unit: component.unit,
        step: component.scale < 1 ? component.scale : 1,
      },
      persist: false,
    },
  };
}

function setupComponents(done) {
  var specs = [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: { name: 'Marstek VenusE Status' },
    },
  ];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) {
    specs.push({
      type: 'number',
      id: COMPONENT_IDS.firstNumber + i,
      config: numberConfig(COMPONENTS[i]),
    });
  }

  function next(index) {
    if (index >= specs.length) {
      for (i = 0; i < COMPONENTS.length; i++) {
        COMPONENTS[i].vcHandle = Virtual.getHandle(COMPONENTS[i].vcId);
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

function setGroupMembers(done) {
  var members = [];
  var i;

  for (i = 0; i < COMPONENTS.length; i++) members.push(COMPONENTS[i].vcId);

  Shelly.call('Group.Set', { id: COMPONENT_IDS.group, value: members }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Group.Set failed: ' + errCode + ' ' + errMsg);
    }

    done();
  });
}

function updateVc(component, value) {
  if (!component.vcHandle) return;
  component.vcHandle.setValue(value);
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRead(request, callback) {
  if (!state.isReady) {
    callback('Not ready', null);
    return;
  }

  if (state.pendingRequest) {
    callback('Busy', null);
    return;
  }

  state.pendingRequest = { request: request, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (!state.pendingRequest) return;
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    cb('Timeout', null);
  });

  debug('Read addr=' + request.addr + ' qty=' + request.qty);
  state.uart.write(bytesToStr(buildReadFrame(request.addr, request.qty)));
}

function onReceive(data) {
  var i;
  if (!data || data.length === 0) return;

  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  var fc;
  var byteCount;
  var expectedLen;
  var frame;
  var crc;
  var recvCrc;
  var payload;
  var request;
  var cb;

  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;
  fc = state.rxBuffer[1];

  if (fc & 0x80) {
    if (state.rxBuffer.length < 5) return;
    crc = calcCRC(state.rxBuffer.slice(0, 3));
    recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (crc !== recvCrc) return;

    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('MODBUS exception', null);
    return;
  }

  byteCount = state.rxBuffer[2];
  expectedLen = 3 + byteCount + 2;
  if (state.rxBuffer.length < expectedLen) return;

  frame = state.rxBuffer.slice(0, expectedLen);
  crc = calcCRC(frame.slice(0, expectedLen - 2));
  recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimer();
  payload = frame.slice(3, 3 + byteCount);
  request = state.pendingRequest.request;
  cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  cb(null, decodePayload(payload, request.type));
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  var alarmFaultCount = 0;

  function readComponent(index) {
    var component;

    if (index >= COMPONENTS.length) {
      readAlarmFault(0);
      return;
    }

    component = COMPONENTS[index];
    if (component.computed) {
      readComponent(index + 1);
      return;
    }

    sendRead(component, function(err, raw) {
      var value;

      if (err) {
        log(component.name + ': ERROR (' + err + ')');
      } else {
        value = scaledValue(raw, component.scale);
        updateVc(component, value);
        if (component.name === 'Inverter State') {
          log(component.name + ': ' + raw + ' (' + stateName(raw) + ')');
        }
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readComponent(index + 1);
      });
    });
  }

  function readAlarmFault(index) {
    var request;

    if (index >= ALARM_FAULT_REGS.length) {
      updateVc(COMPONENTS[8], alarmFaultCount);
      log('Alarm/Fault Count: ' + alarmFaultCount);
      log('Poll complete');
      return;
    }

    request = ALARM_FAULT_REGS[index];
    sendRead(request, function(err, raw) {
      if (err) {
        log(request.name + ': ERROR (' + err + ')');
      } else {
        alarmFaultCount += countBits(raw);
        if (raw !== 0) log(request.name + ': 0x' + raw.toString(16));
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readAlarmFault(index + 1);
      });
    });
  }

  readComponent(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Marstek VenusE status MODBUS-RTU reader + VC');

  state.uart = UART.get();
  if (!state.uart) {
    log('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    log('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);
  state.isReady = true;

  setupComponents(function() {
    log('Polling ' + COMPONENTS.length + ' components every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
    Timer.set(500, false, poll);
    state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
  });
}

init();
