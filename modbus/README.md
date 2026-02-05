# Modbus RTU with Shelly Devices

This guide introduces Modbus RTU and how to use it with Shelly devices.

## What is Modbus?

Modbus is a communication protocol widely used for connecting electronic devices. It follows a Client-Server architecture:

- **Client** (formerly "Master"): Initiates all communication, reads and writes data
- **Server** (formerly "Slave"): Responds to client requests, exports data through registers

**Key characteristics:**
- Only the Client can initiate transactions
- Servers are passive and cannot notify the Client of events
- Simple, robust, and widely supported across many devices

## Transport Types

| Transport | Description |
|-----------|-------------|
| **Serial/RTU** | Binary protocol over RS-485 (most common, used by Shelly) |
| Serial/ASCII | Text-based protocol over serial |
| TCP/IP | Modbus over Ethernet/WiFi |

## Data Model

Modbus organizes data into four register spaces, each with up to 65,536 (2^16) registers:

|            | 1-bit | 16-bit |
|------------|-------|--------|
| **Read-only** | Discrete Inputs | Input Registers |
| **Read-write** | Coils | Holding Registers |

### Register Types Explained

```
+-------------------------------------------------------------------------+
|                        Modbus Server                                    |
|                                                                         |
| +---------+  +----------------+  +----------------+  +----------------+ |
| | Coils   |  | Discrete Inputs|  | Holding Regs   |  | Input Regs     | |
| | (RW,1b) |  | (RO,1b)        |  | (RW,16b)       |  | (RO,16b)       | |
| |0x0000   |  |0x0000          |  |0x0000          |  |0x0000          | |
| |  ...    |  |   ...          |  |   ...          |  |   ...          | |
| |0xffff   |  |0xffff          |  |0xffff          |  |0xffff          | |
| +---------+  +----------------+  +----------------+  +----------------+ |
+-------------------------------------------------------------------------+
```

- **Coils**: Read-write single bits (e.g., on/off switches)
- **Discrete Inputs**: Read-only single bits (e.g., sensor states)
- **Holding Registers**: Read-write 16-bit values (e.g., setpoints)
- **Input Registers**: Read-only 16-bit values (e.g., measurements)

## Modbus Operations

| Register Type | Read Operation | Write Operation |
|---------------|----------------|-----------------|
| Discrete Inputs | `0x02` Read Discrete Inputs | N/A |
| Coils | `0x01` Read Coils | `0x05` Write Single Coil, `0x0F` Write Multiple Coils |
| Input Registers | `0x04` Read Input Registers | N/A |
| Holding Registers | `0x03` Read Holding Registers | `0x06` Write Single Register, `0x10` Write Multiple Registers |

## Shelly Modbus Controller

Shelly devices include a built-in Modbus RTU Controller accessible via JavaScript scripting:

```
+-------------------+
|   JS Bindings     |  <-- SHOS JS API
+-------------------+
         |
         v
+-------------------+
|   Controller      |  <-- Polling, batching, items
+-------------------+
         |
         v
+-------------------+
|     Client        |  <-- Modbus RTU protocol, UART
+-------------------+
         |
         v
 [Physical UART/RS485]
```

### Configuration Options

**Serial Settings:**
- UART port and GPIOs (RX, TX, DE)
- Baud rate, data bits, parity, stop bits
- Silent time between requests

**Controller Options:**
- Poll interval (minimum time between Modbus requests)

## Entity Types

The controller supports various data types for reading register values:

**Numeric Types:**
- `u16`, `i16` - 16-bit unsigned/signed integers
- `u32`, `i32` - 32-bit unsigned/signed integers
- `u64`, `i64` - 64-bit unsigned/signed integers
- `f32`, `f64` - 32/64-bit floating point

**Boolean and Bitfields:**
- Bitwise booleans for 1-bit registers
- Bit-masked values within 16-bit registers

**Bytes and Strings:**
- Raw bytes from adjacent registers
- Null-terminated strings

### Byte Order (Endianness)

Different devices use different byte ordering. The controller supports:

| Word Order | BE byte order | LE byte order |
|------------|---------------|---------------|
| **BE word order** | ABCD | BADC |
| **LE word order** | CDAB | DCBA |

## JavaScript API Example

```javascript
// Get the Modbus controller instance
const mc = ModbusController.get(1);

// Configure pause between requests
mc.setOptions({ pause_ms: 500 });

// Add an entity to read a 32-bit float from Input Register 135
// poll_int: -1 means poll once (not continuously)
const powerFactor = mc.addEntity({
    rtype: ModbusController.REGTYPE_INPUT,
    addr: 135,
    itype: "f32",
    poll_int: -1
});

// Listen for value changes
powerFactor.on("change", function() {
    console.log("Power Factor:", powerFactor.value());
});
```

### Polling Intervals

The `poll_int` parameter controls how often a register is read:

| Value | Behavior |
|-------|----------|
| `0` | Poll as often as possible |
| `> 0` | Poll every N milliseconds |
| `-1` | Poll once only |
| `-2` | Never poll automatically (manual read only) |

## Common Use Cases

- **Energy Meters**: Read voltage, current, power, energy consumption
- **Solar Inverters**: Monitor production, grid status, battery levels
- **Sensors**: Temperature, pressure, flow measurements
- **PLCs**: Control and monitor automated systems

## Resources

- [Modbus Controller API Reference](API.md) - Detailed API documentation
- [Modbus Organization](https://modbus.org/) - Official Modbus specifications
- [Shelly API Documentation](https://shelly-api-docs.shelly.cloud/) - Shelly scripting reference
