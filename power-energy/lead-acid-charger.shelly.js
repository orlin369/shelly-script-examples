/**
 * @title Lead-Acid Charger Monitor and Auto Cutoff
 * @description Estimates lead-acid battery charge level from charger power on
 *   a dedicated Shelly switch channel and turns the charger off when the
 *   battery is considered full.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/lead-acid-charger.shelly.js
 */

/**
 * Lead-acid charger automation for old constant-voltage chargers.
 *
 * Use case:
 * - Charger is dedicated to one battery charger load.
 * - Shelly monitors charger power through the switched output.
 * - For TEC-23 (13.4V / 1A), sustained low tail power is used as the
 *   practical stop condition.
 *
 * Tuned defaults:
 * - Charger type: TEC-23
 *
 * Firmware requirements:
 * - Shelly Gen2/Gen3 with scripting support.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

let CONFIG = {
  // Switch component ID (0 for most Plug/PM devices)
  switchId: 0,

  // Below this power (W), charging is considered in tail/full phase
  // Tuned from: tes_23_consumption_08_02_2026_00h__09_02_2026_00h.csv
  cutoffPower: 42,

  // Power must stay below cutoffPower for this many seconds before cutoff
  cutoffDelaySec: 180,

  // Safety timeout in hours (0 disables the limit)
  maxRunTimeHours: 12,

  // Estimated charge curve points: higher power => lower state of charge.
  // Keep sorted by descending power.
  chargeCurve: [
    { w: 108, p: 20 },
    { w: 90, p: 35 },
    { w: 65, p: 55 },
    { w: 57, p: 70 },
    { w: 53, p: 80 },
    { w: 49, p: 88 },
    { w: 46, p: 93 },
    { w: 43, p: 97 },
    { w: 41.5, p: 100 },
  ],

  // Poll interval in milliseconds
  updateIntervalMs: 10000,

  // Enable verbose logging
  debug: true,
};

// ============================================================================
// STATE
// ============================================================================

let state = {
  belowThresholdSince: 0,
  chargingStartTs: 0,
};

// ============================================================================
// HELPERS
// ============================================================================

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function logDebug() {
  if (!CONFIG.debug) return;
  print.apply(null, arguments);
}

function estimateChargePercent(powerW) {
  let curve = CONFIG.chargeCurve;

  if (powerW >= curve[0].w) return curve[0].p;
  if (powerW <= curve[curve.length - 1].w) return 100;

  let i;
  for (i = 0; i < curve.length - 1; i++) {
    let p1 = curve[i];
    let p2 = curve[i + 1];

    if (powerW <= p1.w && powerW > p2.w) {
      let rangeW = p1.w - p2.w;
      let rangeP = p2.p - p1.p;
      let offsetW = p1.w - powerW;
      let t = offsetW / rangeW;
      return Math.round(p1.p + t * rangeP);
    }
  }

  return 0;
}

function stopCharger(reason) {
  print('Stopping charger: ' + reason);
  Shelly.call('Switch.Set', { id: CONFIG.switchId, on: false }, function (_, errCode, errMsg) {
    if (errCode !== 0) {
      print('Error stopping charger [' + errCode + ']: ' + errMsg);
    }
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

function checkCharger() {
  Shelly.call('Switch.GetStatus', { id: CONFIG.switchId }, function (res, errCode, errMsg) {
    if (errCode !== 0 || !res) {
      print('Error getting switch status [' + errCode + ']: ' + errMsg);
      return;
    }

    if (!res.output) {
      state.belowThresholdSince = 0;
      state.chargingStartTs = 0;
      return;
    }

    let now = nowSec();
    if (state.chargingStartTs === 0) {
      state.chargingStartTs = now;
    }

    if (CONFIG.maxRunTimeHours > 0) {
      let maxRuntimeSec = CONFIG.maxRunTimeHours * 3600;
      if (now - state.chargingStartTs >= maxRuntimeSec) {
        stopCharger('max runtime reached');
        return;
      }
    }

    let powerW = res.apower || 0;
    let soc = estimateChargePercent(powerW);
    logDebug('Power:', powerW, 'W | Estimated charge:', soc, '%');

    if (powerW < CONFIG.cutoffPower) {
      if (state.belowThresholdSince === 0) {
        state.belowThresholdSince = now;
      } else if (now - state.belowThresholdSince >= CONFIG.cutoffDelaySec) {
        stopCharger('tail power below threshold for ' + CONFIG.cutoffDelaySec + 's');
      }
    } else {
      state.belowThresholdSince = 0;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

Timer.set(CONFIG.updateIntervalMs, true, checkCharger);
print('Lead-acid charger monitor started on switch:' + CONFIG.switchId);
