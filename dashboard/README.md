# SeaGuardian operator dashboard (laptop) - Owner: Person 3

A local web dashboard for the SeaGuardian harbour-inspection demonstrator. It runs **without any hardware**: the control ESP32 is simulated. Pure Python standard library, no internet, no installs.

```bash
python run_operator.py
```
Open http://127.0.0.1:8000. Press **Esc** anywhere on the page for an emergency stop. Tests: `python -m unittest discover -s tests -v`.

**Simulation only.** What the dashboard shows is simulated and labelled SIMULATED. It demonstrates intended logic; it is **not** evidence of physical safety. The real control ESP32 must enforce motor safety independently, and the laptop is never the only safety mechanism.

## Implemented, simulated or future

| Capability | Status |
|---|---|
| Mission state machine READY/RUNNING/STOPPED/FAULT, Start/Stop/E-STOP/Reset, event log | Implemented |
| Simulated control ESP32: IMU (roll, pitch, yaw rate), GPS position + fix, DC motor throttle, rear rudder | Simulated |
| Scenarios: normal mission, tilt, comms loss (1.0 s timeout), E-STOP, steering, leak, GPS fix lost | Simulated |
| Camera view: annotated stream + detections from `vision/viewer.py` (`--camera-viewer`) | Implemented and tested with mocks; not yet run against the real viewer. Without a viewer address a placeholder is shown; webcam/file input is labelled TEST |
| Provisional limits (rudder, throttle) and IMU mounting: `opsdash/config.py` or `--config file.json` | Implemented; values are placeholders, shown as UNCONFIRMED |
| Message format | Follows the PROPOSED protocol in `docs/architecture.md`; not agreed with Person 2, not in firmware |
| Real control ESP32: live 3D attitude from the MPU6050, motor control (arm, hold-to-drive, speed limit), servo control, E-STOP forwarded | Implemented in `opsdash/boatlink.py`; tested with a stand-in ESP32 over real sockets, **not yet with the real board** |
| Mission, GPS track and leak driven by the real ESP32 | **Future**: those panels still show the simulation |
| PID steering | Not implemented (optional stretch) |

## Run the complete demo
Simulated control ESP32 (always) + optional camera. Python 3.9+, from the repository root:

```bash
# 1. (optional) camera + YOLO detector: see vision/README.md. Only viewer.py opens the ESP32 stream.
cd vision && python viewer.py --source http://<camera-ip>:81/stream      # or: --source 0 for a laptop webcam test

# 2. the dashboard (new terminal)
cd dashboard
python run_operator.py --camera-viewer http://127.0.0.1:8001            # omit the flag to run without a camera
```
Open http://127.0.0.1:8000. If the viewer runs on another laptop, start it with `--host 0.0.0.0` (same trusted network only: it has no login) and give the dashboard that laptop's address, e.g. `--camera-viewer http://192.168.1.20:8001`. The video is loaded by your browser, so the browser must be able to reach the viewer.

## Real boat ESP32 (motors, servo, gyroscope)
Firmware: `electronics/firmware/seaguardian_revC` (pinout and flashing steps in its README). The ESP32 dials **out** to the laptop, so the dashboard must listen on the network:

```bash
python run_operator.py --host 0.0.0.0 --camera-viewer http://127.0.0.1:8001
```
It prints the address to put in the firmware's `secrets.h` (`WS_HOST`). Laptop and ESP32 must be on the same 2.4 GHz Wi-Fi, and the network must let devices talk to each other (some guest networks block this; a phone hotspot does not).

- **Boat attitude, live 3D:** the model follows roll, pitch and yaw from the MPU6050 ten times a second. If it tilts the wrong way for how the sensor is mounted, tick *Invert roll / pitch / yaw* (remembered in the browser) or set the `imu_*` values in the config. Yaw is integrated gyro: it drifts.
- **Motor control:** *Arm motors*, then hold the arrow buttons or W A S D / arrow keys. Releasing, switching tab or closing the page stops the motors; the page's keep-alive stops when no browser is open, so the firmware's 1 s watchdog then stops the boat on its own.
- **Servo:** slider 0-180 degrees on GPIO18.
- **E-STOP** (button or Esc) also latches the real boat's emergency stop; *Reset* releases it, and the motors stay disarmed until *Arm* is pressed again.
- `--host 0.0.0.0` has no login: anyone on the same Wi-Fi can open the page and drive. Use it on a network you trust.
- Try it without hardware: `python tests/test_opsdash_boatlink.py 127.0.0.1 8000` connects a clearly labelled fake ESP32 with moving attitude.

## Camera panel
- **Video:** the viewer's annotated `/stream.mjpg`, shown by the browser. The dashboard never opens the ESP32 stream (it serves one client only).
- **Detections:** the dashboard server polls `/detections` about 2.5 times per second on its own thread, validates every field and shows only fresh data. YOLO runs in the viewer, never here.
- **REAL CAMERA vs TEST INPUT:** `src == esp32` is labelled REAL CAMERA (the video source, not proof a detection is right); `webcam` or `file` is a prominent TEST INPUT banner.
- **Failure states, camera only (motor control is unaffected):** CAMERA DOWN, viewer not reachable, unreadable response, and FROZEN (the frame sequence number stopped moving for 2 s, so old detections are not shown as live). Detections are cleared whenever the data is not current. Reconnects need no dashboard restart.
- **Wording:** "Person detected", "Vessel detected", "Bird detected", "Board detected", "Bottle detected", always as "Potential object detected - operator review required". A detected person is not necessarily a person in the water; a bottle is not proof of debris; confidence is the model's score, not verified accuracy. This is object detection, not an assessment of harbour damage.
- **No control link:** detections never change the mission, motor or rudder. Camera events are warnings in the event log, never faults.
- Not shown yet: the ESP32 `/status` endpoint (Wi-Fi signal etc.) is not polled.

## What has been tested
| Test | What it shows | How |
|---|---|---|
| T1 dashboard starts, serves page + state | Passes | Mock viewer over real HTTP (simulated) |
| T2 stream URL and detections reach the page state | Passes | Mock viewer (simulated); browser rendering checked by hand against a stand-in viewer |
| T3 detection JSON parsed (sample from `vision/INTEGRATION.md`) | Passes | Mock data |
| T4 labels for person/boat/bird/surfboard/bottle, unknown classes | Passes | Mock data |
| T5 TEST INPUT vs REAL CAMERA | Passes | Mock data |
| T6 camera DOWN (fields missing) | Passes | Mock data |
| T7 malformed, missing, unreachable, non-JSON responses | Passes, never raises | Mock data |
| T8 stale / frozen sequence | Passes | Fake clock |
| T9 mission works with no viewer and with a dead viewer; camera never affects motor | Passes | Simulation |
| T10 motor-safety simulation (E-STOP, comms loss, reset rules) | Passes | Simulation (`test_opsdash_scenarios.py`) |

**Not physically verified by this dashboard:** the real `viewer.py` with real YOLO, the real ESP32 camera and the LAN/hotspot path were never run against this dashboard (only against mocks and a stand-in). The camera developer has measured the camera and viewer separately (see `vision/INTEGRATION.md`, section 6).

## Configuration
Every hardware-dependent number lives in `opsdash/config.py`. Override with a JSON file:
```bash
python run_operator.py --config my_config.json     # {"rudder_limit_deg": 25, "imu_yaw_sign": -1}
```
Unknown keys and invalid values are rejected. Do not treat the defaults as specifications: confirm rudder travel, throttle and IMU mounting with the CAD developer and the electrical engineer.

## Files
| File | What it is |
|---|---|
| `run_operator.py` | Starts the dashboard (`--config`, `--camera-viewer`, `--http-port`) |
| `opsdash/mission.py` | Mission state machine and its transition rules |
| `opsdash/simulator.py` | Simulated control ESP32 with its own safety rules |
| `opsdash/protocol.py` | Message format (proposed) and timing constants |
| `opsdash/console.py` | Ties mission, simulator and scenarios together; no web code |
| `opsdash/boatlink.py` | WebSocket link to the real control ESP32 (standard library only): telemetry in, commands and keep-alive out |
| `opsdash/camera.py` | Polls and validates the viewer's `/detections` (stale/malformed handling, labels, events) |
| `opsdash/config.py` | Provisional limits, IMU mounting, camera address |
| `opsdash/server.py`, `opsdash/static/index.html` | Local web server and the page |
| `tests/` | Unit and scenario tests (simulation logic only) |
