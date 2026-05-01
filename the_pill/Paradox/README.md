# Paradox PRT3 ASCII Bridge

Under-development UART bridge for Paradox EVO/Digiplex alarm panels through the
Paradox PRT3 printer/integration module in Home Automation ASCII mode.

## Files

- `prt3_ascii_bridge.shelly.js` - PRT3 ASCII serial bridge with optional Virtual
  Components and a local HTTP command endpoint.

## Wiring

The PRT3 DB-9 serial port is RS-232 level. The Pill UART is TTL level. Use an
RS-232 to 3.3 V TTL level shifter.

```
PRT3 TX  -> level shifter -> Shelly RX
PRT3 RX  <- level shifter <- Shelly TX
PRT3 GND ----------------- Shelly GND
```

Configure the PRT3 serial port for:

- Home Automation mode
- ASCII protocol
- 8N1
- matching baud rate, default script value: `9600`

## Optional Virtual Components

- `boolean:200` - link online/offline
- `text:200` - last received frame
- `text:201` - last transmitted command
- `text:202` - last status/event summary

Create these VCs before starting the script, or change `CONFIG.vc`.

## Local HTTP Endpoint

Examples, where `<id>` is the Shelly script slot:

```text
/script/<id>/paradox?cmd=status
/script/<id>/paradox?cmd=raw&value=RA001
/script/<id>/paradox?cmd=area_status&area=1
/script/<id>/paradox?cmd=zone_status&zone=1
/script/<id>/paradox?cmd=arm&area=1&mode=A&code=1234
/script/<id>/paradox?cmd=quick_arm&area=1&mode=S
/script/<id>/paradox?cmd=disarm&area=1&code=1234
/script/<id>/paradox?cmd=virtual_input&input=1&state=open
```

Arm modes:

- `A` - regular arm
- `F` - force arm
- `S` - stay arm
- `I` - instant arm

Do not expose this endpoint to untrusted networks. Alarm user codes are passed
as query parameters for simple local testing.

## Protocol Notes

The PRT3 ASCII protocol uses uppercase ASCII commands terminated by carriage
return. The PRT3 acknowledges commands with the first five command characters
followed by `&OK`, `&fail`, requested data, or `!` when its receive buffer is
full.

This script intentionally talks to the supported PRT3 ASCII integration module.
It does not attempt to decode or inject traffic on the encrypted/proprietary
Paradox panel bus.
