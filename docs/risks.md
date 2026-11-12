# Risks & Fallbacks - Owner: Person 3 (review at every checkpoint)

**Minimum viable demo (must survive any risk):** a physical prototype, a working dry electronics demo, a CAD parameter change, test results/evidence, and a recorded backup video. Dry electronics shown separately from a floating **unpowered** housing is acceptable if safe integration is not achieved.

| # | Risk | Likelihood | Impact | Early warning | Fallback | Owner |
|---|---|---|---|---|---|---|
| 1 | 3D printer unavailable or too slow | Med | High | Printer queue, estimated print > 4 h | Ask organisers/MTC for printer access Friday morning; print smaller/thinner v1; split parts; use a bought container + 3D-printed module tray; CAD + slicer evidence still counts | P1 |
| 2 | Missing electronic components | Med | High | Component list gaps Friday | Ask organisers; use Arduino + any LED; borrow; simplify to battery+resistor+LED+switch | P2 |
| 3 | CAD model cannot be printed | Med | High | Slicer errors, overhangs | Simplify geometry, add flat faces, split into parts, fix with AI-assisted review; keep a "boring" fallback design | P1 |
| 4 | Housing does not float upright | High (first try) | High | Mock-up on Friday | Adjust ballast (parameter), lower centre of gravity, widen base; this is the planned iteration (R8) | P1/P4 |
| 5 | Electronics do not fit housing | Med | High | Module dims not given to P1 by Fri midday | Person 2 sends dims early; add clearance parameter; print module tray separately; trim components | P2/P1 |
| 6 | Water leaks into enclosure | High | Med | Tissue test (T-R1b) | Unpowered tests only; seal lid with gasket/O-ring/tape; use a sealed bought container for the electronics; state "not waterproof" honestly | P1/P4 |
| 7 | Wireless dashboard fails | Med | Low | Not working by Sat 16:00 | Drop it. Demo LED only. Show recorded dashboard clip only if it was real | P3 |
| 8 | Time sunk into optional features | High | High | Anyone working on stretch while an essential issue is open | Stretch work allowed only when all essentials for that day are Done; P3 enforces | P3 |
| 9 | Official brief differs from our concept | Med | High | Friday brief | Update requirements.md; re-prioritise; keep modular + AI-process angle | P3 |
| 10 | Battery / electrical incident | Low | High | LiPo or exposed wiring near water | Primary cells only; electronics never in water; P2 sign-off | P2 |
| 11 | Demo failure on stage | Med | High | Sunday rehearsal | Recorded backup video; second spare module; tub pre-filled; rehearse twice | P3/P5 |
| 12 | Team member blocked > 30 min | Med | Med | Checkpoint | Raise immediately at the table; label issue `Blocked`; pair up | All |
| 13 | Merge conflict / lost work | Low | Med | | Separate folders; commit + push at every checkpoint; Discord backup of key files | P1 |

## Dependency chain (critical path)
Module dimensions (P2) -> CAD v1 (P1) -> print (P1/P4) -> flotation test (P4) -> revise CAD v2 -> retest -> **freeze**.
