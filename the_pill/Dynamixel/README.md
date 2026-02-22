# Dynamixel Servo Control

> **Under Development** - These examples are currently under development and may not be fully functional.

Scripts for controlling Dynamixel servos (AX-12A and compatible) using
Dynamixel Protocol 1.0 over UART.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- Dynamixel servo(s) — AX-12A, AX-18A, MX series (Protocol 1.0)
- Appropriate power supply (7.4 V for AX-12, 12 V for MX series)
- Half-duplex TTL wiring or a dedicated interface board (e.g., U2D2)

### Wiring — Half-Duplex TTL (direct)

The Dynamixel TTL bus is half-duplex: TX and RX share the same wire.
Connect through a 1 kΩ resistor so TX does not drive RX directly:

```
Shelly TX ──┬──[1kΩ]──── Shelly RX
            │
            └─────────── Dynamixel DATA
```

| Dynamixel | Shelly |
|-----------|--------|
| DATA      | TX + RX (wired together via 1 kΩ) |
| GND       | GND    |
| VCC       | External supply (7.4 V–12 V depending on model) |

> **Note:** Shelly logic is 3.3 V. AX-12A TTL levels are compatible.
> Set `ECHO_FILTER: true` in CONFIG when using this wiring — the TX
> bytes appear on RX and must be discarded.

### Wiring — Interface Board (U2D2 / USB2Dynamixel)

Connect the interface board's UART pins to Shelly TX / RX normally
(full-duplex), and set `ECHO_FILTER: false` in CONFIG.

**UART Settings:** 1,000,000 baud (1 Mbps), 8N1
*(try 57,600 or 115,200 if your servos were reconfigured)*

---

## Files

### dynamixel_list.shelly.js

**Network Scanner** — Scans the bus for all connected servos and prints
their ID, model number, and firmware version.

**How it works:**
1. Sends a `PING` (instruction `0x01`) to each ID in the configured range
2. Records every ID that responds with a valid status packet
3. Reads `MODEL_NUMBER` (2 bytes) + `FIRMWARE` (1 byte) from each found servo
4. Prints a summary to the Shelly console

**Configuration:**

| Key | Default | Description |
|-----|---------|-------------|
| `BAUD_RATE` | `1000000` | Bus baud rate |
| `START_ID` | `1` | First ID to scan |
| `END_ID` | `20` | Last ID to scan (max 253) |
| `PING_TIMEOUT` | `50` ms | Wait time per servo before moving on |
| `READ_TIMEOUT` | `100` ms | Wait time for model/firmware read |
| `ECHO_FILTER` | `true` | Discard TX echo on RX (half-duplex wiring) |
| `DEBUG` | `false` | Print raw TX/RX hex bytes |

**Example Output:**
```
Dynamixel Network Scanner
Protocol 1.0 | Baud: 1000000
UART ready. Starting scan in 500 ms...
=== Dynamixel Network Scan ===
Scanning IDs 1 to 20...
  Found servo at ID 1
  Found servo at ID 3
  Found servo at ID 5
Ping phase done. Found: 3 servo(s).

=== Discovered Servos ===
  ID 1 | Model: 12 | Firmware: v24
  ID 3 | Model: 12 | Firmware: v24
  ID 5 | Model: 12 | Firmware: v24
=== Scan complete ===
```

---

### dynamixel_move6.shelly.js

**6-Servo Motion Demo** — Enables torque on six servos then alternates
them between two pose sets using a single `SYNC_WRITE` broadcast.

**How it works:**
1. Sends `SYNC_WRITE` (instruction `0x83`) to enable torque on all 6 servos
2. Sends `SYNC_WRITE` for Goal Position + Moving Speed to move all servos simultaneously
3. Waits `MOVE_INTERVAL` ms, then moves to the alternate pose
4. Repeats indefinitely

`SYNC_WRITE` is a broadcast (ID `0xFE`) — all target servos execute the
command at the same time and no status response is returned.

**Servo Configuration (`SERVOS` array):**

```javascript
var SERVOS = [
  { id: 1, poseA: 200, poseB: 820, speed: 100 },
  { id: 2, poseA: 820, poseB: 200, speed: 100 },
  // ...
];
```

| Field | Range (AX-12) | Description |
|-------|---------------|-------------|
| `id` | 1–253 | Servo ID set via Dynamixel Wizard |
| `poseA` | 0–1023 | Target position for pose A (512 = centre) |
| `poseB` | 0–1023 | Target position for pose B |
| `speed` | 1–1023 | Moving speed (0 = maximum uncontrolled) |

> For MX series servos the position range is 0–4095.

**Configuration:**

| Key | Default | Description |
|-----|---------|-------------|
| `BAUD_RATE` | `1000000` | Bus baud rate |
| `MOVE_INTERVAL` | `2000` ms | Time between pose changes |
| `ECHO_FILTER` | `true` | Discard TX echo on RX (half-duplex wiring) |
| `DEBUG` | `false` | Print raw TX hex bytes |

**Example Output:**
```
Dynamixel 6-Servo Motion Example
Protocol 1.0 | Baud: 1000000
Servos: 6
UART ready.
Torque enabled on all servos.
Moving all servos to pose A.
Moving all servos to pose B.
Moving all servos to pose A.
...
```

---

## Protocol Reference (Protocol 1.0)

### Packet Format

```
[0xFF] [0xFF] [ID] [LENGTH] [INSTRUCTION] [PARAMS...] [CHECKSUM]
```

| Field | Size | Description |
|-------|------|-------------|
| Header | 2 bytes | Always `0xFF 0xFF` |
| ID | 1 byte | Servo ID (`0xFE` = broadcast) |
| LENGTH | 1 byte | `len(PARAMS) + 2` |
| INSTRUCTION | 1 byte | See table below |
| PARAMS | variable | Instruction-specific data |
| CHECKSUM | 1 byte | `~(ID + LENGTH + INSTRUCTION + sum(PARAMS)) & 0xFF` |

### Instructions Used

| Instruction | Code | Description |
|-------------|------|-------------|
| PING | `0x01` | Check if servo is alive |
| READ_DATA | `0x02` | Read register(s) |
| SYNC_WRITE | `0x83` | Write register(s) on multiple servos simultaneously |

### Key Registers (AX-12)

| Register | Address | Size | Description |
|----------|---------|------|-------------|
| Model Number | `0x00` | 2 bytes | Servo model (read-only) |
| Firmware | `0x02` | 1 byte | Firmware version (read-only) |
| Torque Enable | `0x18` | 1 byte | `0`=off, `1`=on |
| Goal Position | `0x1E` | 2 bytes | Target position (0–1023) |
| Moving Speed | `0x20` | 2 bytes | Speed (0–1023, 0=max) |
| Present Position | `0x24` | 2 bytes | Current position (read-only) |

## Quick Start

### List servos
1. Wire servo(s) to Shelly UART
2. Set `BAUD_RATE`, `START_ID`, `END_ID` in CONFIG
3. Upload `dynamixel_list.shelly.js`
4. Run — discovered servos are printed to the console

### Move 6 servos
1. Wire servos to Shelly UART (all on the same bus)
2. Set servo IDs and target positions in the `SERVOS` array
3. Upload `dynamixel_move6.shelly.js`
4. Run — torque is enabled and the demo loop starts automatically

## References

- [Dynamixel Protocol 1.0 (ROBOTIS e-Manual)](https://emanual.robotis.com/docs/en/dxl/protocol1/)
- [AX-12A e-Manual](https://emanual.robotis.com/docs/en/dxl/ax/ax-12a/)
- [PyDynamixel — Python reference implementation](https://github.com/orlin369/PyDynamixel)


## Schematic

```ASCII
                                             5V
                                             |
            /----------74LS241--------\      |
            |                         |      |
            |                       [20]-----+
            |                         |      |
            |                         |    [10k]
            |                         |      |
 Tx  >-----[17]--[>]----------------[ 3]-----+-----> to motor data pin
            |     |                   |      |
            |     |                   |      |
        +--[19]---+                   |      |
        |   |                         |      |
 DIR >--+--[ 1]---+                   |      |
            |     |                   |      |
            |     O                   |      |
 Rx  >-----[18]--[>]----------------[ 2]-----+
            |                         |
            |                         |
 GND >-----[10]                       |
            |                         |
            \-------------------------/
```