/**
 * @title Vc Modes Deye
 * @description Application example demonstrating alternate Virtual Component display modes for Deye inverters.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/vc_modes_deye.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Growatt solar inverter.
    ENTITIES-based version + Virtual Components.
*/

let ENABLE_MODBUS_LOCAL = 0;
let ENABLE_MODBUS_REMOTE = 1;

// ============================================================================
// DYNAMIC MODBUS SLAVE ID
// ============================================================================
// The Modbus slave/unit ID must never be hardcoded into script logic. It is
// exposed as a persisted Virtual Component (number:299, range 1-247) so it
// can be reconfigured from an app/config UI without redeploying code.
// getSlaveId() reads the component live on every use, clamps it into range,
// and writes the clamped value back if it was out of range.

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

// MODBUS-RTU endpoint; rebuilt whenever the slave ID Virtual Component changes.
// Only created when ENABLE_MODBUS_LOCAL is set (this example defaults to the
// HTTP-remote path, ENABLE_MODBUS_REMOTE).
var MODBUS_ENDPOINT = null;
var ENTRY_OUTPUT_CONFIG = null;

function rebuildModbusEndpoint() {
  if (!ENABLE_MODBUS_LOCAL) return;
  MODBUS_ENDPOINT = ModbusController.get(getSlaveId(), { baud: 9600, mode: "8N1" });
  ENTRY_OUTPUT_CONFIG = MODBUS_ENDPOINT.addEntity({ addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" });
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
// VIRTUAL COMPONENT MANIFEST
// ============================================================================
// NOTE: option values are the raw u16 register values this script writes.
// Adjust the option list to match your inverter's documented mode codes.

var VIRTUAL_COMPONENTS = {
  components: [
    {
      key: 'batteryPriorityMode',
      type: 'enum',
      id: 202,
      config: {
        name: 'Battery Priority Mode',
        options: ['0', '1', '2'],
        default_value: '0',
        persisted: false,
        meta: { ui: { view: 'dropdown' } }
      }
    },
    {
      key: 'passiveGridBalancing',
      type: 'enum',
      id: 203,
      config: {
        name: 'Passive Grid-Connected Power Balancing',
        options: ['0', '1'],
        default_value: '0',
        persisted: false,
        meta: { ui: { view: 'dropdown' } }
      }
    },
    {
      key: 'activeGridBalancing',
      type: 'enum',
      id: 204,
      config: {
        name: 'Active Grid-Connected Power Balancing',
        options: ['0', '1'],
        default_value: '0',
        persisted: false,
        meta: { ui: { view: 'dropdown' } }
      }
    },
    {
      key: 'slaveId',
      type: 'number',
      id: 299,
      config: {
        name: 'Modbus Slave ID',
        min: MIN_SLAVE_ID,
        max: MAX_SLAVE_ID,
        default_value: DEFAULT_SLAVE_ID,
        persisted: true,
        meta: { ui: { view: 'input' }, cloud: ['status'], role: 'modbus_id' }
      }
    }
  ],
  groups: [
    {
      id: 200,
      name: 'Deye SG02LP1 VC Modes',
      components: ['batteryPriorityMode', 'passiveGridBalancing', 'activeGridBalancing', 'slaveId']
    }
  ]
};

var battery_priority_mode_vc = null;
var passive_grid_connected_power_balancing_vc = null;
var active_grid_connected_power_balancing_vc = null;

//
var battery_priority_mode = 0;

//
var passive_grid_connected_power_balancing = 0;

//
var active_grid_connected_power_balancing = 0;

//
var energy_management_model = 0;

function init(){
  ensureVirtualComponents(VIRTUAL_COMPONENTS, function(ok, readyVc) {
    if (!ok) {
      console.log('ERROR: Virtual component setup failed');
      return;
    }

    battery_priority_mode_vc = readyVc.handles.batteryPriorityMode;
    passive_grid_connected_power_balancing_vc = readyVc.handles.passiveGridBalancing;
    active_grid_connected_power_balancing_vc = readyVc.handles.activeGridBalancing;

    slaveIdHandle = readyVc.handles.slaveId;
    rebuildModbusEndpoint();
    slaveIdHandle.on('change', function() {
      console.log('Modbus Slave ID changed -> ' + getSlaveId());
      rebuildModbusEndpoint();
    });

    initModes();
  });
}

function initModes(){

    // Read information from inverter via modbus.
    if (ENABLE_MODBUS_LOCAL){
        ENTRY_OUTPUT_CONFIG.readOnce();
        output_config_state = ENTRY_OUTPUT_CONFIG.getValue();
        output_config_vc.setValue(output_config_state.toString());
    }

    // Read information from inverter via modbus (HTTP).
    if (ENABLE_MODBUS_REMOTE){
        Shelly.call("HTTP.GET",
        {
            url: "http://10.101.3.140/rpc/MRC.ReadHoldingRegisters?sid="+getSlaveId()+"&qty=1&addr=141&itype=regtype_holding",
        },
        function(result, error_code, error_message) {
            if (error_code == 0){
                let struct_result = JSON.parse(result.body);
                energy_management_model = struct_result.values
                console.log(energy_management_model);
                // Populate virtual components.
                // output_config_vc.setValue(output_config_state.toString());
            }else{
                console.log("Error code: " + error_code);
                console.log("Error message: " + error_message);
            }
        });
    }

    // Battery Priority Mode
    battery_priority_mode_vc.on("change", function(ev){
        battery_priority_mode = ev.value;
        console.log("Output Config: ", battery_priority_mode);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 1, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [battery_priority_mode],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
    // Passive Grid-Connected Power Balancing
    passive_grid_connected_power_balancing_vc.on("change", function(ev){
        passive_grid_connected_power_balancing = ev.value;
        console.log("Charge Config: ", passive_grid_connected_power_balancing);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [passive_grid_connected_power_balancing],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
    // Active Grid-Connected Power Balancing Not on / closed
    active_grid_connected_power_balancing_vc.on("change", function(ev){
        active_grid_connected_power_balancing = ev.value;
        console.log("Charge Config: ", active_grid_connected_power_balancing);
        if (ENABLE_MODBUS_LOCAL){
            // Function code: 0x10
            MODBUS_ENDPOINT.writeRegisters(
                { addr: 2, rtype: ModbusController.REGTYPE_HOLDING, itype: "u16" },
                [active_grid_connected_power_balancing],
                function (success, error){
                    if (!success){
                        console.log("Success: " + success);
                        console.log("Error: " + error);
                    }
            });
        }
    });
}

init();