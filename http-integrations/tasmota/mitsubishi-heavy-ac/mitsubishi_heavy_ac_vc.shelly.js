/**
 * @title Mitsubishi Heavy AC control via Tasmota IR bridge
 * @description Creates Virtual Components for Mitsubishi Heavy HVAC control
 *   and sends IRHVAC commands to one or more Tasmota IR bridges over HTTP.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/http-integrations/tasmota/mitsubishi-heavy-ac/mitsubishi_heavy_ac_vc.shelly.js
 */

/**
 * Mitsubishi Heavy AC Virtual Components Controller
 *
 * This script builds a Shelly-side control panel for one or more Mitsubishi
 * Heavy indoor units controlled through Tasmota IR bridges.
 *
 * Workflow:
 * - Creates Virtual Components for power, mode, fan, temperature, swing, and target
 * - Lets the user change values in the Shelly app
 * - Sends the selected state only when the Apply button is pressed
 *
 * Tasmota requirements:
 * - Each target IP must be reachable from the Shelly device
 * - The target device must expose the Tasmota command endpoint `/cm`
 * - The IR bridge must support the `IRHVAC` command for
 *   `MITSUBISHI_HEAVY_88`
 *
 * Virtual Components created:
 * - group:208    Mitsubishi Heavy AC
 * - boolean:200  AC Power
 * - enum:202     AC Mode
 * - enum:203     AC Fan
 * - number:204   AC Temp
 * - enum:205     AC Swing V
 * - button:206   Apply HVAC
 * - enum:209     IR Target
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var TASMOTA_CM_PATH = '/cm?cmnd=';

var IR_TARGETS = ['Zone 1', 'Zone 2', 'All'];

var IR_TARGET_IPS = {
  'Zone 1': '192.0.2.10',
  'Zone 2': '192.0.2.11',
};

var COMPONENT_IDS = {
  power: 200,
  mode: 202,
  fan: 203,
  temp: 204,
  swingV: 205,
  apply: 206,
  group: 208,
  target: 209,
};

var DEFAULTS = {
  power: true,
  mode: 'Heat',
  fan: 'Auto',
  temp: 20,
  swingV: 'Auto',
  target: 'Zone 2',
};

var MODES = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
var FAN_SPEEDS = ['Auto', 'Min', 'Low', 'Med', 'High', 'Max'];
var SWING_V = ['Off', 'Auto', 'Min', 'Low', 'Mid', 'High', 'Max'];

var LEGACY_COMPONENT_KEYS = [
  'enum:204',
  'boolean:202',
  'boolean:201',
  'text:207',
  'button:210',
];

// ============================================================================
// STATE
// ============================================================================

var vc = {};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(msg) {
  print('[mitsubishi-heavy-ac-vc] ' + msg);
}

function setStatus(msg) {
  log(msg);
}

function readValue(handle, fallback) {
  var value;

  if (!handle) return fallback;

  value = handle.getValue();
  if (value === null || value === undefined) return fallback;

  return value;
}

function toHex(code) {
  var hex = code.toString(16).toUpperCase();
  return hex.length < 2 ? '0' + hex : hex;
}

function urlEncode(str) {
  var out = '';
  var i;
  var ch;
  var code;

  for (i = 0; i < str.length; i++) {
    ch = str.charAt(i);
    code = str.charCodeAt(i);

    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      ch === '-' ||
      ch === '_' ||
      ch === '.' ||
      ch === '~'
    ) {
      out += ch;
    } else {
      out += '%' + toHex(code);
    }
  }

  return out;
}

function getTargetIps() {
  var target = readValue(vc.target, DEFAULTS.target);

  if (target === 'All') {
    return [IR_TARGET_IPS['Zone 1'], IR_TARGET_IPS['Zone 2']];
  }

  return [IR_TARGET_IPS[target]];
}

function buildAcState() {
  return {
    Vendor: 'MITSUBISHI_HEAVY_88',
    Power: readValue(vc.power, DEFAULTS.power) ? 'On' : 'Off',
    Beep: 'On',
    SwingV: readValue(vc.swingV, DEFAULTS.swingV),
    Mode: readValue(vc.mode, DEFAULTS.mode),
    FanSpeed: readValue(vc.fan, DEFAULTS.fan),
    Temp: parseInt(readValue(vc.temp, DEFAULTS.temp), 10),
  };
}

// ============================================================================
// VIRTUAL COMPONENT SETUP
// ============================================================================

function ensureComponent(type, id, config, cb) {
  var key = type + ':' + id;
  var handle = Virtual.getHandle(key);

  function finalize() {
    vc[id] = Virtual.getHandle(key);
    if (!vc[id]) {
      log('Failed to get handle for ' + key);
      if (cb) cb(false);
      return;
    }

    vc[id].setConfig(config);
    if (cb) cb(true);
  }

  if (handle) {
    vc[id] = handle;
    handle.setConfig(config);
    if (cb) cb(true);
    return;
  }

  Shelly.call('Virtual.Add', { type: type, id: id, config: config }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Add failed for ' + key + ': ' + errCode + ' ' + errMsg);
      if (cb) cb(false);
      return;
    }

    finalize();
  });
}

function deleteComponent(key, cb) {
  Shelly.call('Virtual.Delete', { key: key }, function(res, errCode, errMsg) {
    if (errCode !== 0) {
      log('Virtual.Delete skipped for ' + key + ': ' + errCode + ' ' + errMsg);
    }

    if (cb) cb();
  });
}

function deleteLegacyComponents(index, done) {
  if (index >= LEGACY_COMPONENT_KEYS.length) {
    done();
    return;
  }

  deleteComponent(LEGACY_COMPONENT_KEYS[index], function() {
    deleteLegacyComponents(index + 1, done);
  });
}

function getComponentSpecs() {
  return [
    {
      type: 'group',
      id: COMPONENT_IDS.group,
      config: {
        name: 'Mitsubishi Heavy AC',
      },
    },
    {
      type: 'boolean',
      id: COMPONENT_IDS.power,
      config: {
        name: 'AC Power',
        persisted: true,
        default_value: DEFAULTS.power,
        meta: {
          ui: {
            view: 'toggle',
            titles: ['Off', 'On'],
          },
        },
      },
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.mode,
      config: {
        name: 'AC Mode',
        persisted: true,
        default_value: DEFAULTS.mode,
        options: MODES,
        meta: {
          ui: {
            view: 'Dropdown',
          },
        },
      },
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.fan,
      config: {
        name: 'AC Fan',
        persisted: true,
        default_value: DEFAULTS.fan,
        options: FAN_SPEEDS,
        meta: {
          ui: {
            view: 'Dropdown',
          },
        },
      },
    },
    {
      type: 'number',
      id: COMPONENT_IDS.temp,
      config: {
        name: 'AC Temp',
        persisted: true,
        default_value: DEFAULTS.temp,
        min: 16,
        max: 31,
        meta: {
          ui: {
            view: 'slider',
            unit: 'C',
            step: 1,
          },
        },
      },
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.swingV,
      config: {
        name: 'AC Swing V',
        persisted: true,
        default_value: DEFAULTS.swingV,
        options: SWING_V,
        meta: {
          ui: {
            view: 'Dropdown',
          },
        },
      },
    },
    {
      type: 'button',
      id: COMPONENT_IDS.apply,
      config: {
        name: 'Apply HVAC',
        meta: {
          ui: {
            view: 'Button',
          },
        },
      },
    },
    {
      type: 'enum',
      id: COMPONENT_IDS.target,
      config: {
        name: 'IR Target',
        persisted: true,
        default_value: DEFAULTS.target,
        options: IR_TARGETS,
        meta: {
          ui: {
            view: 'Dropdown',
          },
        },
      },
    },
  ];
}

function ensureComponents(index, steps, done) {
  if (index >= steps.length) {
    Shelly.call(
      'Group.Set',
      {
        id: COMPONENT_IDS.group,
        value: [
          'boolean:' + COMPONENT_IDS.power,
          'enum:' + COMPONENT_IDS.mode,
          'enum:' + COMPONENT_IDS.fan,
          'number:' + COMPONENT_IDS.temp,
          'enum:' + COMPONENT_IDS.swingV,
          'enum:' + COMPONENT_IDS.target,
          'button:' + COMPONENT_IDS.apply,
        ],
      },
      function(res, errCode, errMsg) {
        if (errCode !== 0) {
          log('Group.Set failed: ' + errCode + ' ' + errMsg);
          done(false);
          return;
        }

        done(true);
      }
    );
    return;
  }

  ensureComponent(steps[index].type, steps[index].id, steps[index].config, function(ok) {
    if (!ok) {
      done(false);
      return;
    }

    Timer.set(1, false, function() {
      ensureComponents(index + 1, steps, done);
    });
  });
}

function ensureAllComponents(done) {
  deleteLegacyComponents(0, function() {
    ensureComponents(0, getComponentSpecs(), done);
  });
}

// ============================================================================
// TASMOTA COMMAND DISPATCH
// ============================================================================

function sendAcState(acState, successText) {
  var payload = 'IRHVAC ' + JSON.stringify(acState);
  var targets = getTargetIps();
  var pending = targets.length;
  var failed = 0;
  var lastError = '';

  setStatus('Sending...');

  function finishOne(ok, msg) {
    pending -= 1;

    if (!ok) {
      failed += 1;
      lastError = msg;
    }

    if (pending > 0) return;

    if (failed === 0) {
      setStatus(successText);
      return;
    }

    if (failed === targets.length) {
      setStatus('Send failed: ' + lastError);
      return;
    }

    setStatus('Partial send failure: ' + lastError);
  }

  targets.forEach(function(ip) {
    var url = 'http://' + ip + TASMOTA_CM_PATH + urlEncode(payload);

    Shelly.call('HTTP.GET', { url: url, timeout: 10 }, function(res, errCode, errMsg) {
      if (errCode !== 0) {
        log('HTTP.GET failed for ' + ip + ': ' + errCode + ' ' + errMsg);
        finishOne(false, 'HTTP ' + errCode + ' on ' + ip);
        return;
      }

      if (!res || res.code !== 200) {
        finishOne(false, 'Tasmota ' + (res ? res.code : 'no response') + ' on ' + ip);
        return;
      }

      finishOne(true, '');
    });
  });
}

function sendCurrentState() {
  var acState = buildAcState();

  sendAcState(
    acState,
    'Sent to ' +
      readValue(vc.target, DEFAULTS.target) +
      ': ' +
      acState.Power +
      ' ' +
      acState.Mode +
      ' ' +
      acState.Temp +
      'C'
  );
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function bindHandlers() {
  vc.power = vc[COMPONENT_IDS.power];
  vc.mode = vc[COMPONENT_IDS.mode];
  vc.fan = vc[COMPONENT_IDS.fan];
  vc.temp = vc[COMPONENT_IDS.temp];
  vc.swingV = vc[COMPONENT_IDS.swingV];
  vc.apply = vc[COMPONENT_IDS.apply];
  vc.target = vc[COMPONENT_IDS.target];

  if (vc.power) {
    vc.power.on('change', function(ev) {
      setStatus('Power set to ' + (ev.value ? 'On' : 'Off') + '. Press Apply HVAC.');
    });
  }

  if (vc.mode) {
    vc.mode.on('change', function(ev) {
      setStatus('Mode set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.fan) {
    vc.fan.on('change', function(ev) {
      setStatus('Fan set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.temp) {
    vc.temp.on('change', function(ev) {
      setStatus('Temp set to ' + parseInt(ev.value, 10) + 'C. Press Apply HVAC.');
    });
  }

  if (vc.swingV) {
    vc.swingV.on('change', function(ev) {
      setStatus('Swing V set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.target) {
    vc.target.on('change', function(ev) {
      setStatus('IR target set to ' + ev.value + '. Press Apply HVAC.');
    });
  }

  if (vc.apply) {
    vc.apply.on('single_push', function() {
      sendCurrentState();
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function main() {
  ensureAllComponents(function(ok) {
    if (!ok) {
      setStatus('Virtual component setup failed');
      return;
    }

    bindHandlers();
    setStatus('Ready. Configure values and press Apply HVAC.');
  });
}

main();
