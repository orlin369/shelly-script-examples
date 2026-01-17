# Shelly Script Examples

This repository contains JavaScript scripts for Shelly smart home devices (Gen2/Gen3).

## Project Structure

```
shelly-script-examples/
├── blu_btn_events.shelly.js      # BLU Button event handler
├── blu_btn_in_range.shelly.js    # BLU Button presence watcher
├── blu_btn_onoff.shelly.js       # BLU Button toggle switch
│
└── the_pill/                     # Scripts for The Pill device
    └── ys_irtm/                  # YS-IRTM IR module scripts
        ├── ysirtm.shelly.js      # Core API library
        ├── btn2ir.shelly.js      # Button triggers send IR codes
        ├── ir2sw.shelly.js       # IR codes control switches
        ├── ir_full.shelly.js     # Bidirectional IR control
        ├── ir_learn.shelly.js    # Learn IR codes from remotes
        └── tv_ir.shelly.js       # TV remote code library
```

## Shelly BLU Button1 Scripts

| Script | Description |
|--------|-------------|
| `blu_btn_events.shelly.js` | Simple event handler for button presses (single, double, triple, long push). Template for adding custom actions. |
| `blu_btn_in_range.shelly.js` | Presence watcher - monitors BLU button proximity and turns off switch when device is out of range. Supports MAC validation via KVS, configurable timeouts, and optional HTTP URL call on turn off. |
| `blu_btn_onoff.shelly.js` | Minimal script that toggles a switch on single button press. |

## The Pill / YS-IRTM Scripts

Scripts for controlling the YS-IRTM infrared TX/RX module via UART.

| Script | Description |
|--------|-------------|
| `ysirtm.shelly.js` | Core API library for YS-IRTM module. Full UART protocol implementation for NEC IR codes. |
| `btn2ir.shelly.js` | Send IR codes when Shelly buttons/inputs are pressed (TX only). |
| `ir2sw.shelly.js` | Control Shelly switches using IR remote commands (RX only). |
| `ir_full.shelly.js` | Advanced bidirectional control with HTTP calls, scenes, and switch-to-IR forwarding. |
| `ir_learn.shelly.js` | Learn mode to capture IR codes from any NEC-compatible remote. |
| `tv_ir.shelly.js` | Pre-configured IR codes for Samsung, LG, and generic TV remotes. |

## Configuration

### BLU Button Presence Watcher

Set expected MAC address via KVS:

```javascript
Shelly.call('KVS.Set', {key: 'blu_expected_addr', value: 'AA:BB:CC:DD:EE:FF'})
```

Key configuration options in `blu_btn_in_range.shelly.js`:

```javascript
var DEV_ID = 200;           // bthomedevice ID
var SWITCH_ID = 0;          // Switch to control
var TURN_OFF_URL = "";      // Optional HTTP URL on turn off
var ABSENT_AFTER = 30;      // Warn after N seconds
var OFF_AFTER = 90;         // Turn off after N seconds
```

### YS-IRTM Module

```javascript
var CONFIG = {
    baud: 9600,       // 4800, 9600, 19200, or 57600
    address: 0xFA,    // Module address (0xFA = failsafe)
    debug: true
};
```

## Device Compatibility

- **Shelly Gen2/Gen3 devices** - All scripts
- **Shelly BLU Button1** - BLE presence and button scripts
- **YS-IRTM Module** - IR scripts (requires UART connection)

## Contributing

See [CLAUDE.md](CLAUDE.md) for coding standards, naming conventions, and git workflow.

## Resources

- [Shelly Scripting Documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/Tutorial)
- [BTHome Protocol](https://bthome.io/format/)
- [YS-IRTM Module Reference](https://github.com/mcauser/micropython-ys-irtm)

## License

See [LICENSE](LICENSE) file.
