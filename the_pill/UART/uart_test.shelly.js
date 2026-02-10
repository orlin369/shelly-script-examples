/**
 * @title UART test
 * @description Simple UART loopback test that sends periodic messages and prints received data.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/UART/uart_test.shelly.js
 */

/**
 * UART Test Script for Shelly (The Pill)
 *
 * Minimal UART test that sends "Hello UART" every 2 seconds and prints
 * any received data. Useful for verifying UART wiring and communication.
 *
 * Hardware connection:
 * - Device TX -> Shelly RX (GPIO)
 * - Device RX -> Shelly TX (GPIO)
 * - GND -> GND
 *
 * UART Settings: 9600 baud, 8N1
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  baud: 9600,
  mode: '8N1',
  txInterval: 2000,
  txMessage: 'Hello UART',
  debug: true
};

// ============================================================================
// STATE
// ============================================================================

var uart = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function dbg(msg) {
  if (CONFIG.debug) print('[UART-TEST] ' + msg);
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function onReceive(data) {
  if (!data || !data.length) return;
  // Optional: ignore ACK F1
  if (data.length === 1 && (data.charCodeAt(0) & 0xff) === 0xf1) {
    return;
  }
  dbg('RX: ' + data);
}

function sendMessage() {
  uart.write(CONFIG.txMessage);
  dbg('TX: ' + CONFIG.txMessage);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  uart = UART.get();
  if (!uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
    print('[UART-TEST] ERROR: Failed to configure UART');
    die();
  }
  uart.recv(onReceive);
  Timer.set(CONFIG.txInterval, true, sendMessage);
  dbg('Ready @ ' + CONFIG.baud + ' baud');
}

init();
