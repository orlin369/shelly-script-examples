/**
 * @title Dynamixel servo network scanner
 * @description Scans the Dynamixel bus (Protocol 1.0) for connected servos,
 *   printing ID, model number, and firmware version for each discovered device.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/Dynamixel/dynamixel_list.shelly.js
 */

/**
 * Dynamixel Protocol 1.0 Network Scanner for Shelly (The Pill)
 *
 * Sends PING to each ID in range and reads model number + firmware version
 * from each responding servo. Results are printed to the Shelly console.
 *
 * Hardware connection (TTL half-duplex, e.g. AX-12A):
 * - Dynamixel DATA pin -> Shelly TX and Shelly RX (wired together via 1kΩ resistor)
 * - Servo power supply -> VCC (7.4V-12V depending on servo model)
 * - GND -> GND
 *
 * Or use a proper Dynamixel interface (U2D2, USB2Dynamixel) which handles
 * the half-duplex direction automatically (set ECHO_FILTER: false in that case).
 *
 * Protocol: Dynamixel Protocol 1.0
 * Packet format: [0xFF, 0xFF, ID, LENGTH, INSTRUCTION, PARAMS..., CHECKSUM]
 * Checksum:      ~(ID + LENGTH + INSTRUCTION + sum(PARAMS)) & 0xFF
 * Baud rate:     1,000,000 bps (AX-12 default); try 57600 for older setups
 *
 * Instructions used:
 * - PING      (0x01) - Check if servo responds
 * - READ_DATA (0x02) - Read register values
 *
 * Key registers (AX-12):
 * - 0x00: Model Number (2 bytes)
 * - 0x02: Firmware Version (1 byte)
 *
 * @see https://emanual.robotis.com/docs/en/dxl/protocol1/
 * @see https://github.com/orlin369/PyDynamixel
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 1000000,  // 1 Mbps (AX-12 default); try 57600 or 115200 if needed
  START_ID: 1,         // First servo ID to scan (min 1)
  END_ID: 20,          // Last servo ID to scan (max 253; 0xFE is broadcast)
  PING_TIMEOUT: 50,    // ms to wait for a PING response before moving on
  READ_TIMEOUT: 100,   // ms to wait for a READ response
  ECHO_FILTER: true,   // Set true when TX is looped back on RX (half-duplex wiring)
  DEBUG: false,        // Print raw TX/RX bytes for debugging
};

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

var INS = {
  PING: 0x01,
  READ_DATA: 0x02,
};

var REG = {
  MODEL_NUMBER: 0x00,  // 2 bytes, little-endian
  FIRMWARE: 0x02,      // 1 byte
};

var BROADCAST_ID = 0xfe;

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: [],
  echoSkip: 0,   // bytes left to discard (our own TX echo)
  pending: null, // active request: { timer, callback }
};

var scanState = {
  currentId: 0,
  foundIds: [],
  readIndex: 0,
  models: {},  // id -> { model, firmware }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function debug(msg) {
  if (CONFIG.DEBUG) {
    print('[DXL] ' + msg);
  }
}

function toHex(n) {
  n = n & 0xff;
  return (n < 16 ? '0' : '') + n.toString(16).toUpperCase();
}

function bytesToHex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    if (i > 0) s += ' ';
    s += toHex(bytes[i]);
  }
  return s;
}

function bytesToStr(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] & 0xff);
  }
  return s;
}

/**
 * Dynamixel Protocol 1.0 checksum.
 * Input: packet without final checksum byte (starts with [0xFF, 0xFF, ...]).
 * Returns: ~(sum of bytes from index 2 onward) & 0xFF
 */
function calcChecksum(packet) {
  var sum = 0;
  for (var i = 2; i < packet.length; i++) {
    sum += packet[i];
  }
  return (~sum) & 0xff;
}

/**
 * Verify checksum of a received status packet (includes checksum byte at end).
 */
function verifyChecksum(packet) {
  var sum = 0;
  for (var i = 2; i < packet.length - 1; i++) {
    sum += packet[i];
  }
  return ((~sum) & 0xff) === packet[packet.length - 1];
}

/**
 * Build a Dynamixel instruction packet.
 * @param {number} id          - Servo ID (0x00-0xFE)
 * @param {number} instruction - Instruction byte
 * @param {Array}  params      - Parameter bytes (may be null or empty)
 * @returns {Array} Complete packet as byte array
 */
function buildPacket(id, instruction, params) {
  var paramLen = params ? params.length : 0;
  var length = paramLen + 2; // instruction(1) + checksum(1)
  var packet = [0xff, 0xff, id & 0xff, length & 0xff, instruction & 0xff];
  for (var i = 0; i < paramLen; i++) {
    packet.push(params[i] & 0xff);
  }
  packet.push(calcChecksum(packet));
  return packet;
}

/** Build a PING instruction packet for the given servo ID. */
function buildPing(id) {
  return buildPacket(id, INS.PING, null);
}

/**
 * Build a READ_DATA instruction packet.
 * @param {number} id  - Servo ID
 * @param {number} reg - Starting register address
 * @param {number} len - Number of bytes to read
 */
function buildRead(id, reg, len) {
  return buildPacket(id, INS.READ_DATA, [reg & 0xff, len & 0xff]);
}

/**
 * Send a packet over UART, optionally setting the echo-skip counter.
 */
function sendPacket(packet) {
  debug('TX: ' + bytesToHex(packet));
  if (CONFIG.ECHO_FILTER) {
    state.echoSkip = packet.length;
  }
  state.uart.write(bytesToStr(packet));
}

// ============================================================================
// UART RECEIVE HANDLER
// ============================================================================

function onUartReceive(data) {
  if (!data || data.length === 0) return;

  for (var i = 0; i < data.length; i++) {
    var b = data.charCodeAt(i) & 0xff;

    // Discard echo of our own transmitted bytes
    if (state.echoSkip > 0) {
      state.echoSkip--;
      continue;
    }
    state.rxBuffer.push(b);
  }

  processBuffer();
}

/**
 * Try to extract a complete status packet from rxBuffer and deliver it.
 * Dynamixel status packet: [0xFF, 0xFF, ID, LENGTH, ERROR, PARAMS..., CHECKSUM]
 * Total length = LENGTH + 4  (header:2 + id:1 + length_byte:1)
 */
function processBuffer() {
  if (!state.pending) {
    state.rxBuffer = [];
    return;
  }

  // Need at least 6 bytes for a minimal status packet (no params)
  if (state.rxBuffer.length < 6) return;

  // Synchronise on 0xFF 0xFF header
  while (state.rxBuffer.length >= 2) {
    if (state.rxBuffer[0] === 0xff && state.rxBuffer[1] === 0xff) break;
    state.rxBuffer.shift();
  }

  if (state.rxBuffer.length < 4) return;

  var declaredLength = state.rxBuffer[3]; // ID(1) + LENGTH(1) already consumed
  var totalLen = 4 + declaredLength;      // header(2) + id(1) + length_byte(1) + declared

  if (state.rxBuffer.length < totalLen) return;

  var packet = state.rxBuffer.splice(0, totalLen);
  debug('RX: ' + bytesToHex(packet));

  if (!verifyChecksum(packet)) {
    debug('Checksum mismatch - discarding');
    return;
  }

  // Deliver to the pending callback
  var pend = state.pending;
  clearPendingTimer();
  state.pending = null;
  pend.callback(null, packet);
}

function clearPendingTimer() {
  if (state.pending && state.pending.timer) {
    Timer.clear(state.pending.timer);
    state.pending.timer = null;
  }
}

// ============================================================================
// REQUEST / RESPONSE
// ============================================================================

/**
 * Send a packet and call callback(err, packet) when a response arrives or
 * the timeout expires.
 */
function sendRequest(packet, timeoutMs, callback) {
  state.rxBuffer = [];
  state.pending = {
    callback: callback,
    timer: Timer.set(timeoutMs, false, function () {
      if (state.pending) {
        var cb = state.pending.callback;
        state.pending = null;
        cb('timeout', null);
      }
    }),
  };
  sendPacket(packet);
}

// ============================================================================
// SCAN STATE MACHINE
// ============================================================================

function startScan() {
  print('=== Dynamixel Network Scan ===');
  print('Scanning IDs ' + CONFIG.START_ID + ' to ' + CONFIG.END_ID + '...');
  scanState.currentId = CONFIG.START_ID;
  scanState.foundIds = [];
  scanState.readIndex = 0;
  scanState.models = {};
  pingNext();
}

/** Phase 1: Ping each ID in range sequentially. */
function pingNext() {
  if (scanState.currentId > CONFIG.END_ID) {
    print('Ping phase done. Found: ' + scanState.foundIds.length + ' servo(s).');
    scanState.readIndex = 0;
    readNextModel();
    return;
  }

  var id = scanState.currentId;
  sendRequest(buildPing(id), CONFIG.PING_TIMEOUT, function (err, packet) {
    if (!err && packet) {
      print('  Found servo at ID ' + id);
      scanState.foundIds.push(id);
    }
    scanState.currentId++;
    pingNext();
  });
}

/** Phase 2: Read model number and firmware from each found servo. */
function readNextModel() {
  if (scanState.readIndex >= scanState.foundIds.length) {
    printResults();
    return;
  }

  var id = scanState.foundIds[scanState.readIndex];

  // Read 3 bytes starting at MODEL_NUMBER: model(2) + firmware(1)
  sendRequest(
    buildRead(id, REG.MODEL_NUMBER, 3),
    CONFIG.READ_TIMEOUT,
    function (err, packet) {
      if (!err && packet && packet.length >= 9) {
        // Status packet layout: [0xFF, 0xFF, ID, 0x05, ERROR, b0, b1, b2, CHECKSUM]
        var model = packet[5] | (packet[6] << 8);
        var firmware = packet[7];
        scanState.models[id] = { model: model, firmware: firmware };
      } else {
        scanState.models[id] = { model: 0, firmware: 0 };
        debug('Failed to read model for ID ' + id + (err ? ': ' + err : ''));
      }
      scanState.readIndex++;
      readNextModel();
    },
  );
}

function printResults() {
  print('');
  print('=== Discovered Servos ===');
  if (scanState.foundIds.length === 0) {
    print('No servos found.');
    print('Check: baud rate (' + CONFIG.BAUD_RATE + '), wiring, power, ID range.');
  } else {
    for (var i = 0; i < scanState.foundIds.length; i++) {
      var id = scanState.foundIds[i];
      var info = scanState.models[id];
      print(
        '  ID ' +
          id +
          ' | Model: ' +
          info.model +
          ' | Firmware: v' +
          info.firmware,
      );
    }
  }
  print('=== Scan complete ===');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  print('Dynamixel Network Scanner');
  print('Protocol 1.0 | Baud: ' + CONFIG.BAUD_RATE);

  state.uart = UART.get();
  if (!state.uart) {
    print('ERROR: UART not available on this device');
    return;
  }

  if (!state.uart.configure({ baud: CONFIG.BAUD_RATE, mode: '8N1' })) {
    print('ERROR: UART configure failed');
    return;
  }

  state.uart.recv(onUartReceive);
  print('UART ready. Starting scan in 500 ms...');

  Timer.set(500, false, startScan);
}

init();
