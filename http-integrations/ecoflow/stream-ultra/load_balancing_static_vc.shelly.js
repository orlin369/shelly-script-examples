/**
 * @title EcoFlow STREAM Ultra Load Balancing with Virtual Components (static config)
 * @description Polls Shelly EM / Plug S Gen3 devices and controls an EcoFlow
 *   STREAM Ultra via the EcoFlow cloud API. Switches between discharge, charge,
 *   and idle modes based on total load and a configurable night-charging window.
 *   Creates Virtual Components on first run to visualise EcoFlow device parameters
 *   in the Shelly app dashboard.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/ecoflow/stream-ultra/load_balancing_static_vc.shelly.js
 */

/*
 * Modes:
 *   discharge : sum of all device readings > threshold (day hours)
 *   charge    : night window (configurable hours)
 *   idle      : day + load below threshold — battery neither charges nor discharges
 *
 * Virtual Components (10 total, created once on first run, reused on restart):
 *   Group   : "EcoFlow STREAM Ultra"
 *   Numbers : Battery SOC (%), Battery Power (W), PV Power (W),
 *             Grid Power (W), Load Power (W),
 *             Backup Reserve SOC (%), Meters Total (W)
 *   Booleans: Feed Grid, Night Mode
 *
 * EcoFlow quota fields visualised (from /iot-open/sign/device/quota/all):
 *   cmsBattSoc, powGetBpCms, powGetPvSum, powGetSysGrid, powGetSysLoad,
 *   backupReverseSoc, feedGridMode
 *
 * All configuration is embedded in CONFIG / DEVICES_CFG — no KVS needed.
 * HMAC-SHA256 adapted from ecoflow_api.js reference.
 */

/* === CONFIG === */
// Edit these values before uploading the script to the Shelly device.

var CONFIG = {
    // EcoFlow API credentials
    accessKey  : "YOUR_ACCESS_KEY",
    secretKey  : "YOUR_SECRET_KEY",
    serial     : "YOUR_DEVICE_SERIAL",
    region     : "eu",           // "eu" or "us"

    // EcoFlow command routing (STREAM Ultra defaults — change only if needed)
    cmdId      : 17,
    cmdFunc    : 254,
    dirDest    : 1,
    dirSrc     : 1,
    dest       : 2,

    // Night-charging window (local device hours, 0–23)
    nightStart : 23,             // hour charging begins (inclusive)
    nightEnd   :  6,             // hour charging ends   (exclusive, wraps midnight)
    nightSoc   : 95,             // backup-reserve % during night charging

    // Day operation
    threshold  : 600,            // W — above this the battery discharges
    pollMs     : 5000            // polling interval in milliseconds
};

/* === DEVICES === */
// List of Shelly devices to measure.
//   type    : "em"   — Shelly EM Gen4, reads EM1.GetStatus  -> act_power
//           : "plug" — Shelly Plug S Gen3, reads Switch.GetStatus -> apower
//   host    : IP address or hostname of the Shelly device
//   channel : EM channel index (usually 0 or 1) / Switch id (usually 0)
//   name    : friendly label used in log output only

var DEVICES_CFG = [
    { type: "em",   host: "192.168.1.10", channel: 0, name: "Main EM ch0" },
    { type: "em",   host: "192.168.1.10", channel: 1, name: "Main EM ch1" },
    { type: "plug", host: "192.168.1.20", channel: 0, name: "Plug South"  }
];

/* === VC DEFINITIONS ===
 * Index layout — parallel to vcIds[]:
 *   0  group   "EcoFlow STREAM Ultra"
 *   1  number  Battery SOC          (cmsBattSoc, %)
 *   2  number  Battery Power        (powGetBpCms, W; + = charging, - = discharging)
 *   3  number  PV Power             (powGetPvSum, W)
 *   4  number  Grid Power           (powGetSysGrid, W; + = import)
 *   5  number  Load Power           (powGetSysLoad, W)
 *   6  number  Backup Reserve SOC   (backupReverseSoc, %)
 *   7  number  Meters Total         (sum of polled Shelly devices, W)
 *   8  boolean Feed Grid            (feedGridMode == 1)
 *   9  boolean Night Mode           (derived from nightStart/nightEnd window)
 */

var VC_REFRESH_MS = 30000;  // how often to call EcoFlow API and refresh VC values (ms)

var VC_SPECS = [
    ["group",   "EcoFlow STREAM Ultra", null, null,   null  ],
    ["number",  "Battery SOC",          "%",   0,     100   ],
    ["number",  "Battery Power",        "W",  -5000,  5000  ],
    ["number",  "PV Power",             "W",   0,     10000 ],
    ["number",  "Grid Power",           "W",  -10000, 10000 ],
    ["number",  "Load Power",           "W",   0,     10000 ],
    ["number",  "Backup Reserve SOC",   "%",   0,     100   ],
    ["number",  "Meters Total",         "W",  -10000, 10000 ],
    ["boolean", "Feed Grid",            null,  null,  null  ],
    ["boolean", "Night Mode",           null,  null,  null  ]
];

/* === STATE === */

var CFG        = null;
var DEVICES    = [];
var lastMode   = "";
var busy       = false;
var LOG_METERS = false;
var lastSoc    = 50;    // cached from last refreshEco
var lastMinDsg = 30;
var lastTotalW = 0;
var vcIds      = [];    // numeric VC ids, parallel to VC_SPECS; undefined until created
var vcReady    = false;
var vcQueue    = [];    // index-based Number.Set / Boolean.Set call queue
var vcQueueIdx = 0;
var vcQueueRun = false;

/* === SHA-256 === */

var SHA256_W = [];  // scratch buffer reused across sha256bytes calls — avoids per-call allocation

var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function strToBytes(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c < 0x80) {
            b.push(c);
        } else if (c < 0x800) {
            b.push(0xC0 | (c >> 6));
            b.push(0x80 | (c & 0x3F));
        } else {
            b.push(0xE0 | (c >> 12));
            b.push(0x80 | ((c >> 6) & 0x3F));
            b.push(0x80 | (c & 0x3F));
        }
    }
    return b;
}

function hexByte(hex, i) {
    var hi = hex.charCodeAt(i);
    var lo = hex.charCodeAt(i + 1);
    hi = hi <= 57 ? hi - 48 : hi - 87;
    lo = lo <= 57 ? lo - 48 : lo - 87;
    return (hi << 4) | lo;
}

function sha256bytes(b) {
    var msgLen = b.length;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0x00);
    var bitLen = msgLen * 8;
    b.push(0); b.push(0); b.push(0); b.push(0);
    b.push((bitLen >>> 24) & 0xFF);
    b.push((bitLen >>> 16) & 0xFF);
    b.push((bitLen >>> 8)  & 0xFF);
    b.push( bitLen         & 0xFF);
    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = SHA256_W;
    var x, s0, s1, tmp1, tmp2, a, bb, c, d, e, f, g, h, ch, maj, S0, S1;
    for (var blk = 0; blk < b.length; blk += 64) {
        for (var t = 0; t < 16; t++) {
            W[t] = ((b[blk + t*4] << 24) | (b[blk + t*4 + 1] << 16) | (b[blk + t*4 + 2] << 8) | b[blk + t*4 + 3]) >>> 0;
        }
        for (var t = 16; t < 64; t++) {
            x = W[t - 15]; s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
            x = W[t - 2];  s1 = (((x >>> 17) | (x << 15)) ^ ((x >>> 19) | (x << 13)) ^ (x >>> 10)) >>> 0;
            W[t] = ((W[t - 16] + s0 + W[t - 7] + s1) | 0) >>> 0;
        }
        a = H0; bb = H1; c = H2; d = H3; e = H4; f = H5; g = H6; h = H7;
        for (var t = 0; t < 64; t++) {
            S1   = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
            ch   = ((e & f) ^ (~e & g)) >>> 0;
            tmp1 = ((h + S1 + ch + K256[t] + W[t]) | 0) >>> 0;
            S0   = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
            maj  = ((a & bb) ^ (a & c) ^ (bb & c)) >>> 0;
            tmp2 = ((S0 + maj) | 0) >>> 0;
            h = g; g = f; f = e;
            e = ((d + tmp1) | 0) >>> 0;
            d = c; c = bb; bb = a;
            a = ((tmp1 + tmp2) | 0) >>> 0;
        }
        H0 = ((H0 + a)  | 0) >>> 0;  H1 = ((H1 + bb) | 0) >>> 0;
        H2 = ((H2 + c)  | 0) >>> 0;  H3 = ((H3 + d)  | 0) >>> 0;
        H4 = ((H4 + e)  | 0) >>> 0;  H5 = ((H5 + f)  | 0) >>> 0;
        H6 = ((H6 + g)  | 0) >>> 0;  H7 = ((H7 + h)  | 0) >>> 0;
    }
    var hx  = "0123456789abcdef";
    var hex = "";
    var arr = [H0, H1, H2, H3, H4, H5, H6, H7];
    for (var i = 0; i < 8; i++) {
        var v = arr[i];
        for (var s = 28; s >= 0; s -= 4) hex += hx[(v >>> s) & 0xF];
    }
    return hex;
}

function hmacSha256(key, message) {
    var keyBytes = strToBytes(key);
    if (keyBytes.length > 64) {
        var kh = sha256bytes(keyBytes);
        keyBytes = [];
        for (var i = 0; i < 64; i += 2) keyBytes.push(hexByte(kh, i));
    }
    while (keyBytes.length < 64) keyBytes.push(0x00);
    var opad = [], ipad = [];
    for (var i = 0; i < 64; i++) {
        opad.push(keyBytes[i] ^ 0x5C);
        ipad.push(keyBytes[i] ^ 0x36);
    }
    var msgBytes = strToBytes(message);
    for (var i = 0; i < msgBytes.length; i++) ipad.push(msgBytes[i]);
    var innerHex = sha256bytes(ipad);
    for (var i = 0; i < 64; i += 2) opad.push(hexByte(innerHex, i));
    return sha256bytes(opad);
}

/* === ECOFLOW SIGNING === */

function addSignParts(obj, prefix, out) {
    prefix = prefix || "";
    for (var k in obj) {
        var fk = prefix ? (prefix + "." + k) : k;
        var v = obj[k];
        if (typeof v === "boolean") {
            out.push(fk + "=" + (v ? "true" : "false"));
        } else if (typeof v === "object" && v !== null) {
            addSignParts(v, fk, out);
        } else {
            out.push(fk + "=" + String(v));
        }
    }
}

function sortStrings(arr) {
    var n = arr.length;
    for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
            if (arr[i] > arr[j]) { var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
        }
    }
    return arr;
}

function buildAuth(paramsToSign) {
    var nonce = String(Math.floor(100000 + Math.random() * 900000));
    var ts    = String(Math.floor(Date.now()));
    var parts = [];
    addSignParts(paramsToSign, "", parts);
    sortStrings(parts);
    parts.push("accessKey=" + CFG.accessKey);
    parts.push("nonce=" + nonce);
    parts.push("timestamp=" + ts);
    return { sign: hmacSha256(CFG.secretKey, parts.join("&")), nonce: nonce, ts: ts };
}

function makeHeaders(paramsToSign, includeContentType) {
    var auth = buildAuth(paramsToSign);
    var headers = {
        "accessKey" : CFG.accessKey,
        "nonce"     : auth.nonce,
        "timestamp" : auth.ts,
        "sign"      : auth.sign
    };
    if (includeContentType) headers["Content-Type"] = "application/json;charset=UTF-8";
    return headers;
}

/* === ECOFLOW API === */

var ECO_HOSTS = { eu: "https://api-e.ecoflow.com", us: "https://api-a.ecoflow.com" };

function ecoHost() { return ECO_HOSTS[CFG.region] || ECO_HOSTS.eu; }

function ecoGetAll(cb) {
    Timer.set(0, false, function() {
        var signParams = { sn: CFG.serial };
        Shelly.call("HTTP.Request", {
            method  : "GET",
            url     : ecoHost() + "/iot-open/sign/device/quota/all?sn=" + CFG.serial,
            timeout : 10,
            headers : makeHeaders(signParams, false)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoGetAll HTTP error " + String(ec));
                cb("http_error", null); return;
            }
            var body = JSON.parse(res.body);
            if (!body || body.code !== "0") {
                print("[EcoFlow] ecoGetAll API error: " + (body ? body.message : "?"));
                cb("api_error", null); return;
            }
            // Extract only the fields we need; drops the large body object from scope
            var d = body.data;
            cb(null, {
                cmsBattSoc:       d.cmsBattSoc,
                powGetBpCms:      d.powGetBpCms,
                powGetPvSum:      d.powGetPvSum,
                powGetSysGrid:    d.powGetSysGrid,
                powGetSysLoad:    d.powGetSysLoad,
                backupReverseSoc: d.backupReverseSoc,
                feedGridMode:     d.feedGridMode,
                cmsMinDsgSoc:     d.cmsMinDsgSoc
            });
        });
    });
}

function ecoSet(params, cb) {
    Timer.set(0, false, function() {
        var body = {
            sn      : CFG.serial,
            cmdId   : CFG.cmdId,
            cmdFunc : CFG.cmdFunc,
            dirDest : CFG.dirDest,
            dirSrc  : CFG.dirSrc,
            dest    : CFG.dest,
            needAck : true,
            params  : params
        };
        Shelly.call("HTTP.Request", {
            method  : "PUT",
            url     : ecoHost() + "/iot-open/sign/device/quota",
            timeout : 10,
            headers : makeHeaders(body, true),
            body    : JSON.stringify(body)
        }, function(res, ec) {
            if (ec !== 0 || !res || res.code !== 200) {
                print("[EcoFlow] ecoSet HTTP error " + String(ec));
                if (cb) cb("http_error"); return;
            }
            var resp = JSON.parse(res.body);
            if (!resp || resp.code !== "0") {
                var code = resp ? String(resp.code) : "?";
                print("[EcoFlow] ecoSet API error " + code + ": " + (resp ? resp.message : "?"));
                if (cb) cb(code); return;
            }
            if (cb) cb(null);
        });
    });
}

/* === ECOFLOW COMMANDS === */

function requestIdle(soc, minDsg, cb) {
    var hold = (soc > (minDsg + 1)) ? soc : (minDsg + 1);
    print("[Logic] requestIdle holdSoc=" + String(hold));
    ecoSet({ cfgBackupReverseSoc: hold, cfgFeedGridMode: 0 }, cb);
}

function requestDischarge(cb) {
    print("[Logic] requestDischarge");
    ecoSet({ cfgFeedGridMode: 1, cfgBackupReverseSoc: 35 }, function(err) {
        if (err) { if (cb) cb(err); return; }
        Timer.set(200, false, function() {
            ecoSet(
                {
                    cfgEnergyStrategyOperateMode: {
                        operateSelfPoweredOpen: true,
                        operateIntelligentScheduleModeOpen: false
                    }
                },
                cb
            );
        });
    });
}

function requestCharge(cb) {
    print("[Logic] requestCharge");
    ecoSet(
        {
            cfgFeedGridMode     : 1,
            cfgBackupReverseSoc : CFG.nightSoc
        },
        function(err) {
            if (err) { if (cb) cb(err); return; }
            Timer.set(200, false, function() {
                ecoSet(
                    {
                        cfgEnergyStrategyOperateMode: {
                            operateSelfPoweredOpen: true,
                            operateIntelligentScheduleModeOpen: false
                        }
                    },
                    cb
                );
            });
        }
    );
}

/* === DEVICE POLLING === */

function pollDevice(dev, cb) {
    var path = (dev.type === "em")
        ? "/rpc/EM1.GetStatus?id="    + String(dev.channel)
        : "/rpc/Switch.GetStatus?id=" + String(dev.channel);
    Shelly.call("HTTP.Request", {
        method  : "GET",
        url     : "http://" + dev.host + path,
        timeout : 5
    }, function(res, ec) {
        if (ec !== 0 || !res || res.code !== 200) {
            print("[Shelly] " + dev.name + " unreachable (ec=" + String(ec) + "), using 0 W");
            cb(0); return;
        }
        var data  = JSON.parse(res.body);
        var watts = (dev.type === "em") ? (data.act_power || 0) : (data.apower || 0);
        if (LOG_METERS) print("[Shelly] " + dev.name + ": " + String(Math.round(watts)) + " W");
        cb(watts);
    });
}

function pollAll(idx, totalW, cb) {
    if (idx >= DEVICES.length) { cb(totalW); return; }
    pollDevice(DEVICES[idx], function(w) {
        Timer.set(75, false, function() { pollAll(idx + 1, totalW + w, cb); });
    });
}

/* === NIGHT WINDOW === */

function getLocalHour() {
    var sys = Shelly.getComponentStatus("sys");
    if (sys) {
        if (sys.unixtime !== undefined && sys.utc_offset !== undefined) {
            var local = sys.unixtime + sys.utc_offset;
            var hour  = Math.floor((local % 86400) / 3600);
            if (hour >= 0 && hour <= 23) return hour;
        }
        if (sys.time && sys.time.length >= 2) {
            return (sys.time.charCodeAt(0) - 48) * 10 + (sys.time.charCodeAt(1) - 48);
        }
    }
    return Math.floor((Date.now() / 3600000) % 24);
}

function isNight() {
    var h = getLocalHour();
    var s = CFG.nightStart;
    var e = CFG.nightEnd;
    if (s === e) return true;
    if (s < e)   return h >= s && h < e;
    return h >= s || h < e;  // wraps midnight: e.g. 23–06
}

/* === VIRTUAL COMPONENTS === */

function drainVcQueue() {
    if (vcQueueIdx >= vcQueue.length) {
        vcQueue = []; vcQueueIdx = 0; vcQueueRun = false; return;
    }
    vcQueueRun = true;
    var item = vcQueue[vcQueueIdx];
    vcQueueIdx = vcQueueIdx + 1;
    if (VC_SPECS[item[0]][0] === "number") {
        Shelly.call("Number.Set",  { id: vcIds[item[0]], value: item[1] }, function() { drainVcQueue(); });
    } else {
        Shelly.call("Boolean.Set", { id: vcIds[item[0]], value: item[1] }, function() { drainVcQueue(); });
    }
}

function setVc(idx, val) {
    if (vcIds[idx] === null || vcIds[idx] === undefined) return;
    var type = VC_SPECS[idx][0];
    if (type !== "number" && type !== "boolean") return;
    vcQueue.push([idx, val]);
    if (!vcQueueRun) drainVcQueue();
}

function updateVCs(totalW, data) {
    if (!vcReady) { print("[VC] updateVCs skipped — not ready"); return; }
    var battSoc   = data ? (parseFloat(data.cmsBattSoc)       || 0) : 0;
    var batPower  = data ? (parseFloat(data.powGetBpCms)      || 0) : 0;
    var pvPower   = data ? (parseFloat(data.powGetPvSum)      || 0) : 0;
    var gridPower = data ? (parseFloat(data.powGetSysGrid)    || 0) : 0;
    var loadPower = data ? (parseFloat(data.powGetSysLoad)    || 0) : 0;
    var backupSoc = data ? (parseInt(data.backupReverseSoc)   || 0) : 0;
    var feedGrid  = data ? (parseInt(data.feedGridMode) === 1)      : false;

    setVc(1, Math.round(battSoc));
    setVc(2, Math.round(batPower));
    setVc(3, Math.round(pvPower));
    setVc(4, Math.round(gridPower));
    setVc(5, Math.round(loadPower));
    setVc(6, backupSoc);
    setVc(7, Math.round(totalW));
    setVc(8, feedGrid);
    setVc(9, isNight());
}

function addOneVC(idx, cb) {
    var spec = VC_SPECS[idx];
    var cfg  = { name: spec[1] };
    if (spec[0] === "number") {
        cfg.unit = spec[2];
        cfg.min  = spec[3];
        cfg.max  = spec[4];
    }
    Shelly.call("Virtual.Add", { type: spec[0], config: cfg }, function(res, ec) {
        if (ec === 0 && res && res.id !== undefined) {
            vcIds[idx] = res.id;
            print("[VC] Created '" + spec[1] + "' id=" + String(res.id));
        } else {
            print("[VC] Create failed '" + spec[1] + "' ec=" + String(ec));
            vcIds[idx] = null;
        }
        Timer.set(150, false, function() { cb(); });
    });
}

function matchAndCreate(idx, existing, cb) {
    if (idx >= VC_SPECS.length) {
        var dbg = "";
        for (var di = 0; di < vcIds.length; di++) dbg += String(vcIds[di]) + ",";
        print("[VC] Setup done. ids=" + dbg);
        vcReady = true; cb(); return;
    }
    var vcName = VC_SPECS[idx][1];
    var found  = null;
    for (var i = 0; i < existing.length; i++) {
        if (existing[i][0] === vcName) { found = existing[i][1]; break; }
    }
    if (found !== null && found !== undefined) {
        vcIds[idx] = found;
        print("[VC] Found '" + vcName + "' id=" + String(found));
        Timer.set(0, false, function() { matchAndCreate(idx + 1, existing, cb); });
    } else {
        addOneVC(idx, function() { matchAndCreate(idx + 1, existing, cb); });
    }
}

function ensureVCs(cb) {
    Shelly.call("Shelly.GetComponents", { dynamic_only: true }, function(res, ec) {
        var raw  = (res && res.components) ? res.components : [];
        var tot  = res ? (res["total"] || raw.length) : raw.length;
        // Extract only [name, id] pairs — discards full component objects to save RAM
        var existing = [];
        for (var i = 0; i < raw.length; i++) {
            if (raw[i].config) existing.push([raw[i].config["name"], raw[i].config["id"]]);
        }
        if (tot <= raw.length) {
            print("[VC] GetComponents found=" + String(existing.length));
            matchAndCreate(0, existing, cb);
            return;
        }
        // Fetch the remainder (pagination — Shelly default page is 9)
        Shelly.call("Shelly.GetComponents", { dynamic_only: true, offset: raw.length }, function(res2, ec2) {
            var raw2 = (res2 && res2.components) ? res2.components : [];
            for (var i = 0; i < raw2.length; i++) {
                if (raw2[i].config) existing.push([raw2[i].config["name"], raw2[i].config["id"]]);
            }
            print("[VC] GetComponents found=" + String(existing.length));
            matchAndCreate(0, existing, cb);
        });
    });
}

/* === VC REFRESH (separate timer — keeps ecoGetAll out of the 5 s hot loop) === */

function refreshEco() {
    if (!vcReady) return;
    ecoGetAll(function(err, data) {
        if (err) return;
        lastSoc    = parseInt(data.cmsBattSoc)   || 50;
        lastMinDsg = parseInt(data.cmsMinDsgSoc) || 30;
        updateVCs(lastTotalW, data);
    });
}

/* === CONTROL LOOP === */

function runOnce() {
    if (!CFG || busy) return;
    busy = true;
    pollAll(0, 0, function(totalW) {
        lastTotalW = totalW;
        var night  = isNight();

        print("[Logic] total=" + String(Math.round(totalW)) + "W  threshold=" +
              String(CFG.threshold) + "W  night=" + String(night) +
              "  soc=" + String(lastSoc) + "%  lastMode=" + lastMode);

        if (night) {
            if (lastMode !== "charge") {
                requestCharge(function(e) {
                    if (!e) lastMode = "charge";
                    busy = false;
                });
            } else {
                busy = false;
            }
        } else if (totalW > CFG.threshold) {
            if (lastMode !== "discharge") {
                print("[Logic] " + String(Math.round(totalW)) + " W > " +
                      String(CFG.threshold) + " W → discharge");
                requestDischarge(function(e) {
                    if (!e) lastMode = "discharge";
                    busy = false;
                });
            } else {
                busy = false;
            }
        } else {
            var needStop = (lastMode === "discharge" || lastMode === "charge" || lastMode === "");
            if (needStop) {
                print("[Logic] " + String(Math.round(totalW)) + " W <= " +
                      String(CFG.threshold) + " W → idle");
                requestIdle(lastSoc, lastMinDsg, function(e) {
                    if (!e) lastMode = "idle";
                    busy = false;
                });
            } else {
                busy = false;
            }
        }
    });
}

/* === INIT === */
// Config is read from the embedded CONFIG and DEVICES_CFG objects above.
// VCs are looked up by name on restart and reused; missing ones are created.

function init() {
    if (!CONFIG.accessKey || !CONFIG.secretKey || !CONFIG.serial) {
        print("[Init] ERROR: Fill in CONFIG.accessKey, CONFIG.secretKey and CONFIG.serial before running.");
        return;
    }

    CFG = {
        accessKey  : CONFIG.accessKey,
        secretKey  : CONFIG.secretKey,
        serial     : CONFIG.serial,
        region     : CONFIG.region    || "eu",
        cmdId      : CONFIG.cmdId     || 17,
        cmdFunc    : CONFIG.cmdFunc   || 254,
        dirDest    : CONFIG.dirDest   || 1,
        dirSrc     : CONFIG.dirSrc    || 1,
        dest       : CONFIG.dest      || 2,
        nightStart : CONFIG.nightStart !== undefined ? CONFIG.nightStart : 23,
        nightEnd   : CONFIG.nightEnd   !== undefined ? CONFIG.nightEnd   :  6,
        nightSoc   : CONFIG.nightSoc   || 95,
        pollMs     : CONFIG.pollMs     || 5000,
        threshold  : CONFIG.threshold  || 600
    };

    DEVICES = DEVICES_CFG;

    if (DEVICES.length === 0) {
        print("[Init] WARNING: DEVICES_CFG is empty — no meters to poll.");
    }

    print("[Init] " + String(DEVICES.length) + " device(s), " +
          "threshold=" + String(CFG.threshold) + " W, " +
          "poll=" + String(CFG.pollMs) + " ms, " +
          "night=" + String(CFG.nightStart) + ":00-" + String(CFG.nightEnd) + ":00");

    ensureVCs(function() {
        print("[Init] VCs ready (" + String(VC_SPECS.length - 1) + " + 1 group)");
        refreshEco();                               // initial VC population
        runOnce();
        Timer.set(CFG.pollMs,    true, runOnce);   // mode control every pollMs
        Timer.set(VC_REFRESH_MS, true, refreshEco); // VC + soc refresh every 30 s
    });
}

init();
