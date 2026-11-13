# Decision Log - Owner: Person 5 (anyone may add)

One short entry per decision. Newest at the bottom. These are part of the "why we chose" story the jury asked for.

| ID | Date/time | Decision | Why | Alternatives | Decided by | Status |
|---|---|---|---|---|---|---|
| D-001 | Fri 13 Nov | Drop the earlier concept (floating rescue beacon) | Weak fit to the brief's emphasis on sensors, autonomy and the engineering path | Keep it | Team | Decided |
| D-002 | Fri 13 Nov | Concept: SeaGuardian, a supervised harbour safety inspector USV | Lands in MTC's sensor integration, autonomy and safety areas; testable on a bench; uses all five competencies | Five printable options in concepts.md | Team | Decided |
| D-003 | Fri 13 Nov | Scope: CAD + dry bench Pi/ESP32 demo; mission is simulated and supervised | Real autonomy, GPS and water trials are not achievable or safe in two days | Attempt a floating prototype | Team | Decided |
| D-004 | Fri 13 Nov | Safety logic lives on the ESP32, independent of the Pi | Motors must stop even if the Pi crashes or the link is cut | Safety on the Pi | P2 + P3 | Proposed |
| D-005 | Fri 13 Nov | Pi <-> ESP32 over USB serial with JSON lines | Simplest reliable link on a bench; easy to log and time | Wi-Fi, MQTT | P2 + P3 | Proposed |
| D-006 | Fri 13 Nov | Official brief and mentor feedback override this repo | Judging is against the brief | - | Team | Decided |

## Template
```
| D-### | date/time | what we decided | why | what else we considered | who | Proposed/Decided |
```
