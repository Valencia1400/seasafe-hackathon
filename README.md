# SeaSafe Modular

> AI-assisted, modular maritime rescue beacon - a hackathon proof of concept.
> **Campor Hackathon - Saab x Marine Technology Center (MTC) - Challenge: Prompt-to-Product - 13-15 Nov 2026**

**Honest disclaimer:** SeaSafe Modular is a proof of concept built in a weekend. It is **not** a certified rescue device and we make **no** claim that it meets any maritime, naval or defence standard. All numbers in this repo are *provisional targets* until a row in [`tests/test-results.md`](tests/test-results.md) says otherwise.

## What it is
A small floating emergency beacon with a flashing LED, built as a **replaceable electronics module** inside a **parametric 3D-printed housing**. The beacon itself is deliberately simple. The point is the *process*: showing how AI can help engineers go from a requirement to a CAD model, change it when requirements change, check it, fix design problems, and verify a physical prototype faster.

## The problem
Rescue and safety equipment has to be adapted, repaired and maintained as requirements, components and suppliers change. Redesigning a housing by hand each time is slow. We explore whether AI-assisted, parametric, modular design shortens that loop, and we test it on a real printed part.

## Why it matters for maritime safety and resilience
- Locating people and assets in the water is a core maritime safety task, and Sweden has a long coastline and heavy maritime activity.
- Modular equipment can be serviced by swapping a module instead of replacing the whole unit.
- Faster design iteration means faster adaptation of equipment, which supports resilience.

We do not cite statistics we have not verified. Research notes live in [`docs/research.md`](docs/research.md).

## Features
**Essential (must work for the demo)**
- Floating housing that stays upright or self-rights after tilting
- LED that flashes when a button is pressed
- Replaceable electronics compartment (module swap)
- Parametric CAD model that adapts quickly to a changed requirement
- Measured tests and evidence (pass / fail / not tested)

**Optional - only after ALL essentials are done**
- Automatic water-contact activation
- ESP32 local wireless alert to a laptop + simple dashboard
- Battery-status indication

The minimum demo **never depends** on the wireless dashboard.

## Team
| Person | Role | Group | Owns |
|---|---|---|---|
| 1 | Technical lead / CAD | A - Physical | CAD, STL, printed parts, technical merges |
| 2 | Electronics lead | B - Electronics & SW | Circuit, firmware, power, electrical safety, module dimensions |
| 3 | Product lead / integration | B - Electronics & SW | Priorities, integration, optional dashboard, Saab mentors, AI log (with 5) |
| 4 | Prototype & verification | A - Physical | Assembly, flotation tests, video, verification checklist |
| 5 | Research, docs & pitch | Cross-team | Pitch, slides, research, AI-process log (with 3), decisions, judge Q&A |

GitHub usernames: fill in at the top of [`docs/workflow.md`](docs/workflow.md).

## Repository map
```
cad/            Parametric model source (models/) and STL/STEP exports (exports/)   - Person 1
electronics/    Firmware, wiring, electronics notes                                 - Person 2
dashboard/      OPTIONAL local alert dashboard                                      - Person 3
tests/          Test plan and test results (the evidence)                           - Person 4
docs/           Requirements, architecture, components, AI log, decisions, risks, research, workflow
presentation/   Pitch outline, demo script, judge Q&A prep                          - Person 5
.github/        Issue definitions + PR template
scripts/        setup-github.ps1 (creates labels, milestones, issues, board)
```
Each workstream lives in its own folder, so merge conflicts should be rare.

## How to run / demonstrate
Nothing is verified yet. As each part works, write the exact steps in its folder README.
1. **CAD:** change parameters per [`cad/README.md`](cad/README.md), export STL to `cad/exports/`, inspect in a slicer.
2. **Electronics:** see [`electronics/README.md`](electronics/README.md).
3. **Dashboard (optional):** see [`dashboard/README.md`](dashboard/README.md).
4. **Tests:** follow [`tests/test-plan.md`](tests/test-plan.md); log in [`tests/test-results.md`](tests/test-results.md).
5. **Demo:** follow [`presentation/demo-script.md`](presentation/demo-script.md).

## Current status
Update at every checkpoint.

| Area | Status | Notes |
|---|---|---|
| Official brief reviewed | Not started | Arrives Friday - update [requirements](docs/requirements.md) |
| CAD housing v1 | Not started | |
| Electronics (LED + button) | Not started | |
| Printed prototype | Not started | |
| Flotation tests | Not started | |
| Pitch + demo script | Outline drafted | |
| Backup video | Not started | |

## Weekend milestones
- **Fri 13 Nov:** brief confirmed, requirements v1 frozen, CAD v1 drafted, LED/button circuit on breadboard, flotation mock-up tested, pitch outline started.
- **Sat 14 Nov:** print/assemble, flotation + stability tests, integrate electronics, module swap, **one measured design iteration (CAD v2)**, backup video, **prototype freeze**.
- **Sun 15 Nov:** no new features. Rehearse, check demo readiness, present, answer questions.

## Key documents
[Requirements](docs/requirements.md) - [Test plan](tests/test-plan.md) - [Test results](tests/test-results.md) - [AI engineering log](docs/ai-process.md) - [Decisions](docs/decisions.md) - [Risks](docs/risks.md) - [Workflow & how-to](docs/workflow.md) - [Pitch outline](presentation/pitch-outline.md)
