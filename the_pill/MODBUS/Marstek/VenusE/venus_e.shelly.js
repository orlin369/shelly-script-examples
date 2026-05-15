/**
 * @title Marstek VenusE MODBUS-RTU reader
 * @description Reads live battery, AC, energy, temperature, state, alarm, and
 *   limit registers from a Marstek VenusE device over MODBUS-RTU.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/Marstek/VenusE/venus_e.shelly.js
 */

/**
 * Marstek VenusE MODBUS-RTU Reader
 *
 * Firmware requirements: Shelly Gen2/Gen3 with scripting and UART access.
 * Device compatibility: The Pill with RS485 add-on connected to VenusE RS485.
 * External hardware: RS485 A/B pair, shared GND recommended.
 *
 * Register source:
 * - modbus marstek - address.csv
 * - modbus marstek - ex_info.csv
 * - Venus-E 3.0 485 Protocol v1.0, 2024-07-08
 *
 * Important:
 * - Documented communication defaults are address 1, 115200 baud, 8 data
 *   bits, no parity, and 1 stop bit.
 * - This script only reads telemetry and status registers. Writable control
 *   registers from the CSV are documented in README.md but not written here.
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

var ENTITIES = [
  { name: 'Battery Voltage', addr: 32100, qty: 1, type: 'u16', scale: 0.01, unit: 'V' },
  { name: 'Battery Current', addr: 32101, qty: 1, type: 's16', scale: 0.01, unit: 'A' },
  { name: 'Battery Power', addr: 32102, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'Battery SOC', addr: 32104, qty: 1, type: 'u16', scale: 1, unit: '%' },
  { name: 'Battery Total Energy', addr: 32105, qty: 1, type: 'u16', scale: 0.001, unit: 'kWh' },
  { name: 'AC Voltage', addr: 32200, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'AC Power', addr: 32202, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'AC Frequency', addr: 32204, qty: 1, type: 'u16', scale: 0.01, unit: 'Hz' },
  { name: 'AC Offgrid Voltage', addr: 32300, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'AC Offgrid Power', addr: 32302, qty: 2, type: 's32', scale: 1, unit: 'W' },
  { name: 'Daily Charging Energy', addr: 33004, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh' },
  { name: 'Daily Discharging Energy', addr: 33006, qty: 2, type: 'u32', scale: 0.01, unit: 'kWh' },
  { name: 'Internal Temperature', addr: 35000, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Max Cell Temperature', addr: 35010, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Min Cell Temperature', addr: 35011, qty: 1, type: 's16', scale: 0.1, unit: 'C' },
  { name: 'Inverter State', addr: 35100, qty: 1, type: 'u16', scale: 1, unit: '' },
  { name: 'Alarm Word 36000', addr: 36000, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'alarm36000' },
  { name: 'Alarm Word 36001', addr: 36001, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'alarm36001' },
  { name: 'Fault Word 36100', addr: 36100, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36100' },
  { name: 'Fault Word 36101', addr: 36101, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36101' },
  { name: 'Fault Word 36103', addr: 36103, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36103' },
  { name: 'Fault Word 36104', addr: 36104, qty: 1, type: 'u16', scale: 1, unit: '', bits: 'fault36104' },
  { name: 'Charge Voltage Limit', addr: 35110, qty: 1, type: 'u16', scale: 0.1, unit: 'V' },
  { name: 'Charge Current Limit', addr: 35111, qty: 1, type: 'u16', scale: 0.1, unit: 'A' },
  { name: 'Discharge Current Limit', addr: 35112, qty: 1, type: 'u16', scale: 0.1, unit: 'A' },
];

var BIT_NAMES = {
  alarm36000: [
    'PLL Abnormal Restart',
    'Overtemperature Limit',
    'Low Temperature Limit',
    'Fan Abnormal Warning',
    'Low Battery SOC Warning',
    'Output Overcurrent Warning',
    'Abnormal Line Sequence Detection',
  ],
  alarm36001: [
    'WIFI abnormal',
    'BLE abnormal',
    'Network abnormal',
    'CT connection abnormal',
  ],
  fault36100: [
    'Grid overvoltage',
    'Grid undervoltage',
    'Grid overfrequency',
    'Grid underfrequency',
    'Grid peak voltage abnormal',
    'Current Dcover',
    'Voltage Dcover',
  ],
  fault36101: [
    'BAT overvoltage',
    'BAT undervoltage',
    'BAT overcurrent',
    'BAT low SOC',
    'BAT communication failure',
    'BMS protect',
  ],
  fault36103: [
    'hardware Bus overvoltage',
    'hardware Output overcurrent',
    'hardware trans overcurrent',
    'hardware Battery overcurrent',
    'Hardware protection',
    'Output overcurrent',
    'High voltage bus overvoltage',
    'High voltage bus undervoltage',
    'Overpower protection',
    'FSM abnormal',
    'Overtemperature protection',
    'Inverter soft start timeout',
  ],
  fault36104: [
    'self-test fault',
    'eeprom fault',
    'other system fault',
  ],
};

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
  print('[venus-e] ' + msg);
}

function debug(msg) {
  if (CONFIG.DEBUG) log(msg);
}

function hexByte(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  var j;

  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    for (j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
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

function formatValue(value, scale) {
  var scaled = value * scale;
  if (scale === 1) return '' + scaled;
  if (scale === 0.1) return scaled.toFixed(1);
  if (scale === 0.01) return scaled.toFixed(2);
  if (scale === 0.001) return scaled.toFixed(3);
  return '' + scaled;
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

function describeBits(raw, key) {
  var names = BIT_NAMES[key];
  var active = [];
  var i;

  if (!names) return '';

  for (i = 0; i < names.length; i++) {
    if (raw & (1 << i)) active.push(names[i]);
  }

  if (active.length === 0) return 'normal';
  return active.join(', ');
}

// ============================================================================
// MODBUS CORE
// ============================================================================

function sendRead(entity, callback) {
  if (!state.isReady) {
    callback('Not ready', null);
    return;
  }

  if (state.pendingRequest) {
    callback('Busy', null);
    return;
  }

  state.pendingRequest = { entity: entity, callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (!state.pendingRequest) return;
    var cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    cb('Timeout', null);
  });

  debug('Read addr=' + entity.addr + ' qty=' + entity.qty);
  state.uart.write(bytesToStr(buildReadFrame(entity.addr, entity.qty)));
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
  var entity;
  var cb;

  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;
  fc = state.rxBuffer[1];

  if (fc & 0x80) {
    var exCode;
    if (state.rxBuffer.length < 5) return;
    crc = calcCRC(state.rxBuffer.slice(0, 3));
    recvCrc = state.rxBuffer[3] | (state.rxBuffer[4] << 8);
    if (crc !== recvCrc) return;

    exCode = state.rxBuffer[2];
    clearResponseTimer();
    cb = state.pendingRequest.callback;
    state.pendingRequest = null;
    state.rxBuffer = [];
    cb('Exception 0x' + hexByte(exCode), null);
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
  entity = state.pendingRequest.entity;
  cb = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];

  cb(null, decodePayload(payload, entity.type));
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function poll() {
  var results = [];

  function readNext(index) {
    var entity;

    if (index >= ENTITIES.length) {
      var i;
      print('--- Marstek VenusE ---');
      for (i = 0; i < results.length; i++) print(results[i]);
      print('');
      return;
    }

    entity = ENTITIES[index];
    sendRead(entity, function(err, raw) {
      var line;

      if (err) {
        results.push(entity.name + ': ERROR (' + err + ')');
      } else {
        line = entity.name + ': ' + formatValue(raw, entity.scale);
        if (entity.unit !== '') line += ' ' + entity.unit;
        line += ' raw=' + raw;
        if (entity.addr === 35100) line += ' (' + stateName(raw) + ')';
        if (entity.bits) line += ' (' + describeBits(raw, entity.bits) + ')';
        results.push(line);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  readNext(0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  log('Marstek VenusE MODBUS-RTU reader');
  log('Slave=' + CONFIG.SLAVE_ID + ' Baud=' + CONFIG.BAUD_RATE + ' Mode=' + CONFIG.MODE);

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

  log('Polling ' + ENTITIES.length + ' registers every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  Timer.set(500, false, poll);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, poll);
}

init();
