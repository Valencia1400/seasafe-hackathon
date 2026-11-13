# Demo Script & Readiness Checklist - Owner: Person 5 (script), Person 4 (checklist)

Target 60-90 s. Rehearse twice on Sunday, including the fallbacks.

| Step | Who | Action | What we say | If it fails |
|---|---|---|---|---|
| 1 | P3 | Start an inspection mission on the dashboard | "The operator sends SeaGuardian to inspect the quay after a storm." | Simulator mode |
| 2 | P2 | Point at live IMU and pressure readings | "The ESP32 streams orientation and atmospheric pressure to the mission computer." | Simulator mode (labelled) |
| 3 | P4 | Tilt the IMU past 30 deg (or trigger the labelled leak input) | "An abnormal condition - the operator is warned within N s" (measured) | Backup video |
| 4 | P2 | Press "Cut link" | "If the link is lost, the ESP32 stops the motors on its own after 1 s" (measured) | Backup video |
| 5 | P1 | Show the CAD assembly and the swappable sensor bay | "This is where the electronics, propulsion and payloads go." | Exported images |

## Readiness checklist (Sunday morning)
- [ ] ESP32 + sensors + bench motors/LEDs wired and tested this morning
- [ ] Dashboard runs offline on the laptop; simulator mode ready as fallback
- [ ] CAD file open; exported images as backup
- [ ] Backup video on laptop AND phone, plays offline
- [ ] Slides on laptop AND USB stick/phone
- [ ] test-results.md up to date
- [ ] Each person knows their step and the fallback
