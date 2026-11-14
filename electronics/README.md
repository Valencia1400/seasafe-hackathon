# Electronics

Current architecture: [system overview](../docs/architecture.md). Before merging another firmware package, read [pending reconciliation](../docs/integration-status.md).

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


## Camera firmware: `firmware/seasafe_cam/seasafe_cam.ino`
Seeed XIAO ESP32S3 Sense: MJPEG stream + JSON status over Wi-Fi, for the detector in `vision/`. Board `XIAO_ESP32S3`, PSRAM `OPI PSRAM`. Joins the team hotspot `Armin – iPhone` by default; other networks go in `secrets.h` (copy `secrets.example.h`, git-ignored). How to flash and run: [vision/README.md](../vision/README.md); endpoints: [vision/INTEGRATION.md](../vision/INTEGRATION.md).


## Historical implementation

The earlier serial sketch is retained under [legacy/](legacy/README.md), not used by the current dashboard.

## Test log (what was actually run)
| Date/time | What | Board | Result | Photo/video |
|---|---|---|---|---|
| 13 Nov | Camera firmware `seasafe_cam`: flash, join iPhone hotspot, stream to `vision/viewer.py` | XIAO ESP32S3 Sense (OV3660) | Works: 26.7 fps from the board, 20-26 fps with YOLO26n on a MacBook Air, person detected | Annotated frame in the project chat |

Hardware reports above are repository-reported results. Heritage reports a different connection outcome; identify the exact board/build before treating either report as the final integration result.
