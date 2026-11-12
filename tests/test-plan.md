# Test Plan - Owner: Person 4 (with Person 1 and Person 5)

Targets are **provisional** (see docs/requirements.md). Record outcomes in `tests/test-results.md`. A test that was not run is **Not tested**, never "Pass".

## Safety rules (read first)
1. **Flotation and stability tests use an UNPOWERED prototype with a dummy module** (same mass and size as the real module, no battery, no wires into water).
2. Never put a battery, loose wiring or a microcontroller in water.
3. Powered tests happen dry. If a powered float test is ever attempted, Person 2 must sign off and a leak test (T-R1b) must have passed first.
4. Wipe up spills; keep the water tub away from laptops and power strips.

## General method
- Same water, same tub, same dummy-module mass for every comparison. Note water temperature if known.
- Record **every** trial, including failures. Film at least one trial per test (phone, stopwatch visible).
- One person times, one person handles, one person records.
- Change **one thing at a time** between design versions.

## Test procedures
| ID | Req | Procedure | Expected result |
|---|---|---|---|
| T-R1 | R1 | Place dummy-module prototype in tub. Start timer. Check every 5 min for sinking, tilt, water ingress. | Floats 15 min, no sinking |
| T-R1b | R1/R9 | Leak check: put a paper tissue inside the sealed compartment, float 15 min, open and check tissue and inside walls. | Tissue dry (else: record leak location) |
| T-R2 | R2 | Hold prototype tilted ~90 degrees (on its side) in water, release, start timer, stop when upright and settled. Repeat 5 times. Record each time. | Upright <= 5 s in >= 3/5 |
| T-R3 | R3 | Dry, powered module. Press button 5 times. Time press -> LED on (phone slow-motion video or stopwatch). | LED on <= 2 s, 5/5 |
| T-R4 | R4 | A teammate who did not design it removes and replaces the module following the written steps. Time with stopwatch. | < 60 s |
| T-R5 | R5 | Change one named parameter in the CAD source, re-export STL, compare dimension with a caliper or CAD measurement. | New STL reflects the change |
| T-R6 | R6 | Open STL in slicer, check bed fit, errors, wall thickness warnings, print time. Screenshot. | Slices without blocking errors |
| T-R7 | R7 | At end of Saturday every requirement row in test-results.md has a status and evidence link. | No blank rows |
| T-R8 | R8 | Run the failing test on v1, record data, change design (log in docs/ai-process.md), print v2, re-run the same test. | Measured difference documented |

## Verification checklist (Person 4)
- [ ] Equipment ready: tub, towels, stopwatch/phone, scale (grams), calipers/ruler, tape
- [ ] Dummy module made (same mass as real module +/- 5 g)
- [ ] Each test run at least once; failures recorded
- [ ] Video evidence linked in test-results.md
- [ ] Limitations written down (what we did NOT test)
