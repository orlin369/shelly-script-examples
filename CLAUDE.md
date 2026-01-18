# Shelly Scripts Project

## Overview

This project contains JavaScript scripts for Shelly smart home devices. Scripts are designed to run on Shelly Gen2/Gen3 devices using their embedded scripting engine (Espruino-compatible JavaScript).

## Project Structure

```
shelly-script-examples/
├── blu_btn_events.shelly.js      # BLU Button event handler (single/double/triple/long push)
├── blu_btn_in_range.shelly.js    # BLU Button presence watcher (turn off when out of range)
├── blu_btn_onoff.shelly.js       # BLU Button toggle switch on single push
│
└── the_pill/                     # Scripts for The Pill device
    ├── vc_cleanup.shelly.js      # Virtual components cleanup utility
    │
    ├── ys_irtm/                  # YS-IRTM IR module scripts
    │   ├── ysirtm.shelly.js      # Core YS-IRTM API library
    │   ├── btn2ir.shelly.js      # Button triggers -> IR commands
    │   ├── ir2sw.shelly.js       # IR commands -> Switch control
    │   ├── ir_full.shelly.js     # Full bidirectional IR control
    │   ├── ir_learn.shelly.js    # IR code learning mode
    │   └── tv_ir.shelly.js       # TV remote code library
    │
    └── iRobotRoomba/             # iRobot Roomba control scripts
        ├── roomba.shelly.js           # Core Roomba OI protocol library
        ├── roomba_setup.shelly.js     # Virtual components setup for library
        ├── roomba_ctrl.shelly.js      # Button-based Roomba controller
        └── roomba_ctrl_setup.shelly.js # Virtual components setup for controller
```

## Script Categories

### BLE (Bluetooth Low Energy)
- **BTHome Protocol**: Scripts parse BTHome v2 service data from Shelly BLU devices
- **Presence Detection**: Monitor BLU button proximity, trigger actions when out of range
- **Event Handling**: React to button presses (single, double, triple, long push)
- **KVS Configuration**: MAC address stored in Key-Value Store for validation

### Infrared (YS-IRTM Module)
- **UART Communication**: 9600 baud, 8N1 protocol
- **NEC IR Codes**: 3-byte format [userHi, userLo, cmd]
- **Bidirectional**: Send IR commands and receive/decode incoming IR
- **TV Code Libraries**: Pre-configured codes for Samsung, LG, Generic remotes

### iRobot Roomba (500 Series)
- **UART Communication**: 115200 baud, 8N1 protocol
- **Open Interface (OI)**: Full protocol implementation for Roomba control
- **Cleaning Modes**: Clean, Spot, Dock, and manual drive control
- **Sensor Reading**: Battery, bumps, cliffs, and wheel drops
- **Virtual Components**: Status display and button-based control

## Shelly API Reference

### Core APIs Used
- `Shelly.call(method, params, callback)` - RPC calls
- `Shelly.addEventHandler(callback)` - Subscribe to events
- `Shelly.addStatusHandler(callback)` - Subscribe to status changes
- `Shelly.getComponentConfig(type, id)` - Get component configuration
- `Shelly.getComponentStatus(type, id)` - Get component status

### Components
- `Switch` - Relay control (Switch.Set, Switch.Toggle, Switch.GetStatus)
- `Light` - Dimmer control
- `BLE.Scanner` - Bluetooth scanning
- `UART` - Serial communication
- `Timer` - Timers (Timer.set)
- `Virtual` - Virtual components (buttons, numbers, text)
- `KVS` - Key-Value Store (KVS.Get, KVS.Set)
- `bthomedevice` / `bthomesensor` - BTHome device/sensor data

## File Naming Convention

All script files use the `.shelly.js` extension to indicate they are Shelly device scripts.

---

## Coding Standards

### Single File Application
- **Each script is standalone**: Every `.shelly.js` file is a complete, self-contained application
- **No imports or includes**: Shelly scripts do not support importing code from other files
- **No shared dependencies**: Each script must contain all the code it needs to run independently

### Naming Conventions

#### Variables
- Use `camelCase` for variables (e.g., `lastTime`, `switchStatus`)
- Use `UPPER_SNAKE_CASE` for constants (e.g., `DEV_ID`, `SWITCH_ID`)

#### Functions
- Use `camelCase` for function names (e.g., `turnOff`, `normMac`)
- Prefix event handlers with `on` (e.g., `onDevStatus`, `onBluButtonEvent`)
- Prefix boolean-returning functions with `is` or `has` (e.g., `isValidMac`, `addrAllowed`)
- Use verb-noun pattern for actions (e.g., `extractAddr`, `sendNamed`)

#### Classes / Object Namespaces
- Use `UPPER_CASE` for class-like objects (e.g., `YSIRTM`, `CODES`, `CONFIG`)
- Methods inside use `camelCase` (e.g., `YSIRTM.sendCode()`)
- Private methods prefix with underscore (e.g., `YSIRTM._onReceive()`)

#### Component Keys
- Use `"type:id"` format (e.g., `"bthomedevice:200"`, `"switch:0"`)

### Code Structure
```javascript
/* === CONFIG === */
var CONFIG_VAR = value;

/* === STATE === */
var stateVar = initialValue;

/* === HELPERS === */
function helperFunction() { }

/* === MAIN LOGIC === */
function mainFunction() { }

/* === EVENT HANDLERS === */
function onEvent(ev) { }

/* === INITIALIZATION === */
function init() { }

init();
```

### Comments and Documentation
- File header with description and purpose
- Section headers using `/* === SECTION === */`
- JSDoc-style comments for complex functions

### Error Handling
- Check for null/undefined before accessing properties
- Use callbacks with error parameters: `function(result, error_code, error_message)`
- Print meaningful error messages with context

### Configuration
- User-configurable values at top of file
- KVS for persistent storage (e.g., MAC addresses)
- Validate configuration values before use

---

## Common Patterns

### Script Initialization
```javascript
function init() {
    // Setup code here
}

init();
```

### Configuration Block
```javascript
var CONFIG = {
    // User-configurable options at top of file
};
```

### Event Handler Pattern
```javascript
Shelly.addEventHandler(function(ev) {
    if (ev.component === "bthomedevice:200") {
        if (ev.info && ev.info.event === "single_push") {
            // Handle event
        }
    }
});
```

### Timer Pattern
```javascript
Timer.set(intervalMs, repeat, function() {
    // Timer callback
});
```

### KVS Read Pattern
```javascript
Shelly.call("KVS.Get", { key: "my_key" }, function(result, error_code, error_message) {
    if (error_code !== 0 || !result || result.value === undefined) {
        print("Key not found");
        return;
    }
    var value = result.value;
    // Use value
});
```

### UART Communication
```javascript
var uart = UART.get();
uart.configure({ baud: 9600, mode: '8N1' });
uart.recv(function(data) { /* handle received data */ });
uart.write(data);
```

### Shelly RPC Call
```javascript
Shelly.call("Switch.Set", { id: 0, on: true }, function(result, error_code, error_message) {
    if (error_code) {
        print("Error:", error_message);
    }
});
```

### Component Existence Check
```javascript
var status = Shelly.getComponentStatus("switch", 0);
if (status === null) {
    print("Switch not available on this device");
} else {
    // Component exists, proceed
}
```

## Device Compatibility

- Shelly Gen2 devices (Plus, Pro series)
- Shelly Gen3 devices
- Devices with BLE support for BLU scripts
- Devices with UART for IR/serial scripts

## External Hardware

- **Shelly BLU Button1** - Bluetooth button for presence/event detection
- **YS-IRTM Module** - IR transmitter/receiver module (UART interface)
- **The Pill** - Shelly device with UART for serial peripherals
- **iRobot Roomba 500 Series** - Robot vacuum (mini-DIN serial interface)

## Git Workflow

### Branching Strategy
- **main**: Production-ready code, only receives merges from dev
- **dev**: Development branch, created from main, where integration happens
- **feature branches**: Created from dev for each new feature or change

### Branch Naming
- Feature branches: `feature/<short-description>` (e.g., `feature/add-dimmer-support`)
- Bug fixes: `fix/<short-description>` (e.g., `fix/mac-validation`)

### Commit Workflow (Step by Step)

1. **Checkout dev branch:**
   ```bash
   git checkout dev
   ```

2. **Create feature branch from dev:**
   ```bash
   git checkout -b feature/<short-description>
   ```

3. **Stage and commit changes with descriptive message:**
   ```bash
   git add <file>
   git commit -m "$(cat <<'EOF'
   Short summary of changes

   - Detailed bullet point 1
   - Detailed bullet point 2
   - Detailed bullet point 3

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

4. **Test the feature before merging:**
   - For software-only changes: Run build and verify functionality
   - For hardware-dependent changes: **ASK the user to test manually**
   - Never merge untested code into dev

5. **ASK before merging to dev:**
   - Always ask the user for approval before merging feature into dev
   - Example: "Feature is ready and committed. May I merge to dev and main?"

6. **Merge feature branch to dev (with --no-ff to preserve branch history):**
   ```bash
   git checkout dev
   git merge feature/<short-description> --no-ff -m "Merge feature/<short-description> into dev"
   ```

7. **Merge dev to main (with --no-ff to preserve branch history):**
   ```bash
   git checkout main
   git merge dev --no-ff -m "Merge dev into main"
   ```

8. **Push both branches and clean up:**
   ```bash
   git push origin main
   git push origin dev
   git branch -d feature/<short-description>
   ```

### Important: Always Use --no-ff

Always use `--no-ff` (no fast-forward) when merging to create merge commits. This preserves the branch topology and makes the history visible in GitLens:

```
*   Merge dev into main
|\
| *   Merge feature/xyz into dev
| |\
| | * Actual commit message
| |/
```

### Commit Message Format

```
Short summary (imperative mood, max 50 chars)

- Bullet point describing change 1
- Bullet point describing change 2
- Bullet point describing change 3

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Resources

### Shelly
- [Shelly Scripting Documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/Tutorial)
- [Shelly API Reference](https://shelly-api-docs.shelly.cloud/gen2/)
- [Shelly Virtual Components](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Virtual)

### Bluetooth
- [BTHome Protocol](https://bthome.io/format/)

### Infrared
- [YS-IRTM Module](https://github.com/mcauser/micropython-ys-irtm)

### iRobot Roomba
- [Roomba Arduino Library](https://github.com/orlin369/Roomba)
- [iRobot Create Open Interface Spec](https://www.irobot.com/about-irobot/stem/create-2)
