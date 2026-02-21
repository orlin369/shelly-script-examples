# MODBUS-RTU Master

> **Under Development** - This example is currently under development and may not be fully functional.

Scripts for communicating with MODBUS slave devices (sensors, PLCs, energy meters, etc.) using the MODBUS-RTU protocol over UART.

## Hardware Requirements

- Shelly device with UART (e.g., The Pill)
- RS485 transceiver module (e.g., MAX485, SP485)
- MODBUS slave device

### Wiring

| RS485 Module | Shelly |
|--------------|--------|
| RO (Receiver Output) | RX (GPIO) |
| DI (Driver Input) | TX (GPIO) |
| VCC | 3.3V or 5V |
| GND | GND |

**RS485 Bus:**
| RS485 Module | MODBUS Device |
|--------------|---------------|
| A (D+) | A (D+) |
| B (D-) | B (D-) |
| GND | GND (optional) |

**UART Settings:** 9600 baud (default), 8N1

## Files

### modbus_rtu.shelly.js

**Core MODBUS-RTU Master Library** - Full implementation of the MODBUS-RTU protocol.

**Supported Function Codes:**

| Code | Name | Description |
|------|------|-------------|
| 0x01 | Read Coils | Read 1-2000 coil status bits |
| 0x02 | Read Discrete Inputs | Read 1-2000 input status bits |
| 0x03 | Read Holding Registers | Read 1-125 16-bit registers |
| 0x04 | Read Input Registers | Read 1-125 16-bit input registers |
| 0x05 | Write Single Coil | Write one coil ON/OFF |
| 0x06 | Write Single Register | Write one 16-bit register |

**API Methods:**
```javascript
MODBUS.init()                                    // Initialize UART

// Read functions
MODBUS.readCoils(slave, addr, qty, callback)              // FC 0x01
MODBUS.readDiscreteInputs(slave, addr, qty, callback)     // FC 0x02
MODBUS.readHoldingRegisters(slave, addr, qty, callback)   // FC 0x03
MODBUS.readInputRegisters(slave, addr, qty, callback)     // FC 0x04

// Write functions
MODBUS.writeSingleCoil(slave, addr, value, callback)      // FC 0x05
MODBUS.writeSingleRegister(slave, addr, value, callback)  // FC 0x06

// Convenience methods
MODBUS.readRegister(slave, addr, callback)       // Read single holding register
MODBUS.readCoil(slave, addr, callback)           // Read single coil
```

---

### ComWinTop/mb308v.shelly.js

**CWT-MB308V GPIO Expander Example** - See [ComWinTop/README.md](ComWinTop/README.md) for full documentation.

---

### JK200-MBS/the_pill_mbsa_jk200.shelly.js

**Jikong JK-PB BMS Reader** - See [JK200-MBS/README.md](JK200-MBS/README.md) for full documentation.

## Usage Examples

### Read Holding Registers

```javascript
// Read 2 registers from slave 1, starting at address 0
MODBUS.readHoldingRegisters(1, 0, 2, function(err, registers) {
    if (err) {
        print("Error: " + err);
        return;
    }
    print("Register 0: " + registers[0]);
    print("Register 1: " + registers[1]);
});
```

### Write Single Coil

```javascript
// Turn ON coil 0 on slave 1
MODBUS.writeSingleCoil(1, 0, true, function(err, success) {
    if (err) {
        print("Failed: " + err);
    } else {
        print("Coil turned ON");
    }
});
```

### Write Single Register

```javascript
// Write value 250 to register 100 on slave 1
MODBUS.writeSingleRegister(1, 100, 250, function(err, success) {
    if (err) {
        print("Failed: " + err);
    } else {
        print("Register written");
    }
});
```

## Configuration

```javascript
var CONFIG = {
    BAUD_RATE: 9600,        // 9600, 19200, 38400, 115200
    MODE: "8N1",            // "8N1", "8E1", "8O1"
    RESPONSE_TIMEOUT: 1000, // ms
    DEBUG: true
};
```

## References

- [MODBUS Protocol Specification](https://modbus.org/specs.php)
- [MODBUS over Serial Line](https://modbus.org/docs/Modbus_over_serial_line_V1_02.pdf)
