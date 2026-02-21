# Deye SG02LP1 Solar Inverter - MODBUS-RTU Reader

> **Under Development** - These scripts are currently under development and may not be fully functional.

Scripts for reading live data from a **Deye SG02LP1 hybrid solar inverter** over MODBUS-RTU via RS485/UART using The Pill.

## Files

### [the_pill_mbsa_deye.shelly.js](the_pill_mbsa_deye.shelly.js)

**Basic reader** - Polls the inverter every 10 seconds and prints all parameter values to the Shelly script console.

### [the_pill_mbsa_deye_vc.shelly.js](the_pill_mbsa_deye_vc.shelly.js)

**Reader + Virtual Components** - Same polling logic, but also pushes each value into a Shelly Virtual Number component so values are accessible via the Shelly RPC API and the app.

---

## Hardware Requirements

- Shelly device with UART (e.g., **The Pill**)
- RS485 transceiver module (e.g., MAX485, SP485)
- Deye SG02LP1 hybrid inverter with RS485 port

### Wiring

**RS485 module to Shelly (The Pill):**

| RS485 Module | Shelly / The Pill |
|---|---|
| RO (Receiver Output) | RX (GPIO) |
| DI (Driver Input) | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**RS485 module to Deye inverter:**

| RS485 Module | Deye RS485 Port |
|---|---|
| A (D+) | A (D+) |
| B (D-) | B (D-) |
| GND | GND (optional, for noise rejection) |

**UART Settings:** 9600 baud, 8N1

> The Deye RS485 port is typically a 3-pin or RJ45 connector on the communication board. Consult your inverter manual for the exact pinout.

---

## Monitored Parameters

Both scripts read the same 9 registers from the inverter:

| Parameter | Register | Type | Scale | Units |
|---|---|---|---|---|
| Total Power | 175 | i16 | 1 | W |
| Battery Power | 190 | i16 | 1 | W |
| PV1 Power | 186 | u16 | 1 | W |
| Total Grid Power | 169 | i16 | 10 | W |
| Battery SOC | 184 | u16 | 1 | % |
| PV1 Voltage | 109 | u16 | 0.1 | V |
| Grid Voltage L1 | 150 | u16 | 0.1 | V |
| Current L1 | 164 | i16 | 0.01 | A |
| AC Frequency | 192 | u16 | 0.01 | Hz |

`i16` registers are treated as signed 16-bit integers; `u16` as unsigned. The raw register value is multiplied by `scale` to get the physical value.

---

## Virtual Component Mapping (\_vc variant only)

The `_vc` script maps each parameter to a pre-existing Shelly Virtual Number component. You must create these components on the device before running the script (via the Shelly app or RPC).

| Parameter | Virtual Component ID |
|---|---|
| Total Power | `number:200` |
| Battery Power | `number:201` |
| PV1 Power | `number:202` |
| Total Grid Power | `number:203` |
| Battery SOC | `number:204` |
| PV1 Voltage | `number:205` |
| Grid Voltage L1 | `number:206` |
| Current L1 | `number:207` |
| AC Frequency | `number:208` |

Values are updated every poll cycle. If a component handle cannot be obtained (component not created), that parameter is polled but not pushed.

---

## Configuration

Both scripts share the same `CONFIG` block at the top of the file:

```javascript
var CONFIG = {
    BAUD_RATE: 9600,         // UART baud rate (must match inverter setting)
    MODE: "8N1",             // UART framing
    SLAVE_ID: 1,             // MODBUS slave address of the inverter
    RESPONSE_TIMEOUT: 1000,  // ms to wait for a register response
    POLL_INTERVAL: 10000,    // ms between full poll cycles (10 s)
    DEBUG: true              // print TX/RX frames and value changes to console
};
```

> If you have multiple devices on the RS485 bus, change `SLAVE_ID` to match your inverter's configured address.

---

## Console Output Example

```
Deye SG02LP1 - MODBUS-RTU Reader
=================================
[DEYE] UART: 9600 baud, 8N1
[DEYE] Slave ID: 1

Polling 9 parameters every 10s...

--- Deye SG02LP1 ---
Total Power: 1450 [W]
Battery Power: -320 [W]
PV1 Power: 2100 [W]
Total Grid Power: 0 [W]
Battery SOC: 87 [%]
PV1 Voltage: 342.5 [V]
Grid Voltage L1: 231.2 [V]
Current L1: 6.28 [A]
AC Frequency: 50.01 [Hz]
```

---

## Implementation Notes

- Registers are read **one at a time** (FC 0x03, quantity = 1) with a 50 ms inter-request delay for bus stability.
- CRC-16 is computed via a pre-computed lookup table (MODBUS polynomial 0xA001).
- The MODBUS exception response (function code | 0x80) is detected and surfaced as an error string.
- A 1-second response timeout is enforced per request; timed-out parameters are logged as `ERROR (Timeout)`.
- There is no write capability - these scripts are read-only.

---

## References

- [Deye Inverter Product Page](https://www.deyeinverter.com/)
- [MODBUS RTU Protocol Specification](https://modbus.org/specs.php)
- [MODBUS over Serial Line](https://modbus.org/docs/Modbus_over_serial_line_V1_02.pdf)
- [Shelly Virtual Components](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Virtual)
