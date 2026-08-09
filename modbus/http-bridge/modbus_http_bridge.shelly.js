/**
 * @title MODBUS-RTU HTTP Bridge
 * @description HTTP endpoint that bridges MODBUS RTU over the native Shelly
 *   ModbusController. Accepts a register descriptor as JSON, performs a
 *   MODBUS RTU read or write, and returns the result as JSON.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/http-bridge/modbus_http_bridge.shelly.js
 */

/**
 * MODBUS-RTU HTTP Bridge
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Exposes an HTTP endpoint that accepts a MODBUS register descriptor and
 * performs the corresponding RTU read or write via the native
 * ModbusController.
 *
 * Endpoint:
 *   GET  http://<SHELLY-IP>/script/<ID>/modbus?register=<URL-encoded-JSON>[&slave=<id>]
 *   POST http://<SHELLY-IP>/script/<ID>/modbus
 *        Body (JSON): {"register": <descriptor>, "slave": <id>}
 *        Body (JSON): <descriptor>   (register descriptor directly)
 *
 * Register descriptor format:
 *   {
 *     "name": "Active Power",
 *     "units": "W",
 *     "scale": 1,
 *     "rights": "RW",        // "R" = read-only, "RW" = read-write
 *     "reg": {
 *       "addr": 0,           // register address (0-65535)
 *       "rtype": "holding",  // "holding" | "input" | "coil" | "discrete"
 *       "itype": "u16",      // "u16" | "i16" | "u32" | "i32" | "f32"
 *       "bo": "BE",          // byte order within register: "BE" or "LE"
 *       "wo": "BE"           // word order for 32-bit types:  "BE" or "LE"
 *     },
 *     "value": null,         // null => read; number => write (raw register value)
 *     "human_readable": null // filled on response (value * scale)
 *   }
 *
 * Response on success:
 *   Same descriptor with "value" and "human_readable" populated.
 * Response on error:
 *   {"error": "<message>"}
 *
 * Write rules:
 *   - If "value" is not null and "rights" == "RW" => write operation.
 *   - Otherwise => read operation.
 *   - For coils: value 0 = OFF, any non-zero = ON.
 */

/* === CONFIG === */
var CONFIG = {
  BAUD_RATE: 115200,
  MODE: "8N1",
  DEBUG: true
};

function debug(msg) {
  if (CONFIG.DEBUG) {
    print("[BRIDGE] " + msg);
  }
}

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
// DEFAULT MODBUS SLAVE ID
// ============================================================================
// The bridge already accepts a per-request slave-ID override (?slave=<id> or
// {"slave": <id>} in the POST body). The fallback used when a request omits
// it must never be hardcoded either: it is exposed as a persisted Virtual
// Component (number:299, range 1-247) so it can be reconfigured from an
// app/config UI without redeploying code. getSlaveId() reads the component
// live on every request, clamps it into range, and writes the clamped value
// back if it was out of range.

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

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'slaveId',
      type: 'number',
      id: 299,
      config: {
        name: 'Default Modbus Slave ID',
        min: MIN_SLAVE_ID,
        max: MAX_SLAVE_ID,
        default_value: DEFAULT_SLAVE_ID,
        persisted: true,
        meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    { id: 299, name: 'MODBUS-RTU HTTP Bridge', components: ['slaveId'] }
  ]
};

var vcHandles = null;

/* === RTYPE / BYTE-ORDER MAPPING === */

function mapRtype(rtype) {
  if (rtype === "holding") return ModbusController.REGTYPE_HOLDING;
  if (rtype === "input") return ModbusController.REGTYPE_INPUT;
  if (rtype === "coil") return ModbusController.REGTYPE_COIL;
  if (rtype === "discrete") return ModbusController.REGTYPE_DISCRETEINPUT;
  return null;
}

function mapOrder(order) {
  return order === "LE" ? ModbusController.LE : ModbusController.BE;
}

/* === MODBUS API (via native ModbusController) === */

/**
 * Read a register/coil and return the decoded value via callback.
 * @param {number} slave       - MODBUS slave address
 * @param {object} reg         - reg descriptor: {addr, rtype, itype, bo, wo}
 * @param {function} callback  - callback(error, value)
 */
function modbusRead(slave, reg, callback) {
  var rtype = mapRtype(reg.rtype);

  if (rtype === null) {
    callback("Unknown rtype: " + reg.rtype, null);
    return;
  }

  var endpoint = ModbusController.get(slave, { baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE });
  var readOpts = { rtype: rtype, addr: reg.addr, qty: 1 };

  if (rtype === ModbusController.REGTYPE_HOLDING || rtype === ModbusController.REGTYPE_INPUT) {
    readOpts.itype = reg.itype;
    readOpts.bo = mapOrder(reg.bo);
    readOpts.wo = mapOrder(reg.wo);
  }

  endpoint.readRegisters(readOpts, function(result, error) {
    if (error || result === undefined || result === null || result.length === 0) {
      callback(error || "No data", null);
      return;
    }
    callback(null, result[0]);
  });
}

/**
 * Write a value to a register/coil.
 * @param {number} slave       - MODBUS slave address
 * @param {object} reg         - reg descriptor: {addr, rtype, itype, bo, wo}
 * @param {number} value       - Raw value to write
 * @param {function} callback  - callback(error)
 */
function modbusWrite(slave, reg, value, callback) {
  var rtype = mapRtype(reg.rtype);

  if (rtype !== ModbusController.REGTYPE_HOLDING && rtype !== ModbusController.REGTYPE_COIL) {
    callback("Write only supported for 'holding' and 'coil' register types");
    return;
  }

  var endpoint = ModbusController.get(slave, { baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE });
  var writeOpts = { rtype: rtype, addr: reg.addr };
  var writeValue = value;

  if (rtype === ModbusController.REGTYPE_HOLDING) {
    writeOpts.itype = reg.itype;
    writeOpts.bo = mapOrder(reg.bo);
    writeOpts.wo = mapOrder(reg.wo);
  } else {
    writeValue = value ? 1 : 0;
  }

  endpoint.writeRegisters(writeOpts, [writeValue], function(success, error) {
    callback(success ? null : error);
  });
}

/* === HTTP UTILITIES === */

/**
 * URL-decode a percent-encoded string (handles %XX and + => space).
 */
function urlDecode(s) {
  var result = "";
  var i = 0;
  while (i < s.length) {
    var c = s[i];
    if (c === "+") {
      result += " ";
      i++;
    } else if (c === "%" && i + 2 < s.length) {
      var hex = s[i + 1] + s[i + 2];
      result += String.fromCharCode(parseInt(hex, 16));
      i += 3;
    } else {
      result += c;
      i++;
    }
  }
  return result;
}

/**
 * Parse query string into a key/value object.
 * Handles values with embedded '=' characters.
 */
function parseQS(qs) {
  var params = {};
  if (!qs || qs.length === 0) return params;
  var parts = qs.split("&");
  for (var i = 0; i < parts.length; i++) {
    var eqIdx = parts[i].indexOf("=");
    if (eqIdx < 0) {
      params[parts[i]] = null;
    } else {
      var key = parts[i].substring(0, eqIdx);
      var val = parts[i].substring(eqIdx + 1);
      params[key] = val;
    }
  }
  return params;
}

/**
 * Send a JSON error response.
 */
function sendError(response, code, msg) {
  response.code = code;
  response.body = JSON.stringify({ error: msg });
  response.send();
}

/* === HTTP HANDLER === */

function httpHandler(request, response) {
  var descriptor = null;
  var slave = getSlaveId();

  // --- Parse input ---
  if (request.method === "POST" && request.body && request.body.length > 0) {
    var body;
    try {
      body = JSON.parse(request.body);
    } catch (e) {
      sendError(response, 400, "Invalid JSON body: " + e);
      return;
    }
    // Accept {"register": {...}, "slave": N} or the descriptor directly
    if (body.register !== undefined) {
      descriptor = body.register;
      if (body.slave !== undefined) slave = body.slave;
    } else if (body.reg !== undefined) {
      descriptor = body;
    } else {
      sendError(response, 400, "Body must contain 'register' key or be a register descriptor");
      return;
    }
  } else {
    // GET: parse from query string
    var params = parseQS(request.query);
    if (!params.register) {
      sendError(response, 400, "Missing 'register' query parameter");
      return;
    }
    var regJson = urlDecode(params.register);
    try {
      descriptor = JSON.parse(regJson);
    } catch (e) {
      sendError(response, 400, "Invalid JSON in 'register': " + e);
      return;
    }
    if (params.slave) slave = parseInt(params.slave, 10);
  }

  // --- Validate descriptor ---
  if (!descriptor || !descriptor.reg) {
    sendError(response, 400, "Descriptor missing 'reg' field");
    return;
  }
  var reg = descriptor.reg;
  if (reg.addr === undefined || reg.addr === null) {
    sendError(response, 400, "reg.addr is required");
    return;
  }
  if (!reg.rtype) {
    sendError(response, 400, "reg.rtype is required");
    return;
  }
  if (!reg.itype) reg.itype = "u16";
  if (!reg.bo) reg.bo = "BE";
  if (!reg.wo) reg.wo = "BE";
  if (!descriptor.scale || descriptor.scale === 0) descriptor.scale = 1;

  // --- Determine read or write ---
  var isWrite = (descriptor.value !== null &&
    descriptor.value !== undefined &&
    descriptor.rights === "RW");

  if (isWrite) {
    debug("WRITE slave=" + slave + " addr=" + reg.addr +
      " itype=" + reg.itype + " value=" + descriptor.value);

    modbusWrite(slave, reg, descriptor.value, function(err) {
      if (err) {
        sendError(response, 500, err);
        return;
      }
      descriptor.human_readable = descriptor.value * descriptor.scale;
      response.code = 200;
      response.body = JSON.stringify(descriptor);
      response.send();
    });
  } else {
    debug("READ slave=" + slave + " addr=" + reg.addr + " itype=" + reg.itype);

    modbusRead(slave, reg, function(err, value) {
      if (err) {
        sendError(response, 500, err);
        return;
      }
      descriptor.value = value;
      descriptor.human_readable = value * descriptor.scale;
      response.code = 200;
      response.body = JSON.stringify(descriptor);
      response.send();
    });
  }
}

/* === INITIALIZATION === */

function init() {
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }
    vcHandles = readyVc.handles;
    slaveIdHandle = readyVc.handles.slaveId;

    print("MODBUS-RTU HTTP Bridge");
    print("======================");

    HTTPServer.registerEndpoint("modbus", httpHandler);

    print("Default slave: " + getSlaveId() + "  Baud: " + CONFIG.BAUD_RATE + "  Mode: " + CONFIG.MODE);
    print("Endpoint: GET/POST /script/<ID>/modbus");
    print("");
    print("Example (GET):");
    print("  curl 'http://<IP>/script/<ID>/modbus?register=%7B%22name%22%3A%22W%22%2C%22units%22%3A%22W%22%2C%22scale%22%3A1%2C%22rights%22%3A%22R%22%2C%22reg%22%3A%7B%22addr%22%3A0%2C%22rtype%22%3A%22holding%22%2C%22itype%22%3A%22u16%22%2C%22bo%22%3A%22BE%22%2C%22wo%22%3A%22BE%22%7D%2C%22value%22%3Anull%2C%22human_readable%22%3Anull%7D'");
    print("");
    print("Example (POST):");
    print("  curl -X POST 'http://<IP>/script/<ID>/modbus' \\");
    print("       -H 'Content-Type: application/json' \\");
    print("       -d '{\"register\":{\"name\":\"W\",\"units\":\"W\",\"scale\":1,\"rights\":\"R\",\"reg\":{\"addr\":0,\"rtype\":\"holding\",\"itype\":\"u16\",\"bo\":\"BE\",\"wo\":\"BE\"},\"value\":null,\"human_readable\":null}}'");
  });
}

init();
