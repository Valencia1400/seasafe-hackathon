# SeaGuardian operator dashboard (laptop)

A local web page plus a WebSocket server for the boat's control ESP32. Pure Python standard library, no installs. **Nothing is simulated:** every value comes from the real ESP32 or the camera, and without them the page says "not connected".

```bash
python run_operator.py                                           # page + WebSocket server on port 8000
python run_operator.py --camera-viewer http://127.0.0.1:8001     # with the camera (start vision/viewer.py first)
```
Open http://127.0.0.1:8000. Press **Esc** anywhere on the page for an emergency stop. Tests: `python -m unittest discover -s tests -v`.

## How the boat connects
The control ESP32 (firmware `electronics/firmware/seaguardian_revC`) is a WebSocket **client**. It dials `ws://<laptop address>:8000/ws`, sends a JSON telemetry frame ten times a second and accepts JSON commands. At start-up the dashboard prints the three values the firmware needs:

```
Boat ESP32 WebSocket server: ws://172.16.55.105:8000/ws   (firmware: WS_HOST "172.16.55.105", WS_PORT 8000, WS_PATH "/ws")
```
`WS_HOST` goes in the firmware's `Main/secrets.h`; `WS_PORT` and `WS_PATH` are in `Config.h` and already match. Laptop and ESP32 must be on the same 2.4 GHz Wi-Fi, and the network must let devices talk to each other. If the laptop's address changes, update `WS_HOST` and upload again.

## What is on the page
- **Safety:** link state, emergency stop (button or Esc, latched on the ESP32), command watchdog, armed state. *Release emergency stop* leaves the motors disarmed until *Arm* is pressed again.
- **Motor control:** *Arm motors*, then hold the arrow buttons or W A S D / arrow keys. Releasing, switching tab or closing the page stops the motors. The keep-alive is only sent while a browser has the page open, so the firmware's 1 s watchdog stops the boat if the laptop goes away.
- **Servo:** slider 0-180 degrees (GPIO18).
- **Boat attitude, live 3D:** follows roll, pitch and yaw from the MPU6050. If it tilts the wrong way for how the sensor is mounted, tick *Invert roll / pitch / yaw* (remembered in the browser) or set `imu_*` in a config file. Yaw is integrated gyro and drifts; *Zero gyro* recalibrates.
- **Position:** latitude, longitude, speed and track from the NEO-6M once it has a fix.
- **Event log:** connections, arming, emergency stops, watchdog stops, tilt warnings, rejected commands.

The page has no login and listens on the whole network: anyone on the same Wi-Fi can open it and drive. Use a network you trust, or `--host 127.0.0.1` when no boat is needed.

Without hardware, `python tests/test_opsdash_boatlink.py 127.0.0.1 8000` connects a stand-in ESP32 (firmware name `FAKE-not-hardware`) so the page can be tried. It is a test tool, not part of the dashboard.

## Camera panel
- **Video:** the viewer's annotated `/stream.mjpg`, shown by the browser. The dashboard never opens the ESP32 stream (it serves one client only).
- **Detections:** the dashboard server polls `/detections` about 2.5 times per second on its own thread, validates every field and shows only fresh data. YOLO runs in the viewer, never here.
- **REAL CAMERA vs TEST INPUT:** `src == esp32` is labelled REAL CAMERA (the video source, not proof a detection is right); `webcam` or `file` is a prominent TEST INPUT banner.
- **Failure states, camera only (motor control is unaffected):** CAMERA DOWN, viewer not reachable, unreadable response, and FROZEN (the frame sequence number stopped moving for 2 s, so old detections are not shown as live). Detections are cleared whenever the data is not current. Reconnects need no dashboard restart.
- **Wording:** "Person detected", "Vessel detected", "Bird detected", "Board detected", "Bottle detected", always as "Potential object detected - operator review required". A detected person is not necessarily a person in the water; a bottle is not proof of debris; confidence is the model's score, not verified accuracy. This is object detection, not an assessment of harbour damage.
- **No control link:** detections never change the motors or the servo. Camera events are warnings in the event log.
- Not shown yet: the ESP32 `/status` endpoint (Wi-Fi signal etc.) is not polled.

## What has been tested
| What | How | Result |
|---|---|---|
| WebSocket server, telemetry, commands, keep-alive, emergency stop, state-change log | `tests/test_opsdash_boatlink.py`, stand-in ESP32 over real sockets | Passes |
| Camera panel states and labels | `tests/test_opsdash_camera.py`, mock viewer | Passes |
| Real ESP32 DevKit + MPU6050 on Wi-Fi: connects, live attitude on the page | By hand, 14 Nov | Works |
| Motors and servo moving from the page | - | **Not yet tested on the bench** |

## Configuration
```bash
python run_operator.py --config my_config.json     # {"tilt_warning_deg": 25, "imu_pitch_sign": -1}
```
Keys: `tilt_warning_deg`, `imu_roll_sign`, `imu_pitch_sign`, `imu_yaw_sign`, `imu_swap_roll_pitch`, `camera_viewer_url`.

## Files
| File | What it is |
|---|---|
| `run_operator.py` | Starts the dashboard (`--host`, `--http-port`, `--config`, `--camera-viewer`) |
| `opsdash/server.py`, `opsdash/static/index.html` | Web server (page, API, `/ws`) and the page |
| `opsdash/boatlink.py` | WebSocket server side for the control ESP32: telemetry in, commands and keep-alive out |
| `opsdash/console.py` | Event log and warnings |
| `opsdash/camera.py` | Polls and validates the viewer's `/detections` |
| `opsdash/config.py` | Tilt limit, IMU mounting, camera address |
| `tests/` | Unit tests |
