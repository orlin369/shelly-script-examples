# Changelog

All notable changes to this project will be documented in this file.

## 2026-08
- Add a self-deploying `*_vc.shelly.js` companion script to every device folder under `modbus/` (Deye SG01HP3/SG02LP1/SG03LP1/SG04LP3, Growatt MIC_2500TL-X/MIN_4200TL-XE/SFP5000/SPH_10000TL3_BH-UP, Huawei SUN-2000, IGEN DTSD422, MarsRock G2 SUN Series, ComWinTop CWT-MB308V, CyberPower CP1600EPFCLCD): reads the full documented register set every poll (printed to console) and self-deploys the 9 most valuable parameters as a grouped Virtual Components dashboard via the standard `ensureVirtualComponents` helper, replacing the previous `Virtual.getHandle`-only assumption that components already existed
- Restore standard JSDoc headers (`@title`/`@description`/`@status`/`@link`) on 66 existing `modbus/` scripts that had lost them
- Fix a stale `@link` pointing at `the_pill/MODBUS/...` on the MarsRock G2 SUN Series reader
- Document the new per-device `*_vc.shelly.js` pattern in `modbus/README.md`
- Make every remaining single-purpose `modbus/` script self-deploy its own Virtual Component(s) for whatever it reads, instead of assuming components already exist:
  - Rewire 33 `ENTITIES`-array scripts across CyberPower CP1600EPFCLCD, Deye SG01HP3/SG02LP1/SG03LP1/SG04LP3, and Growatt MIC_2500TL-X/MIN_4200TL-XE/SFP5000/SPH_10000TL3_BH-UP to build a number-type Virtual Component (+ group) for every register they read via `ensureVirtualComponents`
  - Rebuild the 5 raw Huawei SUN-2000 register-table fragments (`get_grid`, `get_pv`, `get_energy`, `device_state`, `get_inverter_status`) into complete, standalone, self-deploying scripts with a MODBUS endpoint, polling loop, and Virtual Components dashboard (previously just bare arrays with no runnable scaffolding)
  - Add per-channel self-deploying Virtual Components to the 5 ComWinTop CWT-MB308V single-channel examples (`example_discrete_inputs`, `example_input_register`, `example_write_holding_register`, `example_discrete_outputs`, `example_pot_anim`), fixing two of them that assumed a pre-existing `number:200` component
  - Fix 7 Deye/Growatt `application_examples` scripts (`display_virtual_components` x2, `display_virtual_components_ui_async`, `external_display`, `shekran/shekran`, `vc_modes_deye`, `vc_modes_growatt`) that previously called `Virtual.getHandle` on components assumed to already exist; the two `vc_modes_*` scripts now self-deploy `enum`-type Virtual Components for their mode selectors
  - Leave `print_parameters.shelly.js`, `example_cli.shelly.js`, and `diagnostic_register_scan.shelly.js` intentionally Virtual-Component-free: their stated purpose is a console-only readout or a one-shot register scan with no fixed named parameters, matching the existing `entire_modbus_table.shelly.js`/`all_registes.shelly.js` exception
  - Leave `get_battery.shelly.js` (Huawei), `get_regs.shelly.js`, `get_env.shelly.js`, and `get_inverter_settings.shelly.js` untouched: the first duplicates the other 5 Huawei fragments combined (treated like an entire-table reference), the other three still contain `TODO` placeholder register addresses that cannot be legitimately turned into working Virtual Components without fabricating hardware data

## 2026-02
- Update `modbus/Deye/SG02LP1/application_examples/shekran/README.md` to reflect script functionality
- Add new `modbus/` example collection and standardize JSDoc headers across the new `.shelly.js` files
- Add `switch-input/rgbw-remote-controll.shelly.js` and register it in the manifest/index
- Restructure loose HTTP integration scripts into per-script folders with matching README files
- Fix incomplete Prometheus move (update manifest, @link, README, delete old file)
- Move Telegram files into http-integrations/telegram directory
- Clarify in `AGENTS.md` that all commit requests must follow AGENTS rules
- Add Python shebang and UTF-8 encoding headers to all `tools/*.py` scripts
- Remove deprecated `tools/upload-script.sh` and its documentation section
- Enhance put_script.py with full lifecycle (stop, upload, start) and error handling
- Move BLU Assistant and Cury to Collections section in README
- Remove Apache 2.0 license header comments from legacy JS and Python examples
- Add AGENTS.md with coding standards and contribution guidelines
- Reorganize documentation structure (separate CHANGELOG.md, update README.md)
- Add The Pill UART peripheral collection (Roomba, MODBUS, RFID, SDS011/018, YS-IRTM)
- Reorganize JS examples into capability-based folders
- Rename all script files to .shelly.js
- Add BLU presence watcher example
- Add manifest integrity checker tool (check-manifest-integrity.py)

## 2025-11
- Add script that allows to monitor data from Victron's Smartsolar charge controller.

## 2025-05
- Add examples of how to send and receive messages using the LoRa Addon.

## 2024-12
- Update some legacy code to the latest version.

## 2024-11
- Add a universal BLU to MQTT script
- Fixed n-way-dimmer synchronization problem

## 2024-06
- Advanced Load shedding with schedules and notifications
- Add a second meter to advanced load shedding with a companion script
- Monitor Power Outages or Crashed Services
- Updated N-Way Dimmer with JSON fix and documentation

## 2024-04
- Load shedding with Shelly Pro4PM and Pro3EM

## 2023-11
- NTC Conversion example

## 2023-09
- Shelly BLU Motion script example

## 2023-08
- Telegram interaction with Shelly script

## 2023-06
- BLE scanner examples - Aranet2 support

## 2023-05
- BLE scanner examples - Shelly BLU (refactored solution)
- BLE events handler - Scene Manager
- Push notifications example

## 2023-04
- BLE scanner examples - Aranet4 support
- Gateway between Shelly BLU button1 and other devices

## 2023-03
- shell script for uploading scripts on linux and mac
- http handler example

## 2022-12
- Shelly BLU Button example
- Shelly BLU Door Window example

## 2022-11
- BLE scanner examples - ruuvi and b-parasite support

## 2022-09
- Schedule usage scripts and schedule registering scripts

## 2022-03
- HomeAssistant MQTT discovery of sensors

## 2022-01
- HomeAssistant MQTT discovery example
- activation_switch behavior replicated in script

## 2021-11
- Updated wifi-provision to include support for Gen1 devices
- Added relay control based on weather service temperature reading
- Router Watchdog script
- Building block snippets

## 2021-09
- Shelly Scripts demonstrating different script or device capabilities
- `tools/put_script.py` for uploading scripts from the command line.
