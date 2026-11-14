# Electronics - Owner: Person 2 (support: Person 3)

Protocol and safety rules: [docs/architecture.md](../docs/architecture.md). Requirements R4-R9.

## Build order
1. Control ESP32 sends telemetry with `seq` and `ms` (fixed values first) -> laptop receives it.
2. Heartbeat + **comms-loss timeout** -> motor output 0 (R9). Do this before sensors: it is the core safety function.
3. E-stop and reset messages (R8).
4. IMU roll/pitch (R5, R6).
5. Pressure sensor (atmospheric pressure, hPa).
6. Leak input (R7) - a real leak sensor or two wires/a button as a clearly labelled test input.

## Control firmware in use: `firmware/seaguardian_revC/Main/Main.ino`
ESP32 DevKit (ESP32-WROOM-32D), L298N, SG90 servo, MPU6050, NEO-6M. It connects to the laptop dashboard over Wi-Fi (`dashboard/README.md`, "Real boat ESP32"). Pinout, libraries, board settings and the bench test procedure are in [its README](firmware/seaguardian_revC/README.md). Wi-Fi name, password and the laptop address go in `Main/secrets.h` (copy `secrets.example.h`; git-ignored). **Status: compiles (ESP32 core 3.3.12), 79 PC unit tests pass; on the board it connects to the dashboard and sends live IMU data (14 Nov). Motors and servo not yet bench-tested.**

| GPIO | Connects to |
|---|---|
| 25 | L298N ENA (PWM, left motor; remove the ENA jumper) |
| 26 / 27 | L298N IN1 / IN2 (left motor direction) |
| 33 | L298N ENB (PWM, right motor; remove the ENB jumper) |
| 32 / 13 | L298N IN3 / IN4 (right motor direction) |
| 18 | Servo signal (orange) |
| 21 / 22 | MPU6050 SDA / SCL (power it from 3V3) |
| 16 / 17 | GPS TX -> 16, GPS RX -> 17 |
| 14 | Wake button to GND (optional) |
| 2 | On-board status LED |
| 34 | Battery divider (optional, off by default) |
| GND | One common ground: L298N, servo, MPU6050, GPS, battery minus |

## Older firmware (not used): `firmware/seaguardian_esp32/seaguardian_esp32.ino`
**Status: written with AI help, NOT yet compiled or run on hardware.** Open it in the Arduino IDE (ESP32 board package 2.x or 3.x, no extra libraries), check the pin table at the top against the wiring, compile, upload.

- Sensors supported out of the box: MPU-6050 IMU (0x68) and BMP280 pressure (0x76/0x77). Other models: change `imuBegin/imuRead` or `baroBegin/baroRead`. A missing sensor is reported as `null` (shown as "-" on the dashboard), so the safety logic can be tested before sensors arrive.
- Physical E-STOP button on `PIN_ESTOP_BTN` (to GND) works without the laptop.
- Status LED: steady = OK, blinking = safety stop.
- Quick check without the laptop dashboard: open the Serial Monitor (115200), you should see telemetry lines. Type `{"t":"hb","seq":1}` and press Enter, wait more than 1 s, and you should see `{"t":"evt",...,"evt":"COMMLOST"}`.
- Dashboard hardware mode is not implemented yet: it needs the protocol agreed in `docs/architecture.md` first. Until then the dashboard (`dashboard/`) runs on its simulator.

## Camera firmware: `firmware/seasafe_cam/seasafe_cam.ino`
Seeed XIAO ESP32S3 Sense: MJPEG stream + JSON status over Wi-Fi, for the detector in `vision/`. Board `XIAO_ESP32S3`, PSRAM `OPI PSRAM`. Joins the team hotspot `Armin – iPhone` by default; other networks go in `secrets.h` (copy `secrets.example.h`, git-ignored). How to flash and run: [vision/README.md](../vision/README.md); endpoints: [vision/INTEGRATION.md](../vision/INTEGRATION.md).

## Bench motor output
LEDs (with resistors) or the motor driver with the DC motor but **no propeller**. Show the output value in telemetry (`l`, `r` today) so stops can be timed from the log.

## Hardware update (D-007) - not yet in the firmware
Confirmed: **two ESP32s** - ESP32 #1 camera (video to the laptop over Wi-Fi), ESP32 #2 control (this firmware). Propulsion is **one DC motor** through a motor driver, steering is **one servo on a rear rudder**.
- The firmware above still drives two outputs `l`/`r`. Changing it to propulsion + rudder servo needs the protocol change in [docs/architecture.md](../docs/architecture.md) ("Protocol change needed") - agree it with Person 3 first.
- To add: GPS reading (position only), rudder servo output (centred on a safety stop), yaw rate from the IMU gyro.
- Optional after that: P controller on yaw rate -> rudder. PID is a stretch goal.
- Never power the motor or servo from ESP32 GPIO pins; use the driver / a separate supply with common ground.
- Camera ESP32 firmware: not in the repo yet; put it in `firmware/seaguardian_camera/` when it exists.

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
| Motor driver (DC propulsion) | | | PWM + direction |
| Rudder servo | | | PWM (servo signal) |
| GPS RX/TX | | | UART |

## Folders
- `firmware/` - ESP32 code. Commit only code that has run on hardware; note the board and result below.
- `wiring/` - wiring diagram or breadboard photo.

## Test log (what was actually run)
| Date/time | What | Board | Result | Photo/video |
|---|---|---|---|---|
| 13 Nov | Camera firmware `seasafe_cam`: flash, join iPhone hotspot, stream to `vision/viewer.py` | XIAO ESP32S3 Sense (OV3660) | Works: 26.7 fps from the board, 20-26 fps with YOLO26n on a MacBook Air, person detected | Annotated frame in the project chat |
