# JK200 BMS - MODBUS-RTU Reader

> **Under Development** - This script is currently under development and may not be fully functional.

Script for reading live data from a **Jikong JK-PB series BMS** (commonly called JK200 for the 200A variants) over MODBUS-RTU via RS485/UART using The Pill.

Compatible models: JK-PB2A8S20P, JK-PB2A16S20P, JK-PB2A20S20P (and other PB-series variants).

## Files

### [the_pill_mbsa_jk200.shelly.js](the_pill_mbsa_jk200.shelly.js)

Reads two register blocks per poll cycle and prints a full status report to the Shelly script console:

- All individual cell voltages with min/max/delta
- Pack voltage, current, power
- State of Charge (SOC)
- MOSFET temperature, battery temperature sensors 1 & 2
- Balance current
- Active alarm flags

---

## Enable MODBUS on the BMS

By default the JK BMS communicates over its own proprietary protocol. To activate RS485 MODBUS slave mode:

1. Open the **JiKong BMS** app and connect via Bluetooth.
2. Go to **Settings → Device Address**.
3. Set the address to any value from **1 to 15** (0 = disabled).
4. The chosen address becomes the MODBUS slave ID.

Default communication: **9600 baud, 8N1**.

---

## Hardware Requirements

- Shelly device with UART (e.g., **The Pill**)
- RS485 transceiver module (e.g., MAX485, SP485)
- Jikong JK-PB series BMS with RS485 connector

### Wiring

**RS485 module to Shelly (The Pill):**

| RS485 Module | Shelly / The Pill |
|---|---|
| RO (Receiver Output) | RX (GPIO) |
| DI (Driver Input) | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**RS485 module to JK BMS:**

| RS485 Module | JK BMS RS485 Port |
|---|---|
| A (D+) | A (D+) |
| B (D-) | B (D-) |

> The JK BMS RS485 port is a 4-pin JST-style connector. Typical pinout: GND, A, B, +5V. Consult your BMS manual for the exact connector layout — not all units are identical.

---

## Register Map

The JK BMS uses **stride-2 MODBUS addressing** (JK BMS RS485 Modbus V1.0 spec):

| Value width | MODBUS registers used | Layout |
|---|---|---|
| U_WORD / S_WORD (16-bit) | 2 | `[data, padding]` |
| U_DWORD / S_DWORD (32-bit) | 4 | `[hi, lo, padding, padding]` |

### Block A — Cell Voltages (`FC 0x03`, start `0x1200`)

| Address | Parameter | Type | Unit |
|---|---|---|---|
| 0x1200 | Cell 1 voltage | U_WORD | mV |
| 0x1202 | Cell 2 voltage | U_WORD | mV |
| … | … | … | … |
| 0x1200 + (N-1)×2 | Cell N voltage | U_WORD | mV |

Read quantity = `CELL_COUNT × 2` registers. Cell N voltage = `registers[(N-1) × 2]`.

### Block B — Key Parameters (`FC 0x03`, start `0x128A`, qty 30)

| Address | Offset in response | Parameter | Type | Unit | Notes |
|---|---|---|---|---|---|
| 0x128A | regs[0] | MOSFET temperature | S_WORD | 0.1 °C | |
| 0x128B | regs[1] | (padding) | — | — | |
| 0x128C–0x128F | regs[2–5] | (reserved) | — | — | |
| 0x1290 | regs[6–7] | Pack voltage | U_DWORD | mV | `regs[6]×65536 + regs[7]` |
| 0x1292 | regs[8–9] | (padding) | — | — | |
| 0x1294 | regs[10–11] | Pack power | S_DWORD | mW | + = charging |
| 0x1296 | regs[12–13] | (padding) | — | — | |
| 0x1298 | regs[14–15] | Pack current | S_DWORD | mA | + = charging |
| 0x129A | regs[16–17] | (padding) | — | — | |
| 0x129C | regs[18] | Temperature 1 | S_WORD | 0.1 °C | |
| 0x129E | regs[20] | Temperature 2 | S_WORD | 0.1 °C | |
| 0x12A0 | regs[22–23] | Alarm bitmask | U_DWORD | — | see below |
| 0x12A4 | regs[26] | Balance current | S_WORD | mA | |
| 0x12A6 | regs[28] | State of Charge | U_WORD | % | |

### Alarm Bitmask

| Bit | Meaning |
|---|---|
| 0 | Cell undervoltage |
| 1 | Cell overvoltage |
| 2 | Discharge overcurrent |
| 3 | Charge overcurrent |
| 4 | Low temperature (charge) |
| 5 | High temperature (discharge) |
| 6 | MOS overtemperature |
| 7 | Short circuit |
| 8 | Cell delta too large |
| 9 | Pack undervoltage |
| 10 | Pack overvoltage |
| 11 | Low SOC |
| 15 | Manual shutdown |

---

## Configuration

```javascript
var CONFIG = {
  BAUD_RATE: 9600,          // must match BMS setting
  MODE: '8N1',
  SLAVE_ID: 1,              // must match BMS Device Address setting
  CELL_COUNT: 16,           // 8 / 10 / 12 / 14 / 16 / 20 / 24
  RESPONSE_TIMEOUT: 2000,   // ms — generous for bulk reads at 9600 baud
  INTER_READ_DELAY: 100,    // ms between block A and block B reads
  POLL_INTERVAL: 10000,     // ms between full poll cycles
  DEBUG: false,             // true = print raw TX/RX frames
};
```

> Set `CELL_COUNT` to match your battery pack. Common values: 8 (24 V), 16 (48 V), 20 (60 V), 24 (72 V).

---

## Console Output Example

```
JK200 BMS - MODBUS-RTU Reader
==============================
Cells: 16 | Poll: 10 s

--- JK200 BMS ---
  Cells (16):
      1: 3.412 V
      2: 3.411 V
      3: 3.413 V (max)
      4: 3.410 V (min)
     ...
     16: 3.412 V
  Delta: 0.003 V | Min: 3.410 V (cell 4) | Max: 3.413 V (cell 3)
  Pack:    54.592 V | 48.500 A | 2647.712 W
  SOC:     78 %
  Temp:    MOS 34.5 C | T1 27.8 C | T2 28.1 C
  Balance: 0.050 A
  Alarms:  none
```

---

## Implementation Notes

- Only FC 0x03 (Read Holding Registers) is used — the script is **read-only**.
- Two bulk reads per poll: block A (cell voltages) then block B (parameters), with a 100 ms inter-read delay for bus stability.
- CRC-16 is computed via lookup table (MODBUS polynomial 0xA001).
- MODBUS exception responses are detected (FC | 0x80) and surfaced as error strings.
- A configurable response timeout (default 2 s) guards each request.
- Signed 32-bit values (power, current) are assembled from two 16-bit registers using integer arithmetic, avoiding bitshift overflow in mJS.

---

## References

- [JK BMS RS485 Modbus V1.0 Protocol](https://github.com/ciciban/jkbms-PB2A16S20P)
- [ESPHome JK-BMS integration (syssi)](https://github.com/syssi/esphome-jk-bms)
- [ESPHome JK-BMS MODBUS YAML example](https://github.com/syssi/esphome-jk-bms/blob/main/esp32-jk-pb-modbus-example.yaml)
- [JK BMS RS485 Modbus V1.1 PDF](https://github.com/syssi/esphome-jk-bms/blob/main/docs/pb2a16s20p/BMS%20RS485%20Modbus%20V1.1.pdf)
- [MODBUS Protocol Specification](https://modbus.org/specs.php)
