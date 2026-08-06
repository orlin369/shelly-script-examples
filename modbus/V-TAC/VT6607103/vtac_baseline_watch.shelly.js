/**
 * @title V-TAC VT-66036103 baseline MODBUS watcher
 * @description Polls all currently known readable holding registers from the
 *   V-TAC VT-66036103 using the native Shelly ModbusController and compares
 *   them against embedded baseline values captured from local discovery.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/modbus/V-TAC/VT6607103/vtac_baseline_watch.shelly.js
 */

/**
 * V-TAC VT-66036103 Baseline MODBUS Watcher
 *
 * Requires a Shelly Pro device with the RS485 Modbus RTU Add-on.
 *
 * Latest working hypotheses from live testing:
 * - 5776 (0x1690) = pv1_voltage, scale 0.1 V
 * - 5778 (0x1692) = pv2_voltage, scale 0.1 V
 * - 5784 (0x1698) = input_voltage, scale 0.1 V
 * - 5786 (0x169A) = output_voltage, scale 0.1 V
 * - 5788 (0x169C) = igbt_temperature, scale 0.01 degC
 * - 5790 (0x169E) = power, scale 0.01 W
 * - 5792 (0x16A0) = frequency, scale 0.01 Hz
 *
 * All blocks below use FC 0x03 (Read Holding Registers). Each block is
 * "start,len,nz" where nz is an optional "offset=baseline|offset=baseline"
 * list of non-zero baseline values (omitted offsets default to baseline 0).
 */

var CONFIG = {
  BAUD_RATE: 9600,
  MODE: "8N1",
  SLAVE_ID: 1,
  POLL_INTERVAL: 15000,
  INTER_REQUEST_DELAY: 60
};

var MODBUS_ENDPOINT = ModbusController.get(CONFIG.SLAVE_ID, { baud: CONFIG.BAUD_RATE, mode: CONFIG.MODE });

var BLOCKS = [
  "5632,12,",
  "5664,1,",
  "5674,1,",
  "5684,1,",
  "5694,1,",
  "5704,1,",
  "5714,1,",
  "5724,1,",
  "5734,1,",
  "5744,1,0=4",
  "5752,1,0=6405",
  "5756,3,0=7",
  "5760,16,",
  "5777,1,",
  "5779,5,",
  "5785,1,",
  "5787,3,0=1|1=10|2=1",
  "5791,1,",
  "5793,2,0=100",
  "5796,1,",
  "5798,4,0=240|1=540|2=240",
  "5804,1,",
  "5810,1,",
  "5824,8,0=7|2=9|4=7|6=10",
  "5873,2,",
  "5936,1,",
  "5960,1,"
];

var state = {
  cycleRunning: false,
  changedMap: {},
  cycleDeviations: 0,
  cycleErrors: 0
};

function toHex16(n) {
  var s = (n & 0xFFFF).toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

function makeKey(addr) {
  return "" + addr;
}

function parseBlock(s) {
  var parts = s.split(",");
  return {
    start: JSON.parse(parts[0]),
    len: JSON.parse(parts[1]),
    nz: parts.length > 2 ? parts[2] : ""
  };
}

function baselineAt(block, offset) {
  if (block.nz === "") return 0;
  var items = block.nz.split("|");
  var i;
  for (i = 0; i < items.length; i++) {
    var kv = items[i].split("=");
    if (JSON.parse(kv[0]) === offset) return JSON.parse(kv[1]);
  }
  return 0;
}

function handleValue(addr, baseline, raw) {
  var key = makeKey(addr);
  var wasChanged = state.changedMap[key];

  if (raw !== baseline) {
    state.cycleDeviations++;
    if (wasChanged === undefined || wasChanged !== raw) {
      print("[HOLDING] CHANGED addr=" + addr + " (0x" + toHex16(addr) + ") default=" + baseline + " current=" + raw);
    }
    state.changedMap[key] = raw;
  } else if (wasChanged !== undefined) {
    print("[HOLDING] RESTORED addr=" + addr + " (0x" + toHex16(addr) + ") value=" + raw);
    delete state.changedMap[key];
  }
}

function processBlock(block, values) {
  var i;
  for (i = 0; i < values.length; i++) {
    handleValue(block.start + i, baselineAt(block, i), values[i]);
  }
}

function runCycle() {
  if (state.cycleRunning) {
    print("[V-TAC] Previous cycle still running; skipping this interval");
    return;
  }

  state.cycleRunning = true;
  state.cycleDeviations = 0;
  state.cycleErrors = 0;

  function readNext(index) {
    var block;

    if (index >= BLOCKS.length) {
      print("[V-TAC] Cycle done: blocks=" + BLOCKS.length + " deviations=" + state.cycleDeviations + " errors=" + state.cycleErrors);
      print("");
      state.cycleRunning = false;
      return;
    }

    block = parseBlock(BLOCKS[index]);
    MODBUS_ENDPOINT.readRegisters({ rtype: ModbusController.REGTYPE_HOLDING, addr: block.start, qty: block.len }, function(result, error) {
      if (result === undefined || result === null) {
        state.cycleErrors++;
        print("[HOLDING] ERROR addr=" + block.start + " qty=" + block.len + " (" + error + ")");
      } else {
        processBlock(block, result);
      }

      Timer.set(CONFIG.INTER_REQUEST_DELAY, false, function() {
        readNext(index + 1);
      });
    });
  }

  print("[V-TAC] Starting baseline comparison cycle");
  readNext(0);
}

function init() {
  print("V-TAC VT-66036103 baseline MODBUS watcher");
  print("==========================================");
  print("Baseline blocks: " + BLOCKS.length);
  print("Polling every " + CONFIG.POLL_INTERVAL / 1000 + "s");
  print("");

  Timer.set(500, false, runCycle);
  Timer.set(CONFIG.POLL_INTERVAL, true, runCycle);
}

init();
