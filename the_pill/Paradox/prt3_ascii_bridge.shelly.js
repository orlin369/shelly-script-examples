/**
 * @title Paradox PRT3 ASCII bridge
 * @description UART bridge for Paradox EVO/Digiplex alarm panels via the PRT3
 *   ASCII protocol, with optional Virtual Components and a local HTTP command endpoint.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/the_pill/Paradox/prt3_ascii_bridge.shelly.js
 */

/**
 * Paradox PRT3 ASCII Bridge for Shelly (The Pill)
 *
 * Talks to a Paradox PRT3 printer/integration module configured for Home
 * Automation mode and ASCII protocol.
 *
 * Hardware connection:
 * - PRT3 TX -> Shelly RX (GPIO)
 * - PRT3 RX -> Shelly TX (GPIO)
 * - PRT3 GND -> Shelly GND
 *
 * Use an RS-232 to 3.3 V TTL level shifter if connecting to the PRT3 DB-9
 * serial port. Do not wire RS-232 voltage levels directly to The Pill UART.
 *
 * Protocol:
 * - Serial: 8N1, baud rate selected in PRT3 programming
 * - Frames: uppercase ASCII commands terminated by carriage return (ASCII 13)
 * - Replies: command echo plus &OK, &fail, requested data, or ! when the PRT3
 *   receive buffer is full
 *
 * Optional Virtual Components:
 * - boolean:200  Link online/offline
 * - text:200     Last received frame
 * - text:201     Last transmitted command
 * - text:202     Last parsed event/summary
 *
 * Local HTTP endpoint:
 * - /script/<id>/paradox?cmd=raw&value=RA001
 * - /script/<id>/paradox?cmd=area_status&area=1
 * - /script/<id>/paradox?cmd=zone_status&zone=1
 * - /script/<id>/paradox?cmd=arm&area=1&mode=A&code=1234
 * - /script/<id>/paradox?cmd=quick_arm&area=1&mode=S
 * - /script/<id>/paradox?cmd=disarm&area=1&code=1234
 * - /script/<id>/paradox?cmd=virtual_input&input=1&state=open
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  baud: 9600,
  mode: '8N1',
  debug: true,
  httpEndpoint: 'paradox',
  enableHttpEndpoint: true,
  commandTimeoutMs: 2500,
  pollIntervalMs: 15000,
  pollAreas: true,
  areaCount: 1,
  pollZones: false,
  zoneCount: 8,
  vc: {
    linkOnline: 'boolean:200',
    lastRx: 'text:200',
    lastTx: 'text:201',
    status: 'text:202',
  },
};

// ============================================================================
// STATE
// ============================================================================

var state = {
  uart: null,
  rxBuffer: '',
  queue: [],
  pending: null,
  pendingTimer: null,
  isOnline: false,
  lastRx: '',
  lastTx: '',
  lastStatus: 'Starting',
  vc: {},
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function debug(msg) {
  if (CONFIG.debug) {
    print('[PARADOX-PRT3] ' + msg);
  }
}

function setStatus(text) {
  state.lastStatus = text;
  debug(text);
  setVc('status', text);
}

function setVc(key, value) {
  if (state.vc[key]) {
    state.vc[key].setValue(value);
  }
}

function setOnline(online) {
  if (state.isOnline === online) {
    return;
  }
  state.isOnline = online;
  setVc('linkOnline', online);
  setStatus(online ? 'PRT3 online' : 'PRT3 offline');
}

function pad2(value) {
  value = Number(value);
  if (value < 10) {
    return '0' + value;
  }
  return '' + value;
}

function pad3(value) {
  value = Number(value);
  if (value < 10) {
    return '00' + value;
  }
  if (value < 100) {
    return '0' + value;
  }
  return '' + value;
}

function clampNumber(value, min, max) {
  value = Number(value);
  if (isNaN(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function sanitizeCommand(command) {
  var out = '';
  var ch;
  var code;

  if (!command) {
    return '';
  }

  command = '' + command;
  for (var i = 0; i < command.length; i++) {
    ch = command.charAt(i);
    code = command.charCodeAt(i);
    if (code === 13 || code === 10) {
      continue;
    }
    out += ch.toUpperCase();
  }
  return out;
}

function firstFive(command) {
  if (command.length <= 5) {
    return command;
  }
  return command.slice(0, 5);
}

function queryValue(req, key) {
  var params;

  if (typeof req.query === 'string') {
    params = parseQueryString(req.query);
    if (params[key] !== undefined) {
      return params[key];
    }
  } else if (req.query && req.query[key] !== undefined) {
    return req.query[key];
  }
  if (req.form_urlencoded_body && req.form_urlencoded_body[key] !== undefined) {
    return req.form_urlencoded_body[key];
  }
  return null;
}

function parseQueryString(query) {
  var params = {};
  var pairs;
  var pair;
  var key;
  var value;

  if (!query) {
    return params;
  }

  pairs = query.split('&');
  for (var i = 0; i < pairs.length; i++) {
    pair = pairs[i].split('=');
    key = decodeURIComponent(pair[0] || '');
    value = decodeURIComponent(pair[1] || '');
    if (key) {
      params[key] = value;
    }
  }
  return params;
}

function sendJson(res, code, obj) {
  res.code = code;
  res.headers = [['Content-Type', 'application/json']];
  res.body = JSON.stringify(obj);
  res.send();
}

// ============================================================================
// PRT3 COMMAND BUILDERS
// ============================================================================

function buildVirtualInput(input, open) {
  input = clampNumber(input, 1, 16);
  if (input === null) {
    return null;
  }
  return (open ? 'VO' : 'VC') + pad3(input);
}

function buildAreaStatus(area) {
  area = clampNumber(area, 1, 8);
  if (area === null) {
    return null;
  }
  return 'RA' + pad3(area);
}

function buildZoneStatus(zone) {
  zone = clampNumber(zone, 1, 192);
  if (zone === null) {
    return null;
  }
  return 'RZ' + pad3(zone);
}

function buildZoneLabel(zone) {
  zone = clampNumber(zone, 1, 192);
  if (zone === null) {
    return null;
  }
  return 'ZL' + pad3(zone);
}

function buildAreaLabel(area) {
  area = clampNumber(area, 1, 8);
  if (area === null) {
    return null;
  }
  return 'AL' + pad3(area);
}

function buildUserLabel(user) {
  user = clampNumber(user, 1, 999);
  if (user === null) {
    return null;
  }
  return 'UL' + pad3(user);
}

function buildArm(area, mode, code) {
  area = clampNumber(area, 1, 8);
  mode = sanitizeCommand(mode || 'A');
  code = '' + (code || '');
  if (area === null || code.length < 1) {
    return null;
  }
  if (mode !== 'A' && mode !== 'F' && mode !== 'S' && mode !== 'I') {
    return null;
  }
  return 'AA' + pad2(area) + mode + code;
}

function buildQuickArm(area, mode) {
  area = clampNumber(area, 1, 8);
  mode = sanitizeCommand(mode || 'A');
  if (area === null) {
    return null;
  }
  if (mode !== 'A' && mode !== 'F' && mode !== 'S' && mode !== 'I') {
    return null;
  }
  return 'AQ' + pad2(area) + mode;
}

function buildDisarm(area, code) {
  area = clampNumber(area, 1, 8);
  code = '' + (code || '');
  if (area === null || code.length < 1) {
    return null;
  }
  return 'AD' + pad2(area) + code;
}

function buildPanic(kind, area) {
  area = clampNumber(area, 1, 8);
  kind = sanitizeCommand(kind || '');
  if (area === null) {
    return null;
  }
  if (kind === 'EMERGENCY') {
    return 'PP' + pad3(area);
  }
  if (kind === 'MEDICAL') {
    return 'PM' + pad3(area);
  }
  if (kind === 'FIRE') {
    return 'PF' + pad3(area);
  }
  return null;
}

function buildSmokeReset(area) {
  area = clampNumber(area, 1, 8);
  if (area === null) {
    return null;
  }
  return 'SR' + pad3(area);
}

function buildUtilityKey(key) {
  key = clampNumber(key, 1, 64);
  if (key === null) {
    return null;
  }
  return 'UK' + pad3(key);
}

// ============================================================================
// UART TRANSPORT
// ============================================================================

function writeCommand(command) {
  command = sanitizeCommand(command);
  if (!command) {
    return false;
  }
  state.lastTx = command;
  setVc('lastTx', command);
  debug('TX ' + command);
  state.uart.write(command + '\r');
  return true;
}

function clearPendingTimer() {
  if (state.pendingTimer !== null) {
    Timer.clear(state.pendingTimer);
    state.pendingTimer = null;
  }
}

function startNextCommand() {
  if (state.pending || state.queue.length === 0) {
    return;
  }

  state.pending = state.queue.shift();
  if (!writeCommand(state.pending.command)) {
    state.pending = null;
    startNextCommand();
    return;
  }

  state.pendingTimer = Timer.set(CONFIG.commandTimeoutMs, false, function() {
    var pending = state.pending;
    clearPendingTimer();
    state.pending = null;
    if (pending && pending.callback) {
      pending.callback(null, 'timeout');
    }
    setStatus('Command timeout: ' + (pending ? pending.command : 'unknown'));
    startNextCommand();
  });
}

function enqueueCommand(command, callback) {
  command = sanitizeCommand(command);
  if (!command) {
    return false;
  }
  state.queue.push({ command: command, callback: callback || null });
  startNextCommand();
  return true;
}

function finishPending(frame, error) {
  var pending = state.pending;
  clearPendingTimer();
  state.pending = null;

  if (pending && pending.callback) {
    pending.callback(frame, error || null);
  }
  startNextCommand();
}

function frameMatchesPending(frame) {
  if (!state.pending) {
    return false;
  }
  return frame.indexOf(firstFive(state.pending.command)) === 0;
}

function processReply(frame) {
  if (frame === '!') {
    setStatus('PRT3 receive buffer full');
    finishPending(frame, 'buffer_full');
    return;
  }

  if (frameMatchesPending(frame)) {
    if (frame.indexOf('&FAIL') >= 0 || frame.indexOf('&fail') >= 0) {
      setStatus('Command failed: ' + state.pending.command);
      finishPending(frame, 'fail');
      return;
    }
    setOnline(true);
    setStatus('Reply: ' + frame);
    finishPending(frame, null);
    return;
  }

  handleEventFrame(frame);
}

function handleEventFrame(frame) {
  var summary = 'Event: ' + frame;

  if (frame === 'CO' || frame.indexOf('CO') === 0) {
    setOnline(true);
    summary = 'Panel communication restored';
  } else if (frame === 'CF' || frame.indexOf('CF') === 0) {
    setOnline(false);
    summary = 'Panel communication failed';
  } else if (frame.indexOf('G') === 0 && frame.indexOf('N') >= 0) {
    summary = 'System event: ' + frame;
  } else if (frame.indexOf('PG') === 0) {
    summary = 'Virtual PGM event: ' + frame;
  }

  setStatus(summary);
}

function onUartReceive(data) {
  var idx;
  var frame;

  if (!data || !data.length) {
    return;
  }

  state.rxBuffer += data;
  while ((idx = state.rxBuffer.indexOf('\r')) >= 0) {
    frame = state.rxBuffer.slice(0, idx);
    state.rxBuffer = state.rxBuffer.slice(idx + 1);
    frame = frame.replace('\n', '');
    if (!frame) {
      continue;
    }
    state.lastRx = frame;
    setVc('lastRx', frame);
    debug('RX ' + frame);
    processReply(frame);
  }
}

// ============================================================================
// POLLING AND HTTP CONTROL
// ============================================================================

function pollStatus() {
  var i;

  if (CONFIG.pollAreas) {
    for (i = 1; i <= CONFIG.areaCount; i++) {
      enqueueCommand(buildAreaStatus(i));
    }
  }

  if (CONFIG.pollZones) {
    for (i = 1; i <= CONFIG.zoneCount; i++) {
      enqueueCommand(buildZoneStatus(i));
    }
  }
}

function commandFromHttp(req) {
  var cmd = sanitizeCommand(queryValue(req, 'cmd') || 'status');
  var value;
  var area;
  var zone;

  if (cmd === 'STATUS') {
    return '';
  }
  if (cmd === 'RAW') {
    return sanitizeCommand(queryValue(req, 'value'));
  }
  if (cmd === 'AREA_STATUS') {
    return buildAreaStatus(queryValue(req, 'area'));
  }
  if (cmd === 'ZONE_STATUS') {
    return buildZoneStatus(queryValue(req, 'zone'));
  }
  if (cmd === 'ZONE_LABEL') {
    zone = queryValue(req, 'zone');
    return buildZoneLabel(zone);
  }
  if (cmd === 'AREA_LABEL') {
    area = queryValue(req, 'area');
    return buildAreaLabel(area);
  }
  if (cmd === 'USER_LABEL') {
    return buildUserLabel(queryValue(req, 'user'));
  }
  if (cmd === 'ARM') {
    return buildArm(queryValue(req, 'area'), queryValue(req, 'mode'), queryValue(req, 'code'));
  }
  if (cmd === 'QUICK_ARM') {
    return buildQuickArm(queryValue(req, 'area'), queryValue(req, 'mode'));
  }
  if (cmd === 'DISARM') {
    return buildDisarm(queryValue(req, 'area'), queryValue(req, 'code'));
  }
  if (cmd === 'VIRTUAL_INPUT') {
    value = sanitizeCommand(queryValue(req, 'state') || 'open');
    return buildVirtualInput(queryValue(req, 'input'), value !== 'CLOSED' && value !== 'CLOSE');
  }
  if (cmd === 'PANIC') {
    return buildPanic(queryValue(req, 'kind'), queryValue(req, 'area'));
  }
  if (cmd === 'SMOKE_RESET') {
    return buildSmokeReset(queryValue(req, 'area'));
  }
  if (cmd === 'UTILITY') {
    return buildUtilityKey(queryValue(req, 'key'));
  }

  return null;
}

function onHttpRequest(req, res) {
  var command = commandFromHttp(req);

  if (command === '') {
    sendJson(res, 200, {
      ok: true,
      online: state.isOnline,
      pending: state.pending ? state.pending.command : null,
      queued: state.queue.length,
      lastRx: state.lastRx,
      lastTx: state.lastTx,
      status: state.lastStatus,
    });
    return;
  }

  if (!command) {
    sendJson(res, 400, { ok: false, error: 'invalid command or parameters' });
    return;
  }

  enqueueCommand(command, function(reply, error) {
    sendJson(res, error ? 502 : 200, {
      ok: !error,
      error: error,
      command: command,
      reply: reply,
    });
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initVirtualComponents() {
  state.vc.linkOnline = Virtual.getHandle(CONFIG.vc.linkOnline);
  state.vc.lastRx = Virtual.getHandle(CONFIG.vc.lastRx);
  state.vc.lastTx = Virtual.getHandle(CONFIG.vc.lastTx);
  state.vc.status = Virtual.getHandle(CONFIG.vc.status);
}

function init() {
  initVirtualComponents();

  state.uart = UART.get();
  if (!state.uart.configure({ baud: CONFIG.baud, mode: CONFIG.mode })) {
    print('[PARADOX-PRT3] ERROR: Failed to configure UART');
    die();
  }

  state.uart.recv(onUartReceive);

  if (CONFIG.enableHttpEndpoint) {
    HTTPServer.registerEndpoint(CONFIG.httpEndpoint, onHttpRequest);
  }

  Timer.set(1000, false, pollStatus);
  Timer.set(CONFIG.pollIntervalMs, true, pollStatus);
  setStatus('Ready @ ' + CONFIG.baud + ' baud');
}

init();
