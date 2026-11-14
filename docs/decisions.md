# Decision history

One short entry per decision. Newest at the bottom. These are part of the "why we chose" story the jury asked for.

| ID | Date/time | Decision | Why | Alternatives | Decided by | Status |
|---|---|---|---|---|---|---|
| D-001 | Fri 13 Nov | Drop the earlier concept (floating rescue beacon) | Weak fit to the brief's emphasis on sensors, autonomy and the engineering path | Keep it | Team | Decided |
| D-002 | Fri 13 Nov | Concept: SeaGuardian, a supervised harbour safety inspector USV | Lands in MTC's sensor integration, autonomy and safety areas; testable on a bench; combines mechanical, electronics, software, testing and research work | Five printable options in concepts.md | Team | Decided |
| D-003 | Fri 13 Nov | Scope: CAD + dry bench laptop/ESP32 demo; mission is simulated and supervised | Real autonomy, GPS and water trials are not achievable or safe in two days | Attempt a floating prototype | Team | Decided |
| D-004 | Fri 13 Nov | Safety logic lives on the ESP32, independent of the laptop | Motors must stop even if the laptop crashes or the link is cut | Safety on the laptop | Electrical and software leads | Proposed |
| D-005 | Fri 13 Nov | Laptop <-> ESP32 over USB serial with JSON lines | Simplest reliable link on a bench; easy to log and time | Wi-Fi, MQTT | Electrical and software leads | Proposed |
| D-006 | Fri 13 Nov | Official brief and mentor feedback override this repo | Judging is against the brief | - | Team | Decided |
| D-007 | Fri 13 Nov | Hardware: **two ESP32s**. ESP32 #1 = camera (video to laptop); ESP32 #2 = control (IMU, GPS, pressure/leak, one DC propulsion motor via driver, one rear rudder servo, safety). Laptop runs the dashboard. No voice control. | Confirmed by the team; fewer boards and simpler power; camera adds visual inspection value | A separate on-board mission computer; differential steering with two motors | Team | Decided |
| D-008 | Fri 13 Nov | Steering: manual rudder servo first; P controller on IMU yaw rate only if core works; full PID is a stretch goal | Protects the core demo; a 6-axis IMU has no drift-free heading | PID from the start | Electrical and software leads | Proposed |


## Current interpretation (14 November documentation review)

D-003's operational simulator, D-005's serial link and D-007's one-motor/pressure/leak layout are historical plans superseded by the implemented WebSocket dashboard and team-confirmed two-motor/rudder design. They are retained above to explain the development path, not as current specifications.

Current architecture is described in [architecture.md](architecture.md). The simulator was removed in commit 06a3305. Heritage's battery/package reconciliation is still pending; no cleanup decision establishes a physical test pass.
