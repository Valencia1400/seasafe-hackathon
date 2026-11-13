# Risks & Fallbacks - Owner: Person 3 (review at every checkpoint)

**Minimum demo that must survive any risk:** CAD assembly on screen + dashboard showing (real or labelled simulated) sensor data + a demonstrated motor-stop on a fault + test results + backup video.

| # | Risk | Likelihood | Impact | Early warning | Fallback | Owner |
|---|---|---|---|---|---|---|
| 1 | Problem not confirmed by mentors | Med | High | No mentor answer by Fri afternoon | Ask another mentor; use sourced research; adjust the mission to what they say | P3 |
| 2 | Camera ESP32 stream does not work or is too slow | Med | Med | No video on the laptop by Sat midday | Show the rest of the demo without video; a recorded clip only if it is real and labelled | P2/P3 |
| 3 | A sensor is missing or broken | Med | Med | Component check Fri | Labelled test input (button/potentiometer) or simulator; say so on screen | P2 |
| 4 | Serial link unreliable | Low | High | Gaps in `seq` | Lower rate, shorter cable, check baud; fall back to simulator for the dashboard part | P2 |
| 5 | Safety stop does not work reliably | Low | High | T-R8/T-R9 fail | Fix before anything else; it is the core of the demo | P2 |
| 6 | Dashboard too ambitious | Med | Med | Not showing data by Sat midday | Plain web page or terminal view with big labels | P3 |
| 7 | CAD components do not fit | Med | Med | T-R3 | Clearance parameter; enlarge the bay; this is a good iteration story | P1 |
| 8 | Time sunk into optional features | High | High | Printing or extra sensors while a must is open | Only after all M requirements have a status | P3 |
| 9 | Demo failure on stage | Med | High | Rehearsal | Backup video; simulator mode; rehearse twice | P3/P5 |
| 10 | Overclaiming autonomy or safety | Med | High | Words like "autonomous", "safe" in slides | Say "simulated supervised mission", "bench control logic" | P5 |
| 11 | Blocked > 30 min | Med | Med | Checkpoint | Say it at the table; pair up | All |

## Critical path
Mentor answer -> requirements v1 -> protocol frozen -> (ESP32 safety + telemetry) and (dashboard on simulator) in parallel -> integrate -> tests -> freeze.
