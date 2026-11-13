# SeaGuardian operator dashboard (laptop) - Owner: Person 3

A local web dashboard for the SeaGuardian harbour-inspection demonstrator. It runs **without any hardware**: the control ESP32 is simulated. Pure Python standard library, no internet, no installs.

```bash
python run_operator.py
```
Open http://127.0.0.1:8000. Tests: `python -m unittest discover -s tests -v`.

**Simulation only.** What the dashboard shows is simulated and labelled SIMULATED. It demonstrates intended logic; it is **not** evidence of physical safety. The real control ESP32 must enforce motor safety independently, and the laptop is never the only safety mechanism.

## Implemented, simulated or future

| Capability | Status |
|---|---|
| Mission state machine READY/RUNNING/STOPPED/FAULT, Start/Stop/E-STOP/Reset, event log | Implemented |
| Simulated control ESP32: IMU (roll, pitch, yaw rate), GPS position + fix, DC motor throttle, rear rudder | Simulated |
| Scenarios: normal mission, tilt, comms loss (1.0 s timeout), E-STOP, steering, leak, GPS fix lost | Simulated |
| Camera view: annotated stream + detections from `vision/viewer.py` (`--camera-viewer`) | Implemented; without a viewer address a placeholder is shown. Input from webcam/file is labelled TEST |
| Provisional limits (rudder, throttle) and IMU mounting: `opsdash/config.py` or `--config file.json` | Implemented; values are placeholders, shown as UNCONFIRMED |
| Message format | Follows the PROPOSED protocol in `docs/architecture.md`; not agreed with Person 2, not in firmware |
| Hardware mode (real ESP32 data and commands) | **Future**: needs the agreed protocol and tested equipment |
| PID steering | Not implemented (optional stretch) |

## Camera
1. Start the detector (see `vision/README.md`), e.g. `python viewer.py --source 0` for a laptop webcam test.
2. Start the dashboard with the viewer address:
```bash
python run_operator.py --camera-viewer http://127.0.0.1:8001
```
The panel shows the annotated video, detections, and one status line: boat camera / TEST INPUT / CAMERA DOWN / viewer not reachable / PERSON DETECTED. The camera is not part of the safety chain. Detections are shown on screen only (not written to the event log yet).
Not yet tested against the real `viewer.py` or the real camera (only against a stand-in that follows `vision/INTEGRATION.md`).

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
| `opsdash/config.py` | Provisional limits, IMU mounting, camera address |
| `opsdash/server.py`, `opsdash/static/index.html` | Local web server and the page |
| `tests/` | Unit and scenario tests (simulation logic only) |
