/*
 * iATS two-channel Shelly controller.
 *
 * Supported devices:
 * - Shelly Pro 2
 * - Shelly Pro 2PM
 * - Shelly Plus 2PM
 * - Shelly 2PM Gen3 / Gen4
 *
 * Requirements:
 * - The device must support Shelly Scripts.
 * - PM devices must use the "switch" profile, not the "cover" profile.
 * - The device must expose input:0, input:1, switch:0, and switch:1.
 *
 * Logic:
 * - SW1 / input:0 = grid available
 * - SW2 / input:1 = backup available
 * - O2  / switch:1 = K1 grid contactor command
 * - O1  / switch:0 = K2 backup contactor command
 *
 * Truth table:
 *   SW2 SW1 | O2 O1 | State
 *    0   0  | 0  0  | OFF
 *    0   1  | 1  0  | GRID
 *    1   0  | 0  1  | BACKUP
 *    1   1  | 1  0  | GRID priority
 *
 * Safety behavior:
 * - The script never intentionally turns both outputs on.
 * - Before selecting a new source, it opens both outputs.
 * - It waits TRANSFER_DELAY_MS before closing the selected contactor.
 * - Physical inputs are detached from outputs and verified on startup.
 * - Initialization stops with both outputs off if detachment fails.
 * - Optional manual control is received from the Sensor Add-on helper
 *   through KVS. This script remains the only owner of switch:0/1.
 */

var INPUT_GRID = 0;       // SW1
var INPUT_BACKUP = 1;     // SW2
var OUTPUT_BACKUP = 0;    // O1 -> K2
var OUTPUT_GRID = 1;      // O2 -> K1

var POLL_MS = 1000;
var DEBOUNCE_MS = 300;
var TRANSFER_DELAY_MS = 1000;
var DETACH_INPUTS_ON_BOOT = true;
var START_IF_DETACH_VERIFICATION_FAILS = false;
var MANUAL_CONTROL_KVS_KEY = "iats.manual_control";
var MANUAL_CONTROL_MAX_STALE_POLLS = 5;

var state = {
  gridAvailable: false,
  backupAvailable: false,
  target: "OFF",
  applied: "UNKNOWN",
  transferInProgress: false,
  pendingEvaluateTimer: null,
  transferSequence: 0,
  controlMode: "AUTO",
  manualTarget: "OFF",
  manualSequence: null,
  manualStalePolls: 0
};

function log(message) {
  print("[iATS] " + message);
}

function boolFromStatus(status) {
  if (!status) return false;
  if (typeof status.state === "boolean") return status.state;
  if (typeof status.input === "boolean") return status.input;
  return false;
}

function setSwitch(id, on, done) {
  Shelly.call(
    "Switch.Set",
    { id: id, on: on },
    function (result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        log(
          "Switch.Set failed switch:" +
            id +
            " on=" +
            on +
            " error=" +
            errorCode +
            " message=" +
            errorMessage
        );
      }
      if (done) done();
    }
  );
}

function openBoth(done) {
  setSwitch(OUTPUT_GRID, false, function () {
    setSwitch(OUTPUT_BACKUP, false, done);
  });
}

function closeTarget(target) {
  if (target === "GRID") {
    setSwitch(OUTPUT_GRID, true, function () {
      state.applied = "GRID";
      state.transferInProgress = false;
      log("selected GRID: O2/K1 on, O1/K2 off");
    });
    return;
  }

  if (target === "BACKUP") {
    setSwitch(OUTPUT_BACKUP, true, function () {
      state.applied = "BACKUP";
      state.transferInProgress = false;
      log("selected BACKUP: O1/K2 on, O2/K1 off");
    });
    return;
  }

  state.applied = "OFF";
  state.transferInProgress = false;
  log("selected OFF: both outputs off");
}

function computeTarget(gridAvailable, backupAvailable) {
  if (state.controlMode === "MANUAL_STALE") return "OFF";

  if (state.controlMode === "MANUAL") {
    if (state.manualTarget === "GRID" && gridAvailable) return "GRID";
    if (state.manualTarget === "PV" && backupAvailable) return "BACKUP";
    return "OFF";
  }

  if (gridAvailable) return "GRID";
  if (backupAvailable) return "BACKUP";
  return "OFF";
}

function applyTarget(target) {
  if (state.transferInProgress) return;
  if (target === state.applied) return;

  state.transferInProgress = true;
  state.transferSequence++;
  var sequence = state.transferSequence;
  log(
    "transfer requested: " +
      state.applied +
      " -> " +
      target +
      " grid=" +
      state.gridAvailable +
      " backup=" +
      state.backupAvailable
  );

  openBoth(function () {
    if (target === "OFF") {
      closeTarget("OFF");
      return;
    }

    Timer.set(TRANSFER_DELAY_MS, false, function () {
      var currentTarget = computeTarget(
        state.gridAvailable,
        state.backupAvailable
      );

      if (sequence !== state.transferSequence || currentTarget !== target) {
        state.transferInProgress = false;
        state.applied = "OFF";
        log(
          "transfer target changed during delay: " +
            target +
            " -> " +
            currentTarget +
            "; keeping both outputs off and reevaluating"
        );
        evaluate();
        return;
      }

      closeTarget(target);
    });
  });
}

function evaluate() {
  var target = computeTarget(state.gridAvailable, state.backupAvailable);
  state.target = target;
  applyTarget(target);
}

function scheduleEvaluate() {
  if (state.pendingEvaluateTimer !== null) {
    Timer.clear(state.pendingEvaluateTimer);
  }

  state.pendingEvaluateTimer = Timer.set(DEBOUNCE_MS, false, function () {
    state.pendingEvaluateTimer = null;
    evaluate();
  });
}

function readInputs(done) {
  Shelly.call("Input.GetStatus", { id: INPUT_GRID }, function (gridStatus, gridError) {
    if (gridError !== 0) {
      log("Input.GetStatus failed for SW1/input:0");
      state.gridAvailable = false;
      state.backupAvailable = false;
      if (done) done();
      return;
    }

    Shelly.call("Input.GetStatus", { id: INPUT_BACKUP }, function (backupStatus, backupError) {
      if (backupError !== 0) {
        log("Input.GetStatus failed for SW2/input:1");
        state.gridAvailable = false;
        state.backupAvailable = false;
        if (done) done();
        return;
      }

      state.gridAvailable = boolFromStatus(gridStatus);
      state.backupAvailable = boolFromStatus(backupStatus);

      if (done) done(true);
    });
  });
}

function applyManualControlValue(value) {
  if (!value || value.mode !== "MANUAL") {
    state.controlMode = "AUTO";
    state.manualTarget = "OFF";
    state.manualSequence = null;
    state.manualStalePolls = 0;
    return;
  }

  var target = value.target === "PV" ? "PV" : "GRID";
  var sequence = value.sequence;

  if (sequence === state.manualSequence) {
    state.manualStalePolls++;
  } else {
    state.manualSequence = sequence;
    state.manualStalePolls = 0;
  }

  state.manualTarget = target;
  if (state.manualStalePolls > MANUAL_CONTROL_MAX_STALE_POLLS) {
    state.controlMode = "MANUAL_STALE";
    return;
  }

  state.controlMode = "MANUAL";
}

function readManualControl(done) {
  Shelly.call(
    "KVS.Get",
    { key: MANUAL_CONTROL_KVS_KEY },
    function (result, errorCode) {
      if (errorCode !== 0 || !result) {
        state.controlMode = "AUTO";
        state.manualTarget = "OFF";
        state.manualSequence = null;
        state.manualStalePolls = 0;
        done();
        return;
      }

      applyManualControlValue(result.value);
      done();
    }
  );
}

function pollInputs() {
  readInputs(function () {
    readManualControl(scheduleEvaluate);
  });
}

function verifyDetached(channelId, done) {
  Shelly.call(
    "Switch.GetConfig",
    { id: channelId },
    function (config, errorCode, errorMessage) {
      if (errorCode !== 0) {
        log(
          "detach verification failed switch:" +
            channelId +
            " error=" +
            errorCode +
            " message=" +
            errorMessage
        );
        done(false);
        return;
      }

      if (!config || config.in_mode !== "detached") {
        log(
          "detach verification failed switch:" +
            channelId +
            " in_mode=" +
            (config ? config.in_mode : "unavailable")
        );
        done(false);
        return;
      }

      log("verified input detached from switch:" + channelId);
      done(true);
    }
  );
}

function detachOutputInput(channelId, done) {
  Shelly.call(
    "Switch.SetConfig",
    {
      id: channelId,
      config: {
        in_mode: "detached"
      }
    },
    function (result, errorCode, errorMessage) {
      if (errorCode !== 0) {
        log(
          "detach failed switch:" +
            channelId +
            " error=" +
            errorCode +
            " message=" +
            errorMessage
        );
        done(false);
        return;
      }

      verifyDetached(channelId, done);
    }
  );
}

function detachInputs(done) {
  if (!DETACH_INPUTS_ON_BOOT) {
    log("input detachment disabled by configuration");
    done(true);
    return;
  }

  detachOutputInput(OUTPUT_BACKUP, function (backupDetached) {
    detachOutputInput(OUTPUT_GRID, function (gridDetached) {
      done(backupDetached && gridDetached);
    });
  });
}

function haltStartup(reason) {
  state.transferSequence++;
  state.transferInProgress = false;
  openBoth(function () {
    state.applied = "OFF";
    log("startup halted: " + reason);
  });
}

function start() {
  log("starting");

  Shelly.call(
    "KVS.Delete",
    { key: MANUAL_CONTROL_KVS_KEY },
    function () {
      detachInputs(function (detached) {
        if (!detached && !START_IF_DETACH_VERIFICATION_FAILS) {
          haltStartup(
            "inputs could not be detached and verified; confirm a supported " +
              "two-channel device in switch profile"
          );
          return;
        }

        if (!detached) {
          log("WARNING: continuing without verified detached inputs");
        }

        openBoth(function () {
          state.applied = "OFF";
          readInputs(function () {
            readManualControl(function () {
              evaluate();
              Timer.set(POLL_MS, true, pollInputs);
            });
          });
        });
      });
    }
  );
}

start();
