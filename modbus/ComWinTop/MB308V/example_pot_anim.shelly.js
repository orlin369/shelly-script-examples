/**
 * @title Example Pot Anim
 * @description Analog output animation example for the ComWinTop CWT-MB308V.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/ComWinTop/MB308V/example_pot_anim.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicate for communication over MODBUS-RTU with CWT-308V IO module.

    The example combines analog inputs and digital outputs using 2 modbus functions.

    - Self-deploys a virtual component named AI0 (number, V).
    - Add it to group named ComWinTop CWT-MB308V Pot Anim Example.
*/

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
// CONFIGURATION
// ============================================================================

// Update rate (sec)
var UPDATE_RATE = 1;

// Get a MODBUS-RTU endpoint: ID 2, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(2, { baud: 9600, mode: "8N1" });

// Add a input register entity at address 0.
// Function code: 0x04
// Evry device have onwn spcification for each register.
// Make sure that you configure register addres, and interpretation properly.
let ENTRY_AI0 = MODBUS_ENDPOINT.addEntity({ addr: 0, rtype: ModbusController.REGTYPE_INPUT, itype: "i16" });

// Digital outputs states array representation.
var DOs = [false, false, false, false,
            false, false, false, false,
            false, false, false, false];

// ============================================================================
// VIRTUAL COMPONENT MANIFEST
// ============================================================================

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'ai0',
      type: 'number',
      id: 200,
      config: {
        name: 'AI0',
        default_value: 0,
        min: 0,
        max: 10,
        unit: 'V',
        persisted: false,
        meta: { ui: { view: 'progressbar' }, cloud: ['measurement'] }
      }
    }
  ],
  groups: [
    { id: 200, name: 'ComWinTop CWT-MB308V Pot Anim Example', components: ['ai0'] }
  ]
};

var vcHandles = null;

/*
    Run evry UPDATE_RATE seconds.
*/
function update(){
    // Read the entry value.
    ENTRY_AI0.readOnce();

    // Get the entry value and convert it to voltage.
    let voltage = (ENTRY_AI0.getValue() / 1100);

    // Update the virtual component with the new value
    if (vcHandles && vcHandles.ai0) {
      vcHandles.ai0.setValue(voltage);
    }

    // Print the voltage to the console.
    console.log("Voltage: " + voltage);

    // Make voltage to int.
    var to_on = parseInt(voltage);

    // Fill DOs with false.
    for (let i = 0; i < DOs.length; i++) {
        DOs[i] = false;
    }

    // Turn on only outputs that represent voltage value.
    for (let i = 0; i < to_on; i++) {
        DOs[i] = true;
    }

    // Function code: 0x01
    MODBUS_ENDPOINT.writeRegisters(
        { addr: 0, rtype: ModbusController.REGTYPE_COIL, itype: "i16" },
        DOs,
        function (success, error) {
            if (!success)
            {
                console.log("Success: " + success);
                console.log("Error: " + error);
            }
        });
}

/*
    Runs once at script start time.
*/
function init(){
    ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
        if (!ok) {
            console.log('ERROR: Virtual component setup failed');
            return;
        }
        vcHandles = readyVc.handles;
        Timer.set(parseInt(UPDATE_RATE*1000), true, update);
    });
}

// Run the application.
init();
