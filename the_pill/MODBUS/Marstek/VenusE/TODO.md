# TODO - Marstek VenusE

- Confirm whether 32-bit registers use high-word-first or low-word-first ordering. Current test had no load, so non-zero 32-bit power/energy values were not available for validation.
- Confirm signed direction conventions for battery current, battery power, AC power, and offgrid power. Requires an office test with charge/discharge or load.
- Confirm `35100` inverter-state enum values while the device is sleeping, charging, discharging, and in backup/bypass modes.
- Confirm alarm/fault bit behavior on hardware and capture at least one non-zero example if possible.
- Validate `42000` RS485 control mode behavior before any write/control script is added.
- Decide whether write helpers for force charge/discharge and schedule programming should be added as separate guarded scripts.
- Promote scripts to `production` only after hardware validation and manifest verification pass.
