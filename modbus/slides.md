---
title: Modbus RTU in Shellies
author: Kiril <kiril.zyapkov@shelly.com>
options:
  implicit_slide_ends: true
---

Modbus: Overview
---

<!-- font_size: 4 -->

 * Industrial automation protocol
 * One ~~Master~~ **Client**
 * Many ~~Slaves~~ **Servers**

<!-- pause -->
<!-- new_line -->
<!-- font_size: 3 -->

 * Transports:
    * **Serial/RTU**
    * Serial/ASCII
    * TCP/IP

Modbus: Overview: Participants
---

<!-- font_size: 3 -->

Participants:

 * Many ~~Slaves~~ **Servers**
    * Export data to clients
    * Data is organized into "Registers"
    * Registers can be readonly or writable

<!-- new_line -->

 * One ~~Master~~ **Client**
    * Clients can
        * write register values
        * read register values

Modbus: Quirks
---

<!-- font_size: 3 -->

Also:

 * Only the **Client** initiates transactions
 * **Servers** are passive, cannot notify the **Client** of events
 * Obscure features nobody uses
    * file records
    * device identification fields
    * custom commands (these are actually used, but we will skip them for now)

<!-- end_slide -->


Data Model
---

<!-- font_size: 2 -->

4 Separate register spaces; each with 2^16 (65536) registers

<!-- new_line -->
<!-- font_size: 3 -->

|          | 1bit     | 16bit    |
|----------|----------|----------|
| Read-only | Discrete Inputs | Input Registers |
| Read-write | Coils    | Holding Registers |

<!-- end_slide -->

Register Spaces
---

<!-- font_size: 2 -->

```
+-------------------------------------------------------------------------+
|                        Modbus  Server                                   |
|                                                                         |
| +---------+  +----------------+  +----------------+  +----------------+ |
| | Coils   |  | Discrete Inputs|  | Holding Regs   |  | Input Regs     | |
| | (RW,1b) |  | (RO,1b)        |  | (RW,16b)       |  | (RO,16b)       | |
| |0x0000   |  |0x0000          |  |0x0000          |  |0x0000          | |
| |         |  |                |  |                |  |                | |
| |  ...    |  |   ...          |  |   ...          |  |   ...          | |
| |         |  |                |  |                |  |                | |
| |0xffff   |  |0xffff          |  |0xffff          |  |0xffff          | |
| +---------+  +----------------+  +----------------+  +----------------+ |
|                                                                         |
+-------------------------------------------------------------------------+
                                             | ID: 1
                                             |
+--------------------------+                 |
|                          |      RTU        |    Other Sla--- Servers
|    Modbus Client         |-----------------+-------------------------->>
|                          |
+--------------------------+

```

<!-- end_slide -->


Register Map Example: DM215-Mod
---

Single phase 2 modular energy meter
With Serial Modbus interface

<!-- column_layout: [1, 1] -->
<!-- column: 0 -->

![image:width:90%](regmap1.png)

<!-- column: 1 -->

![image:width:90%](electrometer1.jpg)

Register Map Example: Solis R290A
---

![image:width:90%](inverter1.png)

Register Map Example: Afore Grid Inverter
---

![image:width:90%](inverter2.png)


Operations
---
<!-- font_size: 2 -->

## Operations on Register Types

| Register Type      | Read Operation             | Write Operation            |
|--------------------|---------------------------|----------------------------|
| Discrete Inputs    | `0x02 Read Discrete Inputs`| N/A                        |
|--------------------|---------------------------|----------------------------|
| Coils              | `0x01 Read Coils`          | `0x05 Write Single Coil`   |
|                    |                            | `0x0F Write Multiple Coils`|
|--------------------|---------------------------|----------------------------|
| Input Registers    | `0x04 Read Input Registers`| N/A                        |
|--------------------|---------------------------|----------------------------|
| Holding Registers  | `0x03 Read Holding Registers`| `0x06 Write Single Register` |
|                    |                            | `0x10 Write Multiple Registers` |


Modbus: This
---
<!-- font_size: 4 -->
<!-- jump_to_middle -->

<!-- column_layout: [1, 3, 1] -->
<!-- column: 1 -->

Modbus RTU Controller
<!-- font_size: 2 -->
<!-- pause -->
 * Serial/RTU transport
<!-- pause -->
 * Client
<!-- pause -->
 * Advanced capabilities

<!-- reset_layout -->



Shelly: Modbus Controller
---
<!-- font_size: 2 -->

```
+-------------------+
|   JS Bindings     |  <-- Espruino JS API
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

<!-- end_slide -->

`RtuClient`
---
<!-- font_size: 2 -->

- Handles UART/RS485 serial communication
- Implements Modbus RTU protocol: framing, parsing, CRC, timing
- Queues and executes read and write commands

**Accepted configuration:**
- UART port and GPIOs (RX, TX, DE)
- Serial settings: baud rate, data bits, parity, stop bits
- Silent time between requests

```cpp
  // 16-bit register reads
  // void ReadRegisters(uint8_t server_id, RegisterType rtype, uint16_t addr,
  //                    uint16_t qty, ReadRegsCB cb);
  c->ReadRegisters(sid, rtype, addr, qty,
                   [ri](const shos::StatusOr<std::vector<uint16_t>> &res) {
                     if (!res.ok()) {
                       SendStatus(ri, res.status());
                       return;
                     }
                     const auto &values = res.ValueOrDie();
                     shos_rpc_send_responsef(ri, "{values:%M}",
                                             json_printf_array, values.data(),
                                             values.size() * sizeof(uint16_t),
                                             sizeof(uint16_t), "%" PRIu16);
                   });
```


`RtuController`
---
<!-- font_size: 2 -->

- Manages subscriptions for register ranges ("items" or "entities")
- Batches and schedules Modbus read requests
- Handles polling, change detection, and event dispatch
- Acts as the main logic layer between JS API and the Modbus client

**Accepted controller options:**
- Poll interval (minimum time between Modbus requests)
- Serial port configuration for this Server

```cpp
class RtuController {
  struct Sub {
    struct Opts {
      Range range;
      int poll_int = kPollFastest;  // minimum time between reads
    };
  struct Handler {
    virtual ~Handler() = default;
    virtual void HandleBits(const std::vector<bool> &bits UNUSED_ARG) {}
    virtual void HandleWords(Str bytes UNUSED_ARG) {}
    virtual void HandleWriteError(const Status &st UNUSED_ARG) {}
    virtual void HandleReadError(const Status &st UNUSED_ARG) {}
  };
  std::unique_ptr<Sub> Register(Sub::Opts opts, Handler &handler);
}
```

`Entity`: a higher-level data view on registers
---
<!-- font_size: 2 -->

Facilities for consuming raw register values, implements `RtuController::Handler`

* Numeric types: `u16`, `i16`, `u32`, `i32`, `u64`, `i64`, `f32`, `f64`,
  * Signed and unsigned; 16-, 32-, and 64-bit wide integers
  * Floating Point Numbers; 32- and 64-bit wide
* Booleans and bitfields
  * Bitwise Booleans (for 1-bit registers)
  * Bit-masked values – fields within 16-bit wide registers given a bit-offset and mask
* Bytes
  * Raw bytes, stitching together adjacent 16-bit registers
  * Strings, like raw bytes but null-terminated for easier consumption

Byte shuffling
---
<!-- font_size: 3 -->

| **ABCD**                 | **BE byte order**        | **LE byte order**            |
|--------------------------|:------------------------:|:----------------------------:|
| **BE word order**        | **ABCD**                 | **BADC**                     |
| **BE word order**        | **CDAB**                 | **DCBA**                     |



Controller Subscription
---
<!-- font_size: 2 -->

Registers a new subscription ("item" or "entity") for a specific Modbus register range, with a handler for value updates and errors.

**Options accepted:**
- `range`: Register range (type, address, quantity)
- `poll_int`: Polling interval (ms) for this item
    - 0: as often as possible
    - -1: poll once
    - -2: never poll automatically

**Handler:**
- Callbacks for value updates and errors (bits/words, read/write)

**Returns:**
- A handle (`Sub`) for the registered subscription, with methods to trigger reads/writes and access options


Controller Subscription
---
<!-- font_size: 2 -->

```cpp
  class Sub final {
    // When was this range last polled
    int64_t last_read() const { return last_read_; };
    // When should we schedule the next read, -1 for never
    int64_t next_read() const;
    // Request a one-time read of the item soon
    void ReadOnce();

    // TODO(kiril): Write data into the range of this item
    Status Write(const std::vector<bool> &);
    Status Write(Str bytes);
  };
```


Js Entity Example
---

<!-- font_size: 2 -->

```javascript
const mc = ModbusController.get(1);
mc.setOptions({ pause_ms: 500 })


piBe4 = mc.addEntity({ rtype: ModbusController.REGTYPE_INPUT, addr: 135, itype: "f32", poll_int: -1 });
piBe4.on("change", function(){
    console.log(piBe4.value());
});


```
