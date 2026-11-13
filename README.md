# SeaGuardian - supervised harbour safety inspector (hackathon demonstrator)

> **Campor Hackathon - Saab x Marine Technology Center (MTC) - Challenge: Prompt-to-Product - 13-15 Nov 2026**

**Honest disclaimer:** SeaGuardian is a weekend proof of concept: a CAD design plus a **dry bench** electronics and software demonstrator. It has not been on water. Navigation is a **simulated supervised inspection mission**, not real autonomy. All numbers are provisional targets until [`tests/test-results.md`](tests/test-results.md) says otherwise.

## The problem (hypothesis - validate with a mentor today)
After storms, accidents or suspected damage, harbour operators may need to inspect infrastructure or local water conditions **before deciding whether to send personnel** into an area.

## The solution
A small, supervised unmanned surface vehicle (two-hull catamaran) that runs an initial inspection mission, collects sensor data and reports problems to an operator. Its point of difference is not "a small autonomous boat" (Saab already builds those), but:
1. **Interchangeable sensor bay** - payloads swap per mission.
2. **Split control:** high-level mission logic on a Raspberry Pi, low-level **safety control on an ESP32** that stops the motors on its own if anything goes wrong.
3. **Transparent AI-assisted engineering** - every design step, mistake and fix is logged.

Positioning: *a modular, low-cost experimental platform for developing and testing safe maritime inspection capabilities.* (Do not claim lower cost than existing systems without a defensible comparison.)

**Target user:** harbour maintenance and safety personnel; possible future use by naval support teams.

## The five things we build this weekend
| # | Feature | Owner | Evidence |
|---|---|---|---|
| 1 | Complete CAD assembly: catamaran, sealed electronics bay, propulsion mounts, interchangeable sensor bay | P1 | Editable CAD, exploded view, component-fit check |
| 2 | Raspberry Pi <-> ESP32 communication | P2 + P3 | Live messages between the boards (or clearly labelled simulation) |
| 3 | Sensor monitoring: IMU (orientation), pressure sensor (atmospheric pressure), leak sensor | P2 | Real readings, correctly labelled |
| 4 | Safety-first motor control: emergency stop, comms-loss timeout, operator override | P2 | Injected fault -> motor output commanded to zero, measured |
| 5 | Inspection mission dashboard: start mission, live sensor data, event log, faults | P3 | Repeatable live demo |

**Not this weekend:** obstacle avoidance, GPS waypoint navigation, real autonomous sailing, water trials.

## Team
| Person | Role | Main jury criteria |
|---|---|---|
| 1 | CAD developer / technical lead | Feasibility, technical quality |
| 2 | Electrical engineer: Pi/ESP32 architecture, sensors, motor safety | Technical quality, feasibility |
| 3 | Product lead: mission definition, dashboard, integration, mentor feedback | Problem, user value, partner relevance |
| 4 | Verification: test matrix, repeated tests, evidence | Technical quality, feasibility |
| 5 | User research, differentiation, AI log, presentation | Problem, user value, innovation, presentation |

**What to do first:** [`docs/start-here.md`](docs/start-here.md) - one section per person.

## Repository map
```
cad/                    CAD source (models/) and exports (exports/)                     - P1
electronics/firmware/   ESP32 firmware (sensors + safety + motor output)                 - P2
electronics/wiring/     Wiring diagram, pin table, photos                                - P2
dashboard/              Raspberry Pi mission software + operator dashboard              - P3
tests/                  Test plan and results (the evidence)                             - P4
docs/                   Start here, requirements, architecture + protocol, components,
                        AI log, decisions, risks, research, workflow                     - P3/P5
presentation/           Pitch outline, demo script, judge Q&A                            - P5
```

## Demo sequence (60-90 s)
1. Operator starts an inspection mission on the dashboard (simulated vessel departs).
2. ESP32 streams IMU and pressure readings to the Pi; they appear live.
3. Abnormal condition: we tilt the real IMU (or inject a labelled leak signal) -> warning to the operator.
4. Safety response: we cut the Pi <-> ESP32 link -> after the timeout the ESP32 commands motor output to zero.
5. CAD: show where electronics, propulsion and the swappable sensor bay sit.

A dry bench motor stop demonstrates our **control logic**, not complete real-world vessel safety.

## Current status (update at every checkpoint)
| Area | Status | Notes |
|---|---|---|
| Problem validated with a mentor | Not started | Question in [research.md](docs/research.md) |
| Requirements v1 | Drafted | [requirements.md](docs/requirements.md) |
| CAD assembly v1 | Not started | |
| Pi <-> ESP32 link | Not started | Protocol in [architecture.md](docs/architecture.md) |
| Sensors | Not started | |
| Safety stop | Not started | |
| Dashboard | Not started | |
| Tests | Not started | |
| Pitch + backup video | Not started | |

## Key documents
[Start here](docs/start-here.md) - [Requirements](docs/requirements.md) - [Architecture & protocol](docs/architecture.md) - [Test plan](tests/test-plan.md) - [Test results](tests/test-results.md) - [AI engineering log](docs/ai-process.md) - [Decisions](docs/decisions.md) - [Risks](docs/risks.md) - [Workflow](docs/workflow.md) - [Pitch](presentation/pitch-outline.md)
