/**
 * @title Victron Energy virtual Number components provisioning
 * @description One-shot script that creates and configures nine virtual Number components
 *   (IDs 220–228) for live Victron telemetry and groups them under "Victron Energy" (group 219).
 *   Each component is configured with a progressbar UI hint. Safe to re-run — Virtual.Add
 *   skips components that already exist. Calls die() on completion to free memory.
 * @status production
 * @link https://github.com/ALLTERCO/shelly-script-examples/blob/main/power-energy/victron-virtual-components-setup.shelly.js
 */

var components = [
  { id: 220, name: "Battery SOC",      unit: "%",  min: 0,       max: 100,    step: 0.01 },
  { id: 221, name: "Battery Power",    unit: "W",  min: -100000, max: 100000, step: 1    },
  { id: 222, name: "Total Grid Power", unit: "W",  min: -100000, max: 100000, step: 1    },
  { id: 223, name: "Grid Voltage L1",  unit: "V",  min: 0,       max: 1000,   step: 0.1  },
  { id: 224, name: "Current L1",       unit: "A",  min: -10000,  max: 10000,  step: 0.01 },
  { id: 225, name: "AC Frequency",     unit: "Hz", min: 0,       max: 100,    step: 0.01 },
  { id: 226, name: "PV1 Power",        unit: "W",  min: 0,       max: 100000, step: 1    },
  { id: 227, name: "PV1 Voltage",      unit: "V",  min: 0,       max: 1000,   step: 0.1  },
  { id: 228, name: "Total Power",      unit: "W",  min: 0,       max: 100000, step: 1    }
];

var GROUP_ID = 219;
var GROUP_NAME = "Victron Energy";
var index = 0;

function configureComponent(c) {
  Shelly.call("Number.SetConfig", {
    id: c.id,
    config: {
      name: c.name,
      min: c.min,
      max: c.max,
      step: c.step,
      unit: c.unit,
      meta: { ui: { view: "progressbar", unit: c.unit, step: c.step } }
    }
  }, function(res, err) {
    if (err !== 0) {
      print("SetConfig error on ID " + c.id + ": " + JSON.stringify(res));
    } else {
      print("Configured: " + c.name + " (ID " + c.id + ")");
    }
    processNext();
  });
}

function processNext() {
  if (index >= components.length) {
    createGroup();
    return;
  }
  var c = components[index];
  index++;
  Shelly.call("Virtual.Add", { type: "number", id: c.id }, function(res, err) {
    if (err !== 0) {
      print("Virtual.Add skipped for ID " + c.id + " (already exists): " + JSON.stringify(res));
    } else {
      print("Created number component ID " + c.id);
    }
    configureComponent(c);
  });
}

function createGroup() {
  Shelly.call("Virtual.Add", { type: "group", id: GROUP_ID }, function(res, err) {
    if (err !== 0) {
      print("Group Virtual.Add skipped (already exists)");
    } else {
      print("Created group ID " + GROUP_ID);
    }
    configGroupName();
  });
}

function configGroupName() {
  Shelly.call("Group.SetConfig", {
    id: GROUP_ID,
    config: { name: GROUP_NAME }
  }, function(res, err) {
    if (err !== 0) {
      print("Group.SetConfig error: " + JSON.stringify(res));
    } else {
      print("Group configured: " + GROUP_NAME);
    }
    assignGroupMembers();
  });
}

function assignGroupMembers() {
  var members = [];
  for (var i = 0; i < components.length; i++) {
    members.push("number:" + components[i].id);
  }
  Shelly.call("Group.Set", {
    id: GROUP_ID,
    value: members
  }, function(res, err) {
    if (err !== 0) {
      print("Group.Set error: " + JSON.stringify(res));
    } else {
      print("Done! All components assigned to group '" + GROUP_NAME + "'.");
    }
    die();
  });
}

processNext();
