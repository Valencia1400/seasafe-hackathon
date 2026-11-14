# Current architecture

This page describes the repository implementation at the documentation cleanup. Hardware test status is tracked separately in [test results](../tests/test-results.md); package differences are in [integration status](integration-status.md).

| Component | Input/output | Responsibility |
|---|---|---|
| Camera ESP32: XIAO ESP32S3 Sense | Wi-Fi video to laptop viewer | Image capture; no onboard YOLO |
| Laptop: `vision/viewer.py` | Camera stream → annotated stream and `/detections`, normally port 8001 | Object detection and camera processing |
| Laptop: `dashboard/run_operator.py` | HTTP interface and `/ws`, normally port 8000 | Operator controls, telemetry display and camera integration |
| Control ESP32 DevKit | WebSocket client → laptop server | Sensors, two motor outputs, rudder servo and safety logic |

The dashboard displays the viewer's output; it does not open a second connection to the camera's single-client MJPEG stream. Camera detections never command propulsion. The latest camera UDP option is implemented but its board test is still pending.

## Control protocol

The ESP32 initiates `ws://<laptop-LAN-IP>:8000/ws`. Credentials and host belong in ignored `Main/secrets.h`. JSON command and telemetry details are maintained in the [control firmware README](../electronics/firmware/seaguardian_revC/README.md), sections 7–9.

| Operation | JSON command |
|---|---|
| Arm | `{"cmd":"arm","value":true}` |
| Move | `{"cmd":"move","dir":"forward"}` |
| Stop | `{"cmd":"stop"}` |
| Emergency stop | `{"cmd":"estop"}` |
| Release emergency stop | `{"cmd":"estop_reset"}` |
| Heartbeat | `{"cmd":"ping"}` |
| Rudder neutral | `{"cmd":"servo_neutral"}` |

Telemetry contains `imu`, `gps`, `motors`, `servos`, `batt` and `sys`. Missing sensor values must remain unavailable/null. GPS reception is different from a valid position fix.

`move left/right` counter-rotates the motors; `drive.steer` mixes the motor outputs. Rudder commands are separate. The dashboard defaults to 90° ±6° servo travel, while firmware allows a wider range; actual safe mechanical limits await confirmation.

## Safety behaviour and limits

Arming is required for propulsion. Emergency stop latches and disarms; releasing it does not re-arm. The command watchdog stops motor outputs when commands cease; detected link loss also disarms. These are implemented behaviours requiring hardware verification, not guarantees of physical safety. Watchdog stop and emergency-stop reset rules are different.

Current GitHub firmware serializes motor output writes and reapplies safe outputs while emergency stop is latched. Heritage's supplied package lacks these integration changes; do not overwrite them during reconciliation.

The LAN server has no login. Use a trusted local network. A software stop cannot remove battery power or protect against every driver/wiring failure.

## Mechanical and sensing scope

Two hulls, central electronics, two rear submerged propellers providing horizontal thrust, and a rear rudder. This is a surface vessel, not an underwater ROV. Enclosure sealing and buoyancy remain unverified.

MPU6050 roll/pitch are gravity-referenced; integrated yaw drifts. GPS positioning does not establish autonomous navigation. The rudder does not stabilize roll/pitch. Pressure/leak sensing, PID and interchangeable-payload performance are not demonstrated current features. There is no Raspberry Pi or voice control.
