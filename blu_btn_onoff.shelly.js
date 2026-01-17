// On single_push from bthomedevice:200 -> check relay, toggle, and print
Shelly.addEventHandler(function (e) {
  if ((e.component === "bthomedevice:200" || e.id === 200) &&
      (e.event === "single_push" || (e.info && e.info.event === "single_push"))) {

    Shelly.call("Switch.GetStatus", { id: 0 }, function (res, code, msg) {
      if (code) { print("status error:", msg); return; }
      var isOn = !!(res && (res.output === true || res.on === true || res.state === true));

      if (isOn) {
        print("door close");
        Shelly.call("Switch.Set", { id: 0, on: false });
      } else {
        print("door open");
        Shelly.call("Switch.Set", { id: 0, on: true });
      }
    });
  }
});