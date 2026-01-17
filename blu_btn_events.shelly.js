/**
 * BLU Button Event Handler
 * Handles button press events from Shelly BLU Button1
 * Events: single_push, double_push, triple_push, long_push
 */

/* === CONFIG === */
var DEV_ID = 200;  // bthomedevice:<id>

/* === STATE === */
var DEVKEY = "bthomedevice:" + DEV_ID;

/* === BLU BUTTON EVENT HANDLER === */
function onBluButtonEvent(ev) {
  if (!ev || ev.component !== DEVKEY) return;
  if (!ev.info || !ev.info.event) return;

  var eventType = ev.info.event;
  print("BLU Button Event: " + eventType);

  if (eventType === "single_push") {
    // Handle single push
  } else if (eventType === "double_push") {
    // Handle double push
  } else if (eventType === "triple_push") {
    // Handle triple push
  } else if (eventType === "long_push") {
    // Handle long push
  }
}

/* === INITIALIZATION === */
function init() {
  Shelly.addEventHandler(onBluButtonEvent);
  print("BLU Button Event Handler started for " + DEVKEY);
}

init();
