# ComWinTop CWT-MB308V GPIO Expander

> **Under Development** - This script is currently under development and may not be fully functional.

Script for communicating with the **ComWinTop CWT-MB308V** IO module via MODBUS-RTU over RS485/UART using The Pill.

## Files

### [mb308v.shelly.js](mb308v.shelly.js)

**CWT-MB308V GPIO Expander Example** - Complete example for the ComWinTop MB308V IO module.

---

## Hardware Requirements

- Shelly device with UART (e.g., **The Pill**)
- RS485 transceiver module (e.g., MAX485, SP485)
- ComWinTop CWT-MB308V IO module (7-35VDC supply)

### Device Specifications

| Feature | Detail |
|---|---|
| Analog Inputs (AI) | 8 channels — 4-20mA / 0-5V / 0-10V (configurable per channel) |
| Analog Outputs (AO) | 4 channels — 0-10V / 4-20mA |
| Digital Inputs (DI) | 8 channels — dry contact / NPN |
| Digital Outputs (DO) | 12 relay outputs |

### Wiring

**RS485 module to Shelly (The Pill):**

| RS485 Module | Shelly / The Pill |
|---|---|
| RO (Receiver Output) | RX (GPIO) |
| DI (Driver Input) | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**RS485 module to CWT-MB308V:**

| RS485 Module | CWT-MB308V |
|---|---|
| A (D+) | A (D+) |
| B (D-) | B (D-) |

**Power:** Connect 7-35VDC to the MB308V power terminals separately.

**UART Settings:** 9600 baud, 8N1, Slave ID: 1 (default)

---

## Register Map

| Type | Function Code | Address Range | Count |
|---|---|---|---|
| Digital Outputs (DO) | FC 0x01 (read) / FC 0x05 (write) | 0–11 | 12 coils |
| Digital Inputs (DI) | FC 0x02 (read) | 0–7 | 8 inputs |
| Analog Outputs (AO) | FC 0x03 (read) / FC 0x06 (write) | 0–3 | 4 registers |
| Analog Inputs (AI) | FC 0x04 (read) | 0–7 | 8 registers |

---

## API Methods

```javascript
readDigitalInputs(callback)              // Read 8 DI
readDigitalOutputs(callback)             // Read 12 DO (relays)
writeDigitalOutput(channel, value, cb)   // Set relay (0-11, true/false)
readAnalogInputs(callback)               // Read 8 AI
readAnalogOutputs(callback)              // Read 4 AO
writeAnalogOutput(channel, value, cb)    // Set AO (0-3, 0-24000)

// Conversion helpers
aiToMilliamps(raw)    // Convert AI to mA (4-20mA mode)
aiToVoltage(raw)      // Convert AI to V (0-10V mode)
milliampsToAo(mA)     // Convert mA to AO value
voltageToAo(volts)    // Convert V to AO value
```

---

## Usage Examples

**Read all digital inputs:**

```javascript
readDigitalInputs(function(err, inputs) {
    if (err) {
        print("Error: " + err);
        return;
    }
    for (var i = 0; i < inputs.length; i++) {
        print("DI" + i + ": " + (inputs[i] ? "ON" : "OFF"));
    }
});
```

**Control relay output:**

```javascript
// Turn ON relay 0
writeDigitalOutput(0, true, function(err, success) {
    if (success) print("Relay 0 ON");
});

// Turn OFF relay 5
writeDigitalOutput(5, false, function(err, success) {
    if (success) print("Relay 5 OFF");
});
```

**Read analog inputs (4-20mA sensors):**

```javascript
readAnalogInputs(function(err, values) {
    if (err) return;
    for (var i = 0; i < values.length; i++) {
        var mA = aiToMilliamps(values[i]);
        print("AI" + i + ": " + mA.toFixed(2) + " mA");
    }
});
```

**Set analog output (0-10V mode):**

```javascript
// Set AO0 to 5V
var rawValue = voltageToAo(5.0);
writeAnalogOutput(0, rawValue, function(err, success) {
    if (success) print("AO0 set to 5V");
});
```

---

## Configuration

```javascript
var CONFIG = {
    BAUD_RATE: 9600,        // 9600, 19200, 38400, 115200
    MODE: "8N1",            // "8N1", "8E1", "8O1"
    RESPONSE_TIMEOUT: 1000, // ms
    DEBUG: true
};
```

---

## References

- [ComWinTop CWT-MB308V Product Page](https://store.comwintop.com/products/cwt-mb308v-8ai-4ao-8di-12do-rs485-rs232-ethernet-modbus-rtu-tcp-io-acquisition-module)
- [MB308V Python Driver (reference)](https://github.com/bgerp/ztm/blob/master/Zontromat/devices/vendors/cwt/mb308v/mb308v.py)
- [MODBUS Protocol Specification](https://modbus.org/specs.php)
