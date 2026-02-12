# Shekran External Display

Script: `shekran.shelly.js`

## What this example is about
This script reads live data from a Deye SG02LP1 solar inverter over Modbus RTU and pushes it to a SHEKRAN IoT ePaper display via its JSON-RPC 2.0 API.

The SHEKRAN is an ESP32-based device with a 2.13" black-and-white ePaper screen. It accepts widget updates over HTTP and renders them on demand.

## How it works
Every 60 seconds the script:
1. Reads all configured Modbus registers from the inverter.
2. Updates the corresponding virtual components on the Shelly device.
3. Sends a JSON-RPC 2.0 batch request to the SHEKRAN display with `ui.set` for each mapped widget.
4. Triggers a partial `screen.refresh` so the ePaper renders the new values.
5. Once every 24 hours a full refresh is performed to clear ePaper ghosting.

## Widget mapping

The `main` screen on the SHEKRAN display uses these widget IDs:

| Widget ID | Type | Modbus Register | Description |
|---|---|---|---|
| `battery` | `lv_bar` | 184 (u16) | Battery SOC [%] |
| `battery_power` | `lv_label` | 190 (i16) | Battery Power [W] |
| `pv_power` | `lv_label` | 186 (u16) | PV1 Power [W] |
| `grid_power` | `lv_label` | 169 (i16) | Total Grid Power [W] |
| `load_power` | `lv_label` | 175 (i16) | Total Power / Load [W] |

## Screen definitions

The `screens/` folder contains the XML screen definitions downloaded from the SHEKRAN device:

- `main.xml` - Inverter dashboard with SOC bar, power values, and connection status.
- `status.xml` - System status page (WiFi, heap, uptime, RPC, display).
- `gauges.xml` - Temperature and humidity arc gauges for external sensors.
- `connect.xml` - QR code screen for WiFi provisioning in AP mode.

To upload a screen to the device use `screen.upload` via the JSON-RPC API:
```bash
curl -X POST http://<shekran-ip>/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "screen.upload",
    "params": {
      "name": "main",
      "content": "<xml content here>"
    },
    "id": 1
  }'
```

## Use cases this solves
- Display live solar inverter metrics on a low-power ePaper screen.
- Wall-mounted energy dashboard that is always visible without a backlight.
- Combining Modbus RTU data acquisition with HTTP-based display output.

## Configuration
Edit these variables at the top of the script:
- `UPDATE_RATE` - polling interval in seconds (default: 60).
- `INVERTER_ID` - Modbus slave address of the inverter (default: 1).
- `SHEKRAN_RPC_URL` - HTTP endpoint of the SHEKRAN display.

## Notes before use
- The Shelly device must have Modbus RTU connectivity to the Deye inverter (RS-485).
- The SHEKRAN display must be on the same network and reachable via HTTP.
- Virtual components `number:200` through `number:208` must exist on the Shelly device.
- The `main` screen XML must contain the widget IDs listed in the mapping table above.
