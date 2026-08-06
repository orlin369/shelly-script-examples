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
  DEFAULT_SLAVE: 1,
  DEBUG: true
};

function debug(msg) {
  if (CONFIG.DEBUG) {
    print("[BRIDGE] " + msg);
  }
}

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
  var slave = CONFIG.DEFAULT_SLAVE;

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
  print("MODBUS-RTU HTTP Bridge");
  print("======================");

  HTTPServer.registerEndpoint("modbus", httpHandler);

  print("Default slave: " + CONFIG.DEFAULT_SLAVE + "  Baud: " + CONFIG.BAUD_RATE + "  Mode: " + CONFIG.MODE);
  print("Endpoint: GET/POST /script/<ID>/modbus");
  print("");
  print("Example (GET):");
  print("  curl 'http://<IP>/script/<ID>/modbus?register=%7B%22name%22%3A%22W%22%2C%22units%22%3A%22W%22%2C%22scale%22%3A1%2C%22rights%22%3A%22R%22%2C%22reg%22%3A%7B%22addr%22%3A0%2C%22rtype%22%3A%22holding%22%2C%22itype%22%3A%22u16%22%2C%22bo%22%3A%22BE%22%2C%22wo%22%3A%22BE%22%7D%2C%22value%22%3Anull%2C%22human_readable%22%3Anull%7D'");
  print("");
  print("Example (POST):");
  print("  curl -X POST 'http://<IP>/script/<ID>/modbus' \\");
  print("       -H 'Content-Type: application/json' \\");
  print("       -d '{\"register\":{\"name\":\"W\",\"units\":\"W\",\"scale\":1,\"rights\":\"R\",\"reg\":{\"addr\":0,\"rtype\":\"holding\",\"itype\":\"u16\",\"bo\":\"BE\",\"wo\":\"BE\"},\"value\":null,\"human_readable\":null}}'");
}

init();
