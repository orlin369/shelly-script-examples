# Marstek VenusE Label Notes

## Known
- Device family: Marstek VenusE
- Device identity confirmed by user for this integration.
- Interface source: `modbus marstek - address.csv`
- Alarm/fault source: `modbus marstek - ex_info.csv`
- Protocol source: `Venus-E 3.0 485 Protocol`, v1.0, 2024-07-08
- Communication: Standard Modbus RTU, address `1`, `115200`, 8 data bits, no parity, 1 stop bit
- Hardware response confirmed with address `1`, `115200`, `8N1` on The Pill.
- Both console and Virtual Component readers confirmed working on hardware.
- Confirmed RS485 RJ45 pinout for this Venus-E 3.0: pin `1=B`, pin `2=A`, pins `4/5=+5V`, pins `7/8=GND`
- MODBUS register map includes EMS, inverter, BMS, AC, battery, WiFi/BLE/MQTT, schedule, and force charge/discharge registers.

## Missing
- Vendor firmware version shown on the device/app
- Rated battery voltage, power, and capacity
- Vendor documentation URL or public PDF source

## Validation Notes
Add label photos, vendor links, and confirmed communication settings here after the first hardware test.
