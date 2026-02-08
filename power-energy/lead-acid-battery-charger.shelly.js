/**
 * @title Lead-Acid Charger Monitor and Auto Cutoff
 * @description Estimates lead-acid battery charge level from charging current on
 *   a dedicated Shelly Plug/PM channel and automatically turns the charger off
 *   when the battery is considered full.
 * @status under development
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/lead-acid-battery-charger.shelly.js
 */

// CONFIGURATION
let CONFIG = {
  // The switch ID to control (0 is usually the output on a Plug)
  switchId: 0,

  // Power threshold (in Watts) below which the battery is considered fully charged.
  // Check your CSV for the power draw when the battery was fully charged.
  cutoffPower: 42,

  // How long (in seconds) power must be below cutoffPower before turning off.
  // Prevents false triggers from momentary fluctuations.
  cutoffDelay: 60,

  // Safety: Maximum duration to let the charger run (in hours). 0 to disable.
  maxRunTimeHours: 12,

  // Charging Curve Mapping
  // Define points from your CSV here: { w: Power_Watts, p: Percentage }
  // MUST be sorted from High Power (low charge) to Low Power (high charge).
  // This assumes a standard charging curve where power drops as battery fills.
  chargeCurve: [
    { w: 108, p: 20 },
    { w: 90, p: 40 },
    { w: 70, p: 60 },
    { w: 55, p: 80 },
    { w: 48, p: 90 },
    { w: 42, p: 98 },
    { w: 40, p: 100 }
  ],

  // How often to check the status (in milliseconds)
  updateInterval: 10000,
  
  // Set to true to enable debug logging
  debug: true
};

let state = {
  belowThresholdSince: 0,
  startTime: 0
};

function interpolate(power) {
  let curve = CONFIG.chargeCurve;
  // If power is higher than our highest point, assume minimum charge defined
  if (power >= curve[0].w) return curve[0].p;
  // If power is lower than our lowest point, assume 100%
  if (power <= curve[curve.length - 1].w) return 100;

  // Find the two points the current power falls between
  for (let i = 0; i < curve.length - 1; i++) {
    let p1 = curve[i];
    let p2 = curve[i + 1];
    if (power <= p1.w && power > p2.w) {
      // Linear interpolation
      let rangeW = p1.w - p2.w;
      let rangeP = p2.p - p1.p;
      let offsetW = p1.w - power;
      let progress = offsetW / rangeW;
      return Math.round(p1.p + (progress * rangeP));
    }
  }
  return 0;
}

function checkPower() {
  Shelly.call("Switch.GetStatus", { id: CONFIG.switchId }, function (res, err_code) {
    if (err_code !== 0) {
      print("Error getting switch status");
      return;
    }

    if (!res.output) {
      // Charger is off, reset state
      state.belowThresholdSince = 0;
      state.startTime = 0;
      return;
    }

    // Initialize start time if this is the first check while ON
    if (state.startTime === 0) {
      state.startTime = Date.now() / 1000;
    }

    let power = res.apower;
    let pct = interpolate(power);

    if (CONFIG.debug) {
      print("Power:", power, "W | Est. Charge:", pct, "%");
    }

    // Check Cutoff Condition
    if (power < CONFIG.cutoffPower) {
      let now = Date.now() / 1000;
      if (state.belowThresholdSince === 0) {
        state.belowThresholdSince = now;
      } else {
        let duration = now - state.belowThresholdSince;
        if (duration >= CONFIG.cutoffDelay) {
          print("Battery Full (" + power + "W). Turning off.");
          Shelly.call("Switch.Set", { id: CONFIG.switchId, on: false });
        }
      }
    } else {
      // Reset timer if power spikes back up
      state.belowThresholdSince = 0;
    }
  });
}

// Start the monitoring loop
Timer.set(CONFIG.updateInterval, true, checkPower);
