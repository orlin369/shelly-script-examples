/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher
 * @description Polls all currently known readable holding and input registers
 *   from the V-TAC VT-66036103 and compares them against embedded baseline
 *   values captured from local discovery.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/MODBUS/V-TAC/VT6607103/vtac_baseline_watch.shelly.js
 */

/**
 * Latest working hypotheses from live testing:
 * - 5776 (0x1690) = pv1_voltage, scale 0.1 V
 * - 5778 (0x1692) = pv2_voltage, scale 0.1 V
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5788 (0x169C) = igbt_temperature, scale 0.01 °C
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: '8N1',
  SLAVE_ID: 1,
  RESPONSE_TIMEOUT: 1200,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60,
};

var BLOCKS = [
  '3,5632,12,',
  '3,5664,1,',
  '3,5674,1,',
  '3,5684,1,',
  '3,5694,1,',
  '3,5704,1,',
  '3,5714,1,',
  '3,5724,1,',
  '3,5734,1,',
  '3,5744,1,0=4',
  '3,5752,1,0=6405',
  '3,5756,3,0=7',
  '3,5760,16,',
  '3,5777,1,',
  '3,5779,5,',
  '3,5785,1,',
  '3,5787,3,0=1|1=10|2=1',
  '3,5791,1,',
  '3,5793,2,0=100',
  '3,5796,1,',
  '3,5798,4,0=240|1=540|2=240',
  '3,5804,1,',
  '3,5810,1,',
  '3,5824,8,0=7|2=9|4=7|6=10',
  '3,5873,2,',
  '3,5936,1,',
  '3,5960,1,',
];


var state = {
  uart: null,
  rxBuffer: [],
  pendingRequest: null,
  responseTimer: null,
  pollTimer: null,
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0,
};

function toHex(n) {
  n = n & 0xFF;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function toHex16(n) {
  return toHex((n >> 8) & 0xFF) + toHex(n & 0xFF);
}

function bytesToStr(bytes) {
  var s = '';
  var i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xFF);
  return s;
}

function calcCRC(bytes) {
  var crc = 0xFFFF;
  var i;
  for (i = 0; i < bytes.length; i++) {
    crc = crc ^ bytes[i];
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
    if (crc & 1) { crc = (crc >> 1) ^ 0xA001; } else { crc = crc >> 1; }
  }
  return crc;
}

function buildFrame(slaveAddr, functionCode, data) {
  var frame = [slaveAddr & 0xFF, functionCode & 0xFF];
  var i;
  for (i = 0; i < data.length; i++) frame.push(data[i] & 0xFF);
  var crc = calcCRC(frame);
  frame.push(crc & 0xFF);
  frame.push((crc >> 8) & 0xFF);
  return frame;
}

function fcLabel(fc) {
  return fc === 3 ? 'HOLDING' : 'INPUT';
}

function makeKey(fc, addr) {
  return fc + ':' + addr;
}

function clearResponseTimeout() {
  if (state.responseTimer) {
    Timer.clear(state.responseTimer);
    state.responseTimer = null;
  }
}

function parseBlock(s) {
  var parts = s.split(',');
  return {
    fc: JSON.parse(parts[0]),
    start: JSON.parse(parts[1]),
    len: JSON.parse(parts[2]),
    nz: parts.length > 3 ? parts[3] : '',
  };
}

function baselineAt(block, offset) {
  if (block.nz === '') return 0;
  var items = block.nz.split('|');
  var i;
  for (i = 0; i < items.length; i++) {
    var kv = items[i].split('=');
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function sendRead(fc, addr, qty, callback) {
  if (state.pendingRequest) {
    callback('Request pending', null);
    return;
  }

  var data = [(addr >> 8) & 0xFF, addr & 0xFF, (qty >> 8) & 0xFF, qty & 0xFF];
  var frame = buildFrame(CONFIG.SLAVE_ID, fc, data);
  state.pendingRequest = { callback: callback };
  state.rxBuffer = [];

  state.responseTimer = Timer.set(CONFIG.RESPONSE_TIMEOUT, false, function() {
    if (state.pendingRequest) {
      var done = state.pendingRequest.callback;
      state.pendingRequest = null;
      done('Timeout', null);
    }
  });

  state.uart.write(bytesToStr(frame));
}

function onReceive(data) {
  if (!state.pendingRequest || !data || data.length === 0) return;

  var i;
  for (i = 0; i < data.length; i++) state.rxBuffer.push(data.charCodeAt(i) & 0xFF);
  processResponse();
}

function processResponse() {
  if (!state.pendingRequest) {
    state.rxBuffer = [];
    return;
  }

  if (state.rxBuffer.length < 5) return;

  var fc = state.rxBuffer[1];
  if (fc & 0x80) {
    if (state.rxBuffer.length >= 5) {
      var excFrame = state.rxBuffer.slice(0, 5);
      var excCrc = calcCRC(excFrame.slice(0, 3));
      var excRecvCrc = excFrame[3] | (excFrame[4] << 8);
      if (excCrc === excRecvCrc) {
        clearResponseTimeout();
        var exCode = state.rxBuffer[2];
        var exDone = state.pendingRequest.callback;
        state.pendingRequest = null;
        state.rxBuffer = [];
        exDone('Exception: 0x' + toHex(exCode), null);
      }
    }
    return;
  }

  if (state.rxBuffer.length < 3) return;
  var expectedLen = 3 + state.rxBuffer[2] + 2;
  if (state.rxBuffer.length < expectedLen) return;

  var frame = state.rxBuffer.slice(0, expectedLen);
  var crc = calcCRC(frame.slice(0, expectedLen - 2));
  var recvCrc = frame[expectedLen - 2] | (frame[expectedLen - 1] << 8);
  if (crc !== recvCrc) return;

  clearResponseTimeout();

  var byteCount = frame[2];
  var values = [];
  var i;
  for (i = 0; i < byteCount; i += 2) values.push((frame[3 + i] << 8) | frame[4 + i]);

  var done = state.pendingRequest.callback;
  state.pendingRequest = null;
  state.rxBuffer = [];
  done(null, values);
}

function handleValue(fc, addr, baseline, raw) {
  var key = makeKey(fc, addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print('[' + fcLabel(fc) + '] CHANGED addr=' + addr + ' (0x' + toHex16(addr) + ') default=' + baseline + ' current=' + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print('[' + fcLabel(fc) + '] RESTORED addr=' + addr + ' (0x' + toHex16(addr) + ') value=' + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.fc, block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print('[V-TAC] Previous cycle still running; skipping this interval');
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    if (index >= BLOCKS.length) {
      print('[V-TAC] Cycle done: blocks=' + BLOCKS.length + ' deviations=' + state.cycleDeviations + ' errors=' + state.cycleErrors);
      print('');
      state.cycleRunning = false;
      return;
    }

    var block = parseBlock(BLOCKS[index]);
    sendRead(block.fc, block.start, block.len, function(err, values) {
      if (err) {
        state.cycleErrors++;
        print('[' + fcLabel(block.fc) + '] ERROR addr=' + block.start + ' qty=' + block.len + ' (' + err + ')');
      } else {
        processBlock(block, values);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print('[V-TAC] Starting baseline comparison cycle');
  readNext(0);
}

function init() {
  print('V-TAC VT-66036103 baseline MODBUS watcher');
  print('==========================================');

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE })) {
    print('ERROR: UART configuration failed');
    return;
  }

  state.uart.recv(onReceive);

  print('Baseline blocks: ' + BLOCKS.length);
  print('Polling every ' + CONFIG.POLL_INTERVAL / 1000 + 's');
  print('');

  Timer.set(500, false, runCycle);
  state.pollTimer = Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);
}

init();
