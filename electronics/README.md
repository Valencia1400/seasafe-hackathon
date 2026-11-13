# Electronics - Owner: Person 2 (support: Person 3)

Protocol and safety rules: [docs/architecture.md](../docs/architecture.md). Requirements R4-R9.

## Build order
1. ESP32 sends telemetry with `seq` and `ms` (fixed values first) -> Pi/laptop receives it.
2. Heartbeat + **comms-loss timeout** -> motor output 0 (R9). Do this before sensors: it is the core safety function.
3. E-stop and reset messages (R8).
4. IMU roll/pitch (R5, R6).
5. Pressure sensor (atmospheric pressure, hPa).
6. Leak input (R7) - a real leak sensor or two wires/a button as a clearly labelled test input.

## Bench motor output
LEDs (with resistors) or a motor driver with motors but **no propellers**. Show the output value in telemetry (`l`, `r`) so stops can be timed from the log.

## Safety rules
- Nothing powered near water. Dry bench only.
- Resistor on every LED; check polarity; prefer USB power or primary cells; no loose LiPo cells.
- Person 2 signs off every powered test in the log below.

## Pin table (fill in)
| Function | ESP32 pin | Part | Notes |
|---|---|---|---|
| IMU SDA/SCL | | | I2C |
| Pressure SDA/SCL | | | I2C (shared bus) |
| Leak input | | | pull-down? |
| Motor L | | | PWM |
| Motor R | | | PWM |

## Folders
- `firmware/` - ESP32 code. Commit only code that has run on hardware; note the board and result below.
- `wiring/` - wiring diagram or breadboard photo.

## Test log (what was actually run)
| Date/time | What | Board | Result | Photo/video |
|---|---|---|---|---|
| | | | | |
