# Hackathon Prototype (concept to be decided)

> **Campor Hackathon - Saab x Marine Technology Center (MTC) - Challenge: Prompt-to-Product - 13-15 Nov 2026**

**Status:** our earlier concept was dropped. We are waiting for the official brief and requirements (presented Friday). The new concept will be chosen from that brief, with one goal: **a real, printable 2D/3D prototype finished within hours**, plus honest test evidence and a visible AI-assisted engineering process.

**Honest disclaimer:** this is a weekend proof of concept. All numbers are *provisional targets* until a row in [`tests/test-results.md`](tests/test-results.md) says otherwise.

## Concept (fill in after the brief)
- **Name:**
- **Problem it addresses (from the brief):**
- **Target user:**
- **What we build physically:**
- **What AI does in our process:**

## How we choose the concept (Friday, right after the brief)
Score each idea 1-5 on: fits the brief and judging criteria / printable in < 3 h / demo works on a table / one measurable test we can run today / AI process is easy to show. Pick the highest total and record it in [`docs/decisions.md`](docs/decisions.md).

## Features
**Essential (must work for the demo)** - max 3-4 items
-

**Optional - only after ALL essentials are done**
-

## Team
| Person | Role | Group | Owns |
|---|---|---|---|
| 1 | Technical lead / CAD | A - Physical | CAD, STL, printed parts, technical merges |
| 2 | Electronics lead | B - Electronics & SW | Electronics (if the concept needs any), power, electrical safety |
| 3 | Product lead / integration | B - Electronics & SW | Priorities, integration, optional software, mentors, AI log (with 5) |
| 4 | Prototype & verification | A - Physical | Assembly, tests, video, verification checklist |
| 5 | Research, docs & pitch | Cross-team | Pitch, slides, research, AI log (with 3), decisions, judge Q&A |

GitHub usernames: fill in at the top of [`docs/workflow.md`](docs/workflow.md).

## Repository map
```
cad/            Model source (models/) and STL/STEP exports (exports/)   - Person 1
electronics/    Firmware and wiring, only if the concept needs it          - Person 2
dashboard/      OPTIONAL software                                           - Person 3
tests/          Test plan and test results (the evidence)                   - Person 4
docs/           Requirements, architecture, components, AI log, decisions, risks, research, workflow
presentation/   Pitch outline, demo script, judge Q&A prep                  - Person 5
```
Each workstream lives in its own folder, so merge conflicts should be rare.

## How to run / demonstrate
Nothing yet. As each part works, write the exact steps in its folder README.

## Current status
Update at every checkpoint.

| Area | Status | Notes |
|---|---|---|
| Official brief reviewed | Not started | Update [requirements](docs/requirements.md) |
| Concept chosen | Not started | |
| CAD v1 | Not started | |
| First print | Not started | |
| Tests | Not started | |
| Pitch + demo script | Not started | |
| Backup video | Not started | |

## Weekend milestones
- **Fri 13 Nov:** brief read, concept chosen, requirements v1, CAD v1, **first print started the same day**, test procedure written.
- **Sat 14 Nov:** test v1, AI-assisted improvement -> v2 print -> retest, backup video, **prototype freeze**.
- **Sun 15 Nov:** no new features. Rehearse, present, answer questions.

## Key documents
[Requirements](docs/requirements.md) - [Test plan](tests/test-plan.md) - [Test results](tests/test-results.md) - [AI engineering log](docs/ai-process.md) - [Decisions](docs/decisions.md) - [Risks](docs/risks.md) - [Workflow & how-to](docs/workflow.md) - [Pitch outline](presentation/pitch-outline.md)
