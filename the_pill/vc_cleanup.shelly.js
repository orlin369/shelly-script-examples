// Virtual components cleanup for The Pill by Shelly.
// This script removes ALL virtual components and groups created.
// Use this to reset and start fresh

function cleanupAllComponents() {
  print("Scanning for existing virtual components and groups...");
  
  Shelly.call("Shelly.GetComponents", { dynamic_only: true }, function(res) {
    if (!res || !res.components) {
      print("Failed to fetch components list.");
      Timer.set(1000, false, stopScript);
      return;
    }

    let components = res.components;
    let idsToDelete = [];

    print("Found " + components.length + " dynamic components:");
    
    // Collect all dynamic component and group IDs
    for (let i = 0; i < components.length; i++) {
      let key = components[i].key;
      print("  - " + key);
      idsToDelete.push(key);
    }

    if (idsToDelete.length === 0) {
      print("No virtual components or groups found.");
      Timer.set(500, false, stopScript);
      return;
    }

    print("Starting deletion of " + idsToDelete.length + " items...");

    let deleteIndex = 0;

    function deleteNext() {
      if (deleteIndex >= idsToDelete.length) {
        print("=== All components and groups deleted! ===");
        Timer.set(1000, false, stopScript);
        return;
      }

      let key = idsToDelete[deleteIndex++];
      let componentType = key.split(":")[0];
      print("Deleting [" + componentType + "]: " + key);
      
      // Delete component or group appropriately
      if (componentType === "group") {
        // key format: group:<id> -> extract numeric id
        let idPart = key.split(":")[1];
        let gid = parseInt(idPart, 10);
        if (isNaN(gid)) {
          print("  Invalid group id:", idPart, "- attempting Virtual.Delete fallback");
          // Try Virtual.Delete with the key as a fallback
          Shelly.call("Virtual.Delete", { key: key }, function(vres, verr, verrMsg) {
            if (verr !== 0) {
              print("  Virtual.Delete fallback failed:", verrMsg);
            } else {
              print("  ✓ Virtual.Delete fallback succeeded");
            }
          });
          Timer.set(200, false, deleteNext);
        } else {
          // Try Group.Delete first
          Shelly.call("Group.Delete", { id: gid }, function(res, err, errMsg) {
            if (err !== 0) {
              print("  Group.Delete failed:", errMsg, "- trying Virtual.Delete fallback");
              // Fallback to Virtual.Delete with the key
              Shelly.call("Virtual.Delete", { key: key }, function(vres, verr, verrMsg) {
                if (verr !== 0) {
                  print("  Virtual.Delete also failed:", verrMsg);
                } else {
                  print("  ✓ Group removed via Virtual.Delete fallback");
                }
                Timer.set(200, false, deleteNext);
              });
            } else {
              print("  ✓ Group deleted successfully");
              Timer.set(200, false, deleteNext);
            }
          });
        }
      } else {
        // Virtual components (number:, button:, etc.) use Virtual.Delete with key
        Shelly.call("Virtual.Delete", { key: key }, function(res, err, errMsg) {
          if (err !== 0) {
            print("  Error deleting", key, ":", errMsg);
          } else {
            print("  ✓ Deleted successfully");
          }
          Timer.set(200, false, deleteNext);
        });
      }
    }

    deleteNext();
  });
}

function stopScript() {
  print("Disabling cleanup script...");
  Shelly.call(
    "Script.SetConfig",
    { id: Shelly.getCurrentScriptId(), config: { enable: false } },
    function(result, error_code, error_msg) {
      if (error_code === 0) {
        print("✓ Cleanup script disabled successfully.");
        die(); // Stop the script
      } else {
        print("Script.SetConfig failed:", error_msg, "- attempting Script.Stop");
        Shelly.call("Script.Stop", { id: Shelly.getCurrentScriptId() }, function(r2, e2, m2) {
          if (e2 === 0) print("✓ Cleanup script stopped via Script.Stop.");
          else print("Could not stop script:", m2);
        });
      }
    }
  );
}

// Run cleanup on startup
cleanupAllComponents();
