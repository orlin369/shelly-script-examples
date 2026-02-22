/**
 * @title Dynamixel 6-servo motion example
 * @description Moves 6 Dynamixel servos simultaneously using SYNC_WRITE
 *   (Protocol 1.0). Enables torque, then alternates between two position sets.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/Dynamixel/dynamixel_move6.shelly.js
 */

/**
 * Dynamixel Protocol 1.0 - Move 6 Servos (Shelly / The Pill)
 *
 * Uses SYNC_WRITE to set Goal Position + Moving Speed on all 6 servos in a
 * single broadcast packet. No response is expected for SYNC_WRITE.
 *
 * The demo alternates between two position sets (POSE_A and POSE_B) on a
 * configurable interval so you can verify motion without external tooling.
 *
 * Hardware connection (TTL half-duplex, e.g. AX-12A):
 * - Dynamixel DATA pin -> Shelly TX and Shelly RX (via 1kΩ resistor)
 * - Servo supply       -> VCC (7.4V-12V depending on servo model)
 * - GND               -> GND
 *
 * Protocol: Dynamixel Protocol 1.0
 * Packet format: [0xFF, 0xFF, ID, LENGTH, INSTRUCTION, PARAMS..., CHECKSUM]
 * Checksum:      ~(ID + LENGTH + INSTRUCTION + sum(PARAMS)) & 0xFF
 *
 * Instructions used:
 * - SYNC_WRITE (0x83) - Write the same register(s) on multiple servos at once.
 *   Broadcast (ID=0xFE), no status packet returned.
 *
 * SYNC_WRITE packet layout (Goal Position + Moving Speed, 4 bytes/servo):
 *   [0xFF, 0xFF, 0xFE, LENGTH, 0x83,
 *    START_ADDR(1), DATA_LEN(1),
 *    id0, pos_lo, pos_hi, spd_lo, spd_hi,
 *    id1, pos_lo, pos_hi, spd_lo, spd_hi,
 *    ...
 *    CHECKSUM]
 *
 * AX-12 position range: 0-1023  (0° - 300°, centre = 512)
 * AX-12 speed range:    1-1023  (0 = maximum uncontrolled speed)
 *
 * @see https://emanual.robotis.com/docs/en/dxl/protocol1/
 * @see https://github.com/orlin369/PyDynamixel
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  BAUD_RATE: 1000000, // 1 Mbps (AX-12 default); try 57600 or 115200 if needed
  ECHO_FILTER: true,  // Set true when TX is looped back on RX (half-duplex wiring)
  DEBUG: false,       // Print raw TX bytes for debugging

  // Demo: alternate between POSE_A and POSE_B every MOVE_INTERVAL ms
  MOVE_INTERVAL: 2000, // ms between position changes
};

/**
 * Six servos to control.
 * id:     Dynamixel servo ID (1-253)
 * poseA:  target position for pose A (0-1023 for AX-12)
 * poseB:  target position for pose B (0-1023 for AX-12)
 * speed:  moving speed (1-1023; 0 = max uncontrolled)
 */
var SERVOS = [
  { id: 1, poseA: 200, poseB: 820, speed: 100 },
  { id: 2, poseA: 820, poseB: 200, speed: 100 },
  { id: 3, poseA: 512, poseB: 400, speed: 150 },
  { id: 4, poseA: 400, poseB: 512, speed: 150 },
  { id: 5, poseA: 300, poseB: 700, speed: 200 },
  { id: 6, poseA: 700, poseB: 300, speed: 200 },
];

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

var INS = {
  SYNC_WRITE: 0x83,
};

var REG = {
  TORQUE_ENABLE: 0x18, // 1 byte: 0=off, 1=on
  GOAL_POSITION: 0x1e, // 2 bytes: 0-1023 (AX-12)
  MOVING_SPEED: 0x20,  // 2 bytes: 0-1023
};

var BROADCAST_ID = 0xfe;

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  echoSkip: 0,  // bytes left to discard (our own TX echo)
  pose: 0,      // 0 = pose A, 1 = pose B (demo toggle)
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
 * Build a Dynamixel instruction packet.
 * @param {number} id          - Servo/broadcast ID
 * @param {number} instruction - Instruction byte
 * @param {Array}  params      - Parameter bytes (may be null or empty)
 * @returns {Array} Complete packet as byte array
 */
function buildPacket(id, instruction, params) {
  var paramLen = params ? params.length : 0;
  var length = paramLen + 2;
  var packet = [0xff, 0xff, id & 0xff, length & 0xff, instruction & 0xff];
  for (var i = 0; i < paramLen; i++) {
    packet.push(params[i] & 0xff);
  }
  packet.push(calcChecksum(packet));
  return packet;
}

/**
 * Send a packet over UART, optionally setting the echo-skip counter.
 */
function sendPacket(packet) {
  debug('TX: ' + bytesToHex(packet));
  if (CONFIG.ECHO_FILTER) {
    state.echoSkip += packet.length;
  }
  state.uart.write(bytesToStr(packet));
}

// ============================================================================
// UART RECEIVE HANDLER
// ============================================================================

/**
 * Discard echo bytes; SYNC_WRITE produces no status response.
 */
function onUartReceive(data) {
  if (!data || data.length === 0) return;
  for (var i = 0; i < data.length; i++) {
    if (state.echoSkip > 0) {
      state.echoSkip--;
    }
    // No response expected for SYNC_WRITE (broadcast); discard everything else.
  }
}

// ============================================================================
// DYNAMIXEL COMMANDS
// ============================================================================

/**
 * Enable or disable torque on all listed servos using a single SYNC_WRITE.
 * @param {boolean} enable - true to enable torque, false to disable
 */
function setTorqueAll(enable) {
  var dataLen = 1; // Torque Enable is 1 byte
  var params = [REG.TORQUE_ENABLE, dataLen];

  for (var i = 0; i < SERVOS.length; i++) {
    params.push(SERVOS[i].id & 0xff);
    params.push(enable ? 0x01 : 0x00);
  }

  var packet = buildPacket(BROADCAST_ID, INS.SYNC_WRITE, params);
  sendPacket(packet);
  print('Torque ' + (enable ? 'enabled' : 'disabled') + ' on all servos.');
}

/**
 * Move all servos to their configured positions using a single SYNC_WRITE.
 * Writes Goal Position (2 bytes) + Moving Speed (2 bytes) per servo.
 * @param {number} poseIndex - 0 for poseA, 1 for poseB
 */
function moveAll(poseIndex) {
  var dataLen = 4; // Goal Position(2) + Moving Speed(2)
  var params = [REG.GOAL_POSITION, dataLen];

  for (var i = 0; i < SERVOS.length; i++) {
    var servo = SERVOS[i];
    var pos = poseIndex === 0 ? servo.poseA : servo.poseB;
    var spd = servo.speed;

    params.push(servo.id & 0xff);
    params.push(pos & 0xff);         // Goal Position low byte
    params.push((pos >> 8) & 0xff);  // Goal Position high byte
    params.push(spd & 0xff);         // Moving Speed low byte
    params.push((spd >> 8) & 0xff);  // Moving Speed high byte
  }

  var packet = buildPacket(BROADCAST_ID, INS.SYNC_WRITE, params);
  sendPacket(packet);

  var label = poseIndex === 0 ? 'A' : 'B';
  print('Moving all servos to pose ' + label + '.');
}

// ============================================================================
// DEMO LOOP
// ============================================================================

function demoStep() {
  moveAll(state.pose);
  state.pose = state.pose === 0 ? 1 : 0;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  print('Dynamixel 6-Servo Motion Example');
  print('Protocol 1.0 | Baud: ' + CONFIG.BAUD_RATE);
  print('Servos: ' + SERVOS.length);

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
  print('UART ready.');

  // Enable torque, then start the demo after a short settling delay
  Timer.set(500, false, function () {
    setTorqueAll(true);

    // First move immediately after torque enable
    Timer.set(200, false, function () {
      demoStep();

      // Alternate between poses on the configured interval
      Timer.set(CONFIG.MOVE_INTERVAL, true, demoStep);
    });
  });
}

init();
