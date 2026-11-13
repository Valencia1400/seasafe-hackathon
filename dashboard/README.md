# Mission software + dashboard (Raspberry Pi) - Owner: Person 3

Protocol: [docs/architecture.md](../docs/architecture.md). Requirements R4, R5, R6, R10.

## What it does
1. Talks to the ESP32 over USB serial (JSON lines): sends a heartbeat every 200 ms, motor commands, e-stop and reset.
2. Runs a **simulated supervised inspection mission**: Start -> Transit -> Inspect -> Report -> Return. The vessel position on screen is simulated and labelled as such.
3. Shows live readings (roll, pitch, pressure in hPa, leak, motor output, state), an event log and fault banners (TILT, LEAK, ESTOP, COMMLOST).
4. Operator buttons: Start mission, E-STOP, Reset, and "Cut link" (stops sending heartbeats, for the comms-loss demo).
5. Writes every message and event to a log file with timestamps (evidence for tests).

## Build order
1. Simulator that produces ESP32-style telemetry -> dashboard shows it, labelled SIMULATED.
2. Real serial connection to the ESP32.
3. Mission states and event log.
4. Fault banners and operator buttons.

## Rules
- The demo must work from a laptop without internet.
- Never show invented data as real: simulated values are always labelled.

## Run instructions
Python 3.9+ (tested with 3.13 on Windows). From this folder:

```bash
python run.py --sim
```
Open http://127.0.0.1:8000. Simulator mode shows a yellow **SIMULATOR / SIMULATED** tag and extra buttons to inject a tilt or a leak.

With the real ESP32 (needs `pip install -r requirements.txt` once):
```bash
python run.py --port COM5
```
On the Raspberry Pi the port is usually `/dev/ttyUSB0` or `/dev/ttyACM0`. Add `--host 0.0.0.0` to open the dashboard from a laptop on the same network.

Every message and event is written to `logs/session-<date>-<time>.jsonl` (ignored by git). Copy the log of a test run to `tests/evidence/` when it is evidence.

Unit tests (simulator safety rules + Pi logic, no hardware):
```bash
python -m unittest discover -s tests -v
```

## Files
| File | What it is |
|---|---|
| `run.py` | Starts everything (`--sim` or `--port`) |
| `seaguardian/protocol.py` | Message format and timing constants |
| `seaguardian/controller.py` | Heartbeat, simulated mission, fault handling, event log |
| `seaguardian/sim_esp32.py` | Simulated ESP32 with the same safety rules as the firmware |
| `seaguardian/app.py` | Serial/simulator link and the small web server |
| `static/index.html` | The operator dashboard (no internet needed) |
| `tests/` | Unit tests |

## What has been verified (Fri 13 Nov)
- 14 unit tests pass (simulator safety rules, mission, e-stop, comms loss, leak, tilt, bad input).
- Simulator run through the API: mission started, motors 0.4/0.4, tilt warning at 38 deg, link cut -> ESP32 COMMLOST and motors 0 after 842 ms (Pi clock), reset back to OK.
- **Not verified:** the real ESP32 over serial, the dashboard on the Raspberry Pi, the page's look on the stage screen.

## Note on the comms-loss timing
The 1.0 s timeout counts from the **last heartbeat**, which is sent every 200 ms. So the stop comes 0.8-1.05 s after the link is cut, not exactly 1.0 s. (Found by our own unit test - a good "problem we hit" for the AI log.)
