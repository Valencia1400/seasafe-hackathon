# Requirements

> Section 1 is our notes from the opening talk, not official text - correct it against any written brief. Section 2 is our own provisional requirements for SeaGuardian; targets are engineering targets, not verified claims.

## 1. Brief and judging criteria (Fri 13 Nov - Owner: Person 3)
Presenters: Saab Naval and Marine Technology Center (MTC) - Dr Per Skarin, Jakob Nielsen, Björn Lindkvist.

| Item | What they said (our notes) | Impact on our plan |
|---|---|---|
| Challenge | Prompt-to-Product: use modern AI and show how far you can get. Set your own requirements and take a concept as far as possible. Surface, below surface or "in a box". | We justify our own problem and requirements |
| What they evaluate | The path, not only the result: steps, validation, problems and how we solved them, tools. Why we chose the concept. Sensors/technologies used. How the team uses its competencies. | Log decisions, problems and AI use continuously |
| Pitch must end with | What we could do with more time, research, money or a test environment | Running list in presentation/pitch-outline.md |
| Physical prototype | Not expected, but welcome | CAD + bench demo is the core; a printed part is a bonus |
| MTC core areas | Signature management; naval architecture; energy and propulsion; structures and materials; safety and rescue; sensor and weapons integration; automation and autonomy; lately combat systems (integrating all sensors on a vessel) | SeaGuardian lands in sensor integration, autonomy and safety |
| Collaboration | They may continue the work with teams afterwards | Pitch a credible next phase |
| Presentation time limit | **Ask** | |
| Submission format and deadline | Jury Room (Campor) - **confirm** | |
| Equipment available | **Ask** (printers, boards) | |

### Jury rubric (as given to us)
| Criterion | Weight | What we must show |
|---|---|---|
| Problem understanding | 20% | Specific operator, real inspection problem, evidence from a mentor or credible source |
| User value | 20% | A concrete inspection scenario and the information the operator actually gets |
| Feasibility | 15% | CAD, component architecture, risks, costs, realistic next step |
| Technical quality | 15% | Working laptop/ESP32 link, real or simulated sensor data, tested safety response |
| Innovation | 10% | Modular inspection payload plus fault-aware supervised autonomy |
| Presentation | 10% | Clear 60-90 s demo, tested results, honest limitations |
| Partner relevance | 10% | Connection to Saab's sensor integration, autonomy and safety |

## 2. Product requirements (provisional v1)
Priority: **M** must, **S** should, **C** could. Every target is checked by the test with the same number in [tests/test-plan.md](../tests/test-plan.md).

| ID | Requirement | Measurable target | Pri | Owner | Status |
|---|---|---|---|---|---|
| R1 | Problem validated | A Saab/MTC mentor's answer to our problem question recorded word for word | M | P3 | Not tested |
| R2 | CAD assembly | Editable parametric model: 2 hulls, sealed electronics bay, 1 propeller mount (DC motor), rear rudder with servo mount, camera mount, swappable sensor bay; exploded view exported | M | P1 | Not tested |
| R3 | Components fit | Every listed component fits its space in CAD with >= 3 mm clearance (provisional) | M | P1/P2 | Not tested |
| R4 | Laptop <-> control ESP32 link | Telemetry at >= 5 Hz; >= 99% of messages received over a 5-minute run (sequence-number check) | M | P2/P3 | Not tested |
| R5 | Sensor readings | IMU roll/pitch and atmospheric pressure shown on the dashboard, correctly labelled with units, updating at least once per second | M | P2/P3 | Not tested |
| R6 | Tilt warning | Tilting the IMU beyond 30 deg raises a TILT warning on the dashboard within 1 s, 5 of 5 trials | M | P2/P3 | Not tested |
| R7 | Leak fault | Leak input (sensor or labelled test input) raises a LEAK fault and stops motors within 1 s, 5 of 5 | S | P2 | Not tested |
| R8 | Emergency stop | Operator e-stop -> ESP32 motor output 0 within 200 ms, 5 of 5 | M | P2 | Not tested |
| R9 | Comms-loss stop | No heartbeat for 1.0 s -> ESP32 motor output 0 within a further 200 ms, 5 of 5; motors stay off until the operator resets | M | P2 | Not tested |
| R10 | Mission dashboard | Start a simulated inspection mission, show live readings, event log and faults; full demo sequence runs 5 of 5 without a restart | M | P3 | Not tested |
| R11 | Design iteration | One AI-assisted design or code mistake found by test or review, corrected, and retested - documented | M | P5/P4 | Not tested |
| R12 | Swappable sensor bay | (If printed) payload module removed and replaced in < 60 s without tools | C | P1/P4 | Not tested |
| R13 | GPS position | Latitude/longitude shown on the dashboard when the receiver has a fix; "no fix" shown otherwise (provisional) | S | P2/P3 | Not tested |
| R14 | Camera feed | Live video from the camera ESP32 visible on the laptop (provisional) | S | P2/P3 | Not tested |
| R15 | Rudder steering | Operator rudder command moves the servo to the commanded side; centred on a safety stop (provisional) | S | P2 | Not tested |
| R16 | P controller (stretch) | Rudder correction proportional to IMU yaw rate, shown on the bench; PID only if time allows | C | P2/P3 | Not tested |

## 3. Explicit non-goals
- No real autonomy, obstacle avoidance, GPS waypoint navigation or water trials this weekend; the mission is **simulated and supervised**. GPS is used to show position only.
- No automatic roll/pitch correction (the rudder steers yaw only). No voice control.
- Not certified; no claim of compliance with maritime or naval standards. Autonomous vessel trials must still follow applicable maritime rules.
- No invented statistics, costs, military requirements or test outcomes. No cost-saving claims without a comparison.

## 4. Open questions
- Presentation time limit, submission format and freeze/deadline times.
- Which boards and sensors are available (camera ESP32 board, control ESP32 board, IMU, GPS receiver, pressure sensor, leak sensor, motor driver, servo).
