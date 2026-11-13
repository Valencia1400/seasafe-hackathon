# Decision Log - Owner: Person 5 (anyone may add)

One short entry per decision. Newest at the bottom. These are part of the "why we chose" story the jury asked for.

| ID | Date/time | Decision | Why | Alternatives | Decided by | Status |
|---|---|---|---|---|---|---|
| D-001 | Fri 13 Nov | Drop the earlier concept (floating rescue beacon) | Weak fit to the brief's emphasis on sensors, autonomy and the engineering path | Keep it | Team | Decided |
| D-002 | Fri 13 Nov | Concept: SeaGuardian, a supervised harbour safety inspector USV | Lands in MTC's sensor integration, autonomy and safety areas; testable on a bench; uses all five competencies | Five printable options in concepts.md | Team | Decided |
| D-003 | Fri 13 Nov | Scope: CAD + dry bench laptop/ESP32 demo; mission is simulated and supervised | Real autonomy, GPS and water trials are not achievable or safe in two days | Attempt a floating prototype | Team | Decided |
| D-004 | Fri 13 Nov | Safety logic lives on the ESP32, independent of the laptop | Motors must stop even if the laptop crashes or the link is cut | Safety on the laptop | P2 + P3 | Proposed |
| D-005 | Fri 13 Nov | Laptop <-> ESP32 over USB serial with JSON lines | Simplest reliable link on a bench; easy to log and time | Wi-Fi, MQTT | P2 + P3 | Proposed |
| D-006 | Fri 13 Nov | Official brief and mentor feedback override this repo | Judging is against the brief | - | Team | Decided |
| D-007 | Fri 13 Nov | Hardware: **two ESP32s**. ESP32 #1 = camera (video to laptop); ESP32 #2 = control (IMU, GPS, pressure/leak, one DC propulsion motor via driver, one rear rudder servo, safety). Laptop runs the dashboard. No voice control. | Confirmed by the team; fewer boards and simpler power; camera adds visual inspection value | A separate on-board mission computer; differential steering with two motors | Team | Decided |
| D-008 | Fri 13 Nov | Steering: manual rudder servo first; P controller on IMU yaw rate only if core works; full PID is a stretch goal | Protects the core demo; a 6-axis IMU has no drift-free heading | PID from the start | P2 + P3 | Proposed |

## Template
```
| D-### | date/time | what we decided | why | what else we considered | who | Proposed/Decided |
```
