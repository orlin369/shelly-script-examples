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
    └── ys_irtm/                  # YS-IRTM IR module scripts
        ├── ysirtm.shelly.js      # Core YS-IRTM API library
        ├── btn2ir.shelly.js      # Button triggers -> IR commands
        ├── ir2sw.shelly.js       # IR commands -> Switch control
        ├── ir_full.shelly.js     # Full bidirectional IR control
        ├── ir_learn.shelly.js    # IR code learning mode
        └── tv_ir.shelly.js       # TV remote code library
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
- **The Pill** - Shelly device with UART for YS-IRTM connection

## Git Workflow

### Branching Strategy
- **main**: Production-ready code, only receives merges from dev
- **dev**: Development branch, created from main, where integration happens
- **feature branches**: Created from dev for each new feature or change

### Branch Naming
- Feature branches: `feature/<short-description>` (e.g., `feature/add-dimmer-support`)
- Bug fixes: `fix/<short-description>` (e.g., `fix/mac-validation`)

### Workflow
1. Create feature branch from dev: `git checkout -b feature/my-feature dev`
2. Make changes and commit (one file per commit)
3. Push feature branch and create PR to dev
4. After review, merge to dev
5. Periodically merge dev to main for releases

### Commit Rules
- **One file per commit**: Every change to a file should be a separate commit
- **Descriptive messages**: Commit message should describe what was changed and why
- **Atomic commits**: Each commit should represent a single logical change

## Resources

- [Shelly Scripting Documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/Tutorial)
- [BTHome Protocol](https://bthome.io/format/)
- [YS-IRTM Module](https://github.com/mcauser/micropython-ys-irtm)
