/**
 * @title Shekran External Display
 * @description Modbus RTU example script. Reads Deye SG02LP1 inverter data and displays on SHEKRAN ePaper display.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/Deye/SG02LP1/application_examples/shekran.shelly.js
 */

/*
    Shelly Europe Ltd. - Integrations Team

    This example is dedicated for communication over MODBUS-RTU with a Deye solar inverter.
    Data is displayed on a SHEKRAN IoT ePaper display via JSON-RPC 2.0 API.
    ENTITIES-based version + Virtual Components.

    SHEKRAN "main" screen widget IDs used:
      - "pv_power"       (lv_label) - PV1 Power [W]
      - "battery_power"  (lv_label) - Battery Power [W]
      - "grid_power"     (lv_label) - Total Grid Power [W]
      - "load_power"     (lv_label) - Total Power / Load [W]
*/

// Update rate (sec)
var UPDATE_RATE = 60;

// Inverter ID.
let INVERTER_ID = 1;

// SHEKRAN display JSON-RPC 2.0 endpoint.
let SHEKRAN_RPC_URL = "http://10.101.2.118/rpc";

// Get a MODBUS-RTU endpoint: ID 1, baud rate 9600, 8 data bits, No parity, 1 stop bit.
let MODBUS_ENDPOINT = ModbusController.get(INVERTER_ID, { baud: 9600, mode: "8N1" });

// ENTITIES table describing all parameters + mapping to virtual components and SHEKRAN widgets.
// widgetId: SHEKRAN widget ID on the "main" screen (null if not displayed).
let ENTITIES = [
  {
    name: "Total Power",
    units: "W",
    reg: {
      addr: 175,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:200",
    widgetId: "load_power",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Battery Power",
    units: "W",
    reg: {
      addr: 190,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:201",
    widgetId: "battery_power",
    handle: null,
    vcHandle: null,
  },
  {
    name: "PV1 Power",
    units: "W",
    reg: {
      addr: 186,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:202",
    widgetId: "pv_power",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Total Grid Power",
    units: "W",
    reg: {
      addr: 169,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 10,
    rights: "R",
    vcId: "number:203",
    widgetId: "grid_power",
    handle: null,
    vcHandle: null,
  },
  {
    name: "Battery SOC",
    units: "%",
    reg: {
      addr: 184,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 1,
    rights: "R",
    vcId: "number:204",
    widgetId: null,
    handle: null,
    vcHandle: null,
  },
  {
    name: "PV1 Voltage",
    units: "V",
    reg: {
      addr: 109,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
    vcId: "number:205",
    widgetId: null,
    handle: null,
    vcHandle: null,
  },
  {
    name: "Grid Voltage L1",
    units: "V",
    reg: {
      addr: 150,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.1,
    rights: "R",
    vcId: "number:206",
    widgetId: null,
    handle: null,
    vcHandle: null,
  },
  {
    name: "Current L1",
    units: "A",
    reg: {
      addr: 164,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "i16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
    rights: "R",
    vcId: "number:207",
    widgetId: null,
    handle: null,
    vcHandle: null,
  },
  {
    name: "AC Frequency",
    units: "Hz",
    reg: {
      addr: 192,
      rtype: ModbusController.REGTYPE_HOLDING,
      itype: "u16",
      bo: ModbusController.BE,
      wo: ModbusController.BE,
    },
    scale: 0.01,
    rights: "R",
    vcId: "number:208",
    widgetId: null,
    handle: null,
    vcHandle: null,
  },
];

// Full refresh interval: once every 24h. (24 * 60 * 60) / UPDATE_RATE cycles.
var FULL_REFRESH_INTERVAL = (24 * 60 * 60) / UPDATE_RATE;
var refreshCounter = 0;

/*
    Update SHEKRAN display widgets with current values.
    Sends a JSON-RPC 2.0 batch request with ui.set for each mapped widget.
    Uses partial refresh normally, full refresh once every 24h.
*/
function update_display() {
  let batch = [];
  let reqId = 1;

  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];
    if (ent.widgetId === null) continue;

    let value = ent.handle.getValue() * ent.scale;
    let valueStr = "" + value;

    batch.push({
      jsonrpc: "2.0",
      method: "ui.set",
      params: { id: ent.widgetId, text: valueStr },
      id: reqId
    });
    reqId++;
  }

  if (batch.length === 0) return;

  // Full refresh once every 24h to clear ePaper ghosting.
  if (refreshCounter >= FULL_REFRESH_INTERVAL) {
    batch.push({
      jsonrpc: "2.0",
      method: "screen.refresh",
      params: { mode: "full" },
      id: reqId
    });
    refreshCounter = 0;
  }
  refreshCounter++;

  Shelly.call("HTTP.POST", {
    url: SHEKRAN_RPC_URL,
    body: JSON.stringify(batch),
    content_type: "application/json"
  }, function(res) {
    if (res && res.code !== 200) {
      console.log("SHEKRAN HTTP failed:", JSON.stringify(res));
    }
  });
}

/*
    Run every UPDATE_RATE seconds.
*/
function update() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Refresh value from Modbus
    ent.handle.readOnce();

    // Read raw value and scale it.
    let value = ent.handle.getValue() * ent.scale;

    // Log to console (optional, but nice for debugging)
    console.log(ent.name + ": " + value + " [" + ent.units + "]");

    // Push into virtual component if mapped
    if (ent.vcHandle !== null) {
      ent.vcHandle.setValue(value);
    }
  }

  // Update SHEKRAN display
  update_display();
}

/*
    Runs once at script start time.
    Here we register all MODBUS entities and virtual components based on ENTITIES.
*/
function init() {
  for (let i = 0; i < ENTITIES.length; i++) {
    let ent = ENTITIES[i];

    // Create Modbus entity
    ent.handle = MODBUS_ENDPOINT.addEntity(ent.reg);

    // Attach virtual component handle if vcId is present
    if (ent.vcId) {
      ent.vcHandle = Virtual.getHandle(ent.vcId);
    }
  }

  Timer.set(UPDATE_RATE * 1000, true, update);
}

// Run the application.
init();
