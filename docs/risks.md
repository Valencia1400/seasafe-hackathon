# Risks & Fallbacks - Owner: Person 3 (review at every checkpoint)

**Minimum viable demo (must survive any risk):** a physical prototype (printed or 2D), a CAD change shown, test results/evidence, and a recorded backup video.

| # | Risk | Likelihood | Impact | Early warning | Fallback | Owner |
|---|---|---|---|---|---|---|
| 1 | 3D printer unavailable or too slow | Med | High | Queue or estimate > 3 h | Print smaller/thinner, split parts, laser-cut or cardboard 2D version; CAD + slicer evidence still counts | P1 |
| 2 | CAD model cannot be printed | Med | High | Slicer errors, overhangs | Simplify geometry, add flat faces, split parts; keep a "boring" fallback design | P1 |
| 3 | Parts do not fit together | Med | High | Test piece fails | Add a clearance parameter; print a tolerance test first | P1/P4 |
| 4 | Missing materials or components | Med | High | Component list gaps Friday | Ask organisers; simplify the design | P2 |
| 5 | Time sunk into optional features | High | High | Stretch work while an essential issue is open | Stretch only when all essentials for that day are Done; P3 enforces | P3 |
| 6 | Concept does not match the brief | Med | High | Mentor feedback | Re-check against judging criteria at each checkpoint; ask mentors early | P3 |
| 7 | Demo failure on stage | Med | High | Sunday rehearsal | Recorded backup video; spare printed part; rehearse twice | P3/P5 |
| 8 | Team member blocked > 30 min | Med | Med | Checkpoint | Raise it at the table; label issue `Blocked`; pair up | All |
| 9 | Merge conflict / lost work | Low | Med | | Separate folders; commit + push at every checkpoint | P1 |

## Critical path (fill in after the concept is chosen)
Brief -> concept -> CAD v1 -> print -> test -> v2 -> retest -> **freeze**.
