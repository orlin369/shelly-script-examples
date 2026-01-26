# Shelly Script Examples

This repository contains JavaScript scripts for Shelly smart home devices (Gen2/Gen3).

## Project Structure

```
shelly-script-examples/
├── blu_btn_events.shelly.js      # BLU Button event handler
├── blu_btn_in_range.shelly.js    # BLU Button presence watcher
├── blu_btn_onoff.shelly.js       # BLU Button toggle switch
├── vc_cleanup.shelly.js          # Virtual components cleanup utility
│
└── the_pill/                     # Scripts for The Pill device (UART)
    ├── iRobotRoomba/             # iRobot Roomba control
    ├── MODBUS/                   # MODBUS-RTU master
    ├── RFID-RC522/               # MFRC522 RFID card reader
    ├── SDS011/                   # Air quality sensor (7-pin)
    ├── SDS018/                   # Air quality sensor (5-pin)
    └── ys_irtm/                  # YS-IRTM IR module
```

## Shelly BLU Button1 Scripts

| Script | Description |
|--------|-------------|
| `blu_btn_events.shelly.js` | Simple event handler for button presses (single, double, triple, long push). Template for adding custom actions. |
| `blu_btn_in_range.shelly.js` | Presence watcher - monitors BLU button proximity and turns off switch when device is out of range. Supports MAC validation via KVS, configurable timeouts, and optional HTTP URL call on turn off. |
| `blu_btn_onoff.shelly.js` | Minimal script that toggles a switch on single button press. |

## Utility Scripts

| Script | Description |
|--------|-------------|
| `vc_cleanup.shelly.js` | Removes all virtual components and groups. Use to reset and start fresh. Auto-disables after cleanup. |

## The Pill Scripts

Scripts for various UART peripherals connected to The Pill device.

### [YS-IRTM Infrared Module](the_pill/ys_irtm/README.md)

Control YS-IRTM IR TX/RX module for NEC infrared codes.

| Script | Description |
|--------|-------------|
| `ysirtm.shelly.js` | Core API library with full UART protocol implementation |
| `btn2ir.shelly.js` | Button triggers send IR codes (TX only) |
| `ir2sw.shelly.js` | IR codes control switches (RX only) |
| `ir_full.shelly.js` | Bidirectional control with HTTP calls and scenes |
| `ir_learn.shelly.js` | Learn IR codes from any NEC-compatible remote |
| `tv_ir.shelly.js` | Pre-configured codes for Samsung, LG, generic TVs |

### [iRobot Roomba Control](the_pill/iRobotRoomba/README.md)

Control iRobot Roomba 500 series via Open Interface protocol.

| Script | Description |
|--------|-------------|
| `roomba.shelly.js` | Core API library with full OI protocol implementation |
| `roomba_ctrl.shelly.js` | Button-based Roomba controller |
| `roomba_setup.shelly.js` | Virtual components setup for library |
| `roomba_ctrl_setup.shelly.js` | Virtual components setup for controller |

### [MFRC522 RFID Reader](the_pill/RFID-RC522/README.md)

Read RFID cards using MFRC522-UART module.

| Script | Description |
|--------|-------------|
| `mfrc522.shelly.js` | Core API library with block read/write support |
| `mfrc522_read.shelly.js` | Basic card detection example |

### [MODBUS-RTU Master](the_pill/MODBUS/README.md)

Communicate with MODBUS slave devices (sensors, PLCs, energy meters) via RS485.

| Script | Description |
|--------|-------------|
| `modbus_rtu.shelly.js` | Core MODBUS-RTU library with 6 function codes (FC 0x01-0x06) |
| `mb308v.shelly.js` | CWT-MB308V GPIO expander example (8AI+4AO+8DI+12DO) |

### [SDS011 Air Quality Sensor](the_pill/SDS011/README.md)

Read PM2.5/PM10 particulate matter from Nova Fitness SDS011 (7-pin connector).

| Script | Description |
|--------|-------------|
| `sds011.shelly.js` | Core API library with console output |
| `sds011_setup.shelly.js` | Virtual components setup (run once) |
| `sds011_vc.shelly.js` | Virtual components UI with graphical display |

### [SDS018 Air Quality Sensor](the_pill/SDS018/README.md)

Read PM2.5/PM10 particulate matter from Nova Fitness SDS018 (5-pin connector).

| Script | Description |
|--------|-------------|
| `sds018.shelly.js` | Core API library with sleep/wake and AQI calculation |

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

### Roomba / MFRC522 / Air Quality

See individual README files for detailed configuration options:
- [iRobotRoomba/README.md](the_pill/iRobotRoomba/README.md)
- [RFID-RC522/README.md](the_pill/RFID-RC522/README.md)
- [SDS011/README.md](the_pill/SDS011/README.md)
- [SDS018/README.md](the_pill/SDS018/README.md)

## Device Compatibility

- **Shelly Gen2/Gen3 devices** - All scripts
- **Shelly BLU Button1** - BLE presence and button scripts
- **The Pill (UART)** - IR, Roomba, RFID, Air Quality scripts

## Contributing

See [CLAUDE.md](CLAUDE.md) for coding standards, naming conventions, and git workflow.

## Resources

- [Shelly Scripting Documentation](https://shelly-api-docs.shelly.cloud/gen2/Scripts/Tutorial)
- [BTHome Protocol](https://bthome.io/format/)
- [YS-IRTM Module Reference](https://github.com/mcauser/micropython-ys-irtm)
- [Roomba Open Interface](https://github.com/orlin369/Roomba)
- [MFRC522-UART-Arduino](https://github.com/zodier/MFRC522-UART-Arduino)
- [MODBUS Protocol Specification](https://modbus.org/specs.php)
- [SDS018 Protocol (PyPMS)](https://github.com/avaldebe/PyPMS)

## License

See [LICENSE](LICENSE) file.
