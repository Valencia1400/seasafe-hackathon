# SeaGuardian - Groups, Interfaces and AI Prompts

**Concept:** SeaGuardian - a supervised harbour-safety inspection demonstrator (small catamaran USV). Raspberry Pi runs the mission and dashboard; ESP32 reads sensors and owns low-level motor safety. Interchangeable sensor bay. **Navigation is a simulated supervised inspection mission** - no real autonomy, GPS or obstacle avoidance this weekend.

**Rules for everyone:** dry bench tests only (no props on motors, nothing in water). Anything simulated is labelled "SIMULATED" on screen and in the pitch. No invented numbers. Log AI use in your own `docs/ai-log/<name>.md`.

## 1. Groups

| Group | People | Owns (folder) | Main judging criteria |
|---|---|---|---|
| **CAD** | C1 - CAD lead | Vessel CAD, sensor bay, electronics box, printable part (`cad/`) | Feasibility, technical quality |
| **Electronics** | E1 - electronics lead (electrical engineer) | ESP32 firmware, wiring, sensors, motor-stop logic (`electronics/`) | Technical quality, feasibility |
| | E2 - electronics + verification | Wiring help, sensor checks, **test matrix and repeated tests** (`tests/`) | Technical quality |
| **Software** | S1 - Angelo, product lead + integration | Pi mission controller, serial bridge, integration, **mentor validation** (`dashboard/`) | Problem, user value, relevance |
| | S2 - software + story | Dashboard UI, ESP32 simulator, **user scenario, AI log curation, pitch** (`dashboard/`, `presentation/`) | User value, presentation, innovation |

Put real names here: C1 = ____, E1 = ____, E2 = ____, S1 = Angelo, S2 = ____.

**Pairs that must talk often:** C1 <-> E1 (component dimensions, box layout), E1 <-> S1 (serial protocol), S2 <-> E2 (test evidence feeds the pitch).

## 2. Interfaces - freeze these first (Friday, within the first hour)
These let Software and Electronics work in parallel without waiting for each other.

### 2.1 Pi <-> ESP32 serial protocol (proposal - E1 and S1 confirm or change, then do not change without telling each other)
- Link: USB serial, 115200 baud, one JSON object per line (`\n`).
- **ESP32 -> Pi**
  - `{"t":"imu","roll":12.3,"pitch":-1.8,"ms":123456}` - about 10 per second
  - `{"t":"env","pressure_hpa":1012.4,"ms":...}` - about 1 per second (only if a pressure sensor is fitted)
  - `{"t":"leak","wet":false,"ms":...}` - on change and every 1 s
  - `{"t":"state","motor_l":0.0,"motor_r":0.0,"mode":"RUN|STOP|ESTOP","reason":"","ms":...}` - every 1 s and on change
  - `{"t":"event","name":"TILT_ALARM|LEAK|COMMS_TIMEOUT|ESTOP","ms":...}`
- **Pi -> ESP32**
  - `{"cmd":"hb"}` - heartbeat every 200 ms
  - `{"cmd":"motor","l":0.3,"r":0.3}` - range -1.0..1.0
  - `{"cmd":"estop"}` / `{"cmd":"reset"}`
- **Safety rules owned by the ESP32 (not the Pi):**
  - No heartbeat for **1000 ms** -> motors 0, mode STOP, event COMMS_TIMEOUT.
  - `estop` or physical E-stop button -> motors 0, mode ESTOP until `reset`.
  - Leak detected -> motors 0, event LEAK.
  - Tilt beyond configured limit (e.g. 30 deg, a placeholder - choose and justify) -> event TILT_ALARM.

### 2.2 Component envelope (E1 -> C1, Friday morning)
| Part | Model | L x W x H (mm) | Mass (g) | Mounting/connector notes |
|---|---|---|---|---|
| Raspberry Pi | | | | |
| ESP32 board | | | | |
| IMU | | | | |
| Pressure sensor | | | | |
| Leak sensor | | | | |
| Motor driver | | | | |
| Motors x2 | | | | |
| Battery / power | | | | |

## 3. Friday / Saturday Definition of Done per group
| Group | Friday | Saturday (before freeze) |
|---|---|---|
| CAD | Envelope received; first editable assembly (2 hulls, deck, electronics box, motor mounts, sensor bay); one small part sliced (< 3 h print) | Reviewed v2 with one documented fix; printed part (e.g. swappable sensor-bay module or box lid); exploded view + screenshots |
| Electronics | IMU readings over serial; protocol implemented; motor outputs driven (LED or motor without prop) | Heartbeat timeout + E-stop + leak stop verified **5x each** with recorded results; wiring diagram |
| Software | Simulator sends protocol messages; dashboard shows live (simulated) data; mission "start" works | Real ESP32 connected; mission flow, event log, fault display; repeatable 60-90 s demo; backup recording |

## 4. AI prompts (copy-paste)

### 4.0 Shared context - paste this FIRST in every new AI chat
```
Context: We are a 5-person team at a weekend hackathon (Saab x Marine Technology Center, "Prompt-to-Product").
The jury judges the path: how we used AI, how we validated, problems we hit and how we fixed them.
Our concept: SeaGuardian, a supervised harbour-safety inspection demonstrator - a small catamaran
unmanned surface vehicle. A Raspberry Pi runs the mission logic and an operator dashboard; an ESP32
reads sensors (IMU, pressure, leak) and owns low-level motor safety (heartbeat timeout, emergency stop,
leak stop). It has an interchangeable sensor bay. Navigation is a SIMULATED supervised inspection mission;
we are not building real autonomy, GPS navigation or obstacle avoidance.
We test on a dry bench only. We must not invent numbers or claim anything works until we have tested it.
Constraints: ~2 days, beginner-friendly where possible, 3D printer available, everything must be demo-able.
When you are unsure, ask me a question or state your assumption explicitly instead of guessing.
```

### 4.1 CAD group (C1)
**Prompt C-1 - architecture and parameters**
```
I am the CAD lead. Help me plan a parametric CAD assembly for the SeaGuardian catamaran demonstrator in [Fusion 360 / Onshape / FreeCAD / OpenSCAD - pick one].
Parts: two hulls, deck/bridge, sealed electronics box (Raspberry Pi, ESP32, motor driver, battery), two motor mounts, and an interchangeable sensor bay that slides or clips in.
Component sizes: [paste table 2.2].
Give me: (1) a list of driving parameters with sensible starting values and why, (2) the part tree and how parts attach,
(3) which single part to print first that proves modularity in under 3 hours, (4) a checklist of geometry checks
(clearances, wall thickness, cable routing, printability, centre of mass vs. buoyancy). Mark every value as an assumption.
```
**Prompt C-2 - review my design (use after each version)**
```
Here are screenshots/dimensions of my SeaGuardian CAD v[N]: [paste]. Review it as a critical mechanical engineer.
List concrete problems ranked by severity (fit, printability, sealing, cable routing, stability, assembly order).
For each: what to measure to confirm it, and the smallest fix. Do not say it is fine unless you can explain why.
```
**Prompt C-3 - rough flotation estimate**
```
Estimate whether this catamaran floats and how deep: hull dimensions [..], total estimated mass [..] g.
Show the calculation step by step (displaced volume, draft, rough stability) so I can check it by hand.
List the assumptions and what physical test would confirm it. Label it as an estimate.
```

### 4.2 Electronics group (E1, E2)
**Prompt E-1 - architecture and wiring (E1)**
```
I am the electronics lead. Parts we actually have: [ESP32 board model, IMU model, pressure sensor model, leak sensor, motor driver model, motors, battery, Raspberry Pi model].
Design the wiring: pin assignment table, power distribution (separate motor supply from logic, common ground), voltage levels,
and what can damage what. Then list a safe bring-up order, testing one part at a time. Flag anything that needs a component we do not have.
```
**Prompt E-2 - ESP32 firmware with safety logic (E1)**
```
Write ESP32 firmware (Arduino framework) for SeaGuardian. Use this serial protocol exactly: [paste section 2.1].
Requirements: non-blocking loop (no delay() in the main loop), IMU at ~10 Hz, heartbeat watchdog that sets both motor outputs to 0 after 1000 ms
without {"cmd":"hb"}, E-stop button input and {"cmd":"estop"} latch until {"cmd":"reset"}, leak input forces motors to 0, motors default to 0 at boot.
Explain each safety path, list what you could NOT verify without hardware, and give me a bench test for each safety rule.
```
**Prompt E-3 - verification matrix (E2)**
```
I am new to electronics and own the test evidence. Our safety requirements are: [paste the safety rules from 2.1].
Make a test matrix: test ID, requirement, exact steps a beginner can follow on a dry bench, what to observe (LED, multimeter, serial message),
expected result, and a table to record 5 repeated trials with pass/fail. Also explain in simple words what each test proves and what it does NOT prove.
```
**Prompt E-4 - explain to me (E2)**
```
Explain how [IMU / I2C / PWM motor control / a watchdog timeout] works in simple words, using our SeaGuardian setup as the example.
Then give me 3 questions I can ask E1 to check that I understood correctly.
```

### 4.3 Software group (S1, S2)
**Prompt S-1 - Pi mission controller and serial bridge (S1)**
```
Write a Python 3 program for the Raspberry Pi for SeaGuardian. It talks to the ESP32 over USB serial using this protocol: [paste 2.1].
It must: send {"cmd":"hb"} every 200 ms, parse incoming JSON lines robustly (ignore bad lines, log them), keep the latest state,
run a SIMULATED inspection mission (states: IDLE -> TRANSIT -> INSPECTING -> RETURNING -> DONE, with a fake position along a route),
stop the mission and command motors 0 on any fault event, and expose state + an event log to a web dashboard.
Use only pyserial plus one small web framework. Include a flag to run against a simulator instead of real hardware. Keep it in few files.
```
**Prompt S-2 - ESP32 simulator (S2)**
```
Write a small Python simulator that pretends to be the SeaGuardian ESP32, speaking this protocol: [paste 2.1].
It should emit realistic-looking IMU, pressure and leak messages, and let me trigger faults from the keyboard: tilt, leak, stop sending heartbeats responses, E-stop.
It must implement the same safety rules as the real ESP32 (1000 ms heartbeat timeout -> motors 0) so we can test the Pi software without hardware.
Every message must make clear it is simulated.
```
**Prompt S-3 - operator dashboard (S2)**
```
Build a single-page operator dashboard for SeaGuardian served by the Pi program. Show: mission state and a Start/Abort button,
a simple map-like view of the SIMULATED route and position, live roll/pitch, pressure, leak status, motor outputs, link status (OK / TIMEOUT),
a red fault banner, and a timestamped event log. Big readable text for a stage demo. No external CDNs (the venue Wi-Fi may fail).
Label simulated data with a visible "SIMULATED" tag.
```
**Prompt S-4 - integration test plan (S1)**
```
Here are our components: Pi program, ESP32 firmware, dashboard, simulator. Write an integration test plan for the demo sequence:
start mission -> sensors report -> abnormal tilt detected -> communication loss -> ESP32 stops motors. For each step: how to trigger it,
what the operator should see, how to record evidence, and what to do if it fails on stage (fallback).
```
**Prompt S-5 - problem validation and pitch (S1 + S2)**
```
We want to validate whether post-storm harbour inspection is a real problem. Help me prepare a 5-minute interview with a Saab/MTC mentor:
5 open questions, what to listen for, and how to record the answers accurately. After I paste the answers, help me rewrite our problem
statement and target user ONLY from what they said, and list which claims we still cannot support.
```

## 5. How to log a prompt you used
After using a prompt, add an entry to `docs/ai-log/<your-name>.md`: prompt, what the AI produced, **what you checked and how**, errors found, what you changed. The best entries go into `docs/ai-process.md` (S1 + S2 curate).
