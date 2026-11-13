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
(Fill in once it works: exact commands, Python version, what was verified.)
