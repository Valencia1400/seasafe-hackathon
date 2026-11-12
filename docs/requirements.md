# Requirements

> **Status: PROVISIONAL v0.** These are our own engineering targets, not verified performance claims.
> The official Saab/MTC brief and judging criteria **override** everything here. Update section 1 first on Friday, then re-check section 2.

## 1. Official brief and judging criteria (fill in Friday - Owner: Person 3)
| Item | Official wording / source | Impact on our plan |
|---|---|---|
| Challenge statement | | |
| Judging criteria + weights | | |
| Presentation time limit | | |
| Demo / deliverable rules | | |
| Available equipment and materials | | |
| Mentor contacts / office hours | | |
| Deadlines (freeze, submission) | | |

**Brief-change procedure:** (1) paste the official text above, (2) Person 3 and Person 5 mark which requirements/priorities change, (3) record the change in `docs/decisions.md`, (4) update the Requirements table and the GitHub issues, (5) announce at the next checkpoint.

## 2. Product requirements (provisional)
Priority: **M** = must (demo fails without it), **S** = should, **C** = could (stretch).

| ID | Requirement | Measurable target | Pri | Test | Status |
|---|---|---|---|---|---|
| R1 | Floats continuously (unpowered prototype, calm water, representative mass) | >= 15 min without sinking or taking on water | M | T-R1 | Not tested |
| R2 | Self-rights after tilting | Upright within 5 s in >= 3 of 5 controlled trials | M | T-R2 | Not tested |
| R3 | LED activates on button press | LED on within 2 s of press (5 of 5 presses) | M | T-R3 | Not tested |
| R4 | Electronics module is replaceable | Remove and replace in < 60 s by someone who did not design it | M | T-R4 | Not tested |
| R5 | Parametric CAD adapts to a change | >= 1 controlled parameter change -> new model -> new STL | M | T-R5 | Not tested |
| R6 | Printable | STL loads in a slicer with no blocking errors; fits the printer bed | M | T-R6 | Not tested |
| R7 | Evidence is honest | Every requirement marked pass / fail / not tested with evidence | M | T-R7 | Not tested |
| R8 | One genuine design improvement | v1 test result -> change -> v2 retest, with measured difference | S | T-R8 | Not tested |
| R9 | Electrical safety | Flotation tests use unpowered dummy module; no exposed electronics in water | M | checklist | Not tested |
| R10 | (Stretch) Wireless alert reaches laptop | Alert visible on laptop within 5 s of activation | C | T-R10 | Not started |
| R11 | (Stretch) Water-contact activation | Activates in water, no false trigger when dry | C | T-R11 | Not started |

## 3. Explicit non-goals
- Not certified; no claim of compliance with SOLAS, military or any other standard.
- Not claimed fully waterproof unless a leak test (T-R1b) shows it, and then only for the tested conditions.
- No GPS, no radio-distress claims, no range claims.
- No invented market statistics, costs or military requirements.

## 4. Assumptions to confirm
- Printer type, materials and bed size (issue: confirm equipment).
- A water tub / container is available at the venue.
- Component list is available (docs/components.md).
