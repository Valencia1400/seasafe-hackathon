# Test Plan - Owner: Person 4 (with Person 1 and Person 5)

Targets are **provisional** (see docs/requirements.md). Record outcomes in `tests/test-results.md`. A test that was not run is **Not tested**, never "Pass".

## Safety rules
1. Follow the venue's rules for printers, tools and hot parts.
2. If the concept has electronics: powered tests only with Person 2 present; no exposed electronics near water or heat.

## General method
- Same conditions for every comparison between versions.
- Record **every** trial, including failures. Film at least one trial per test (phone, stopwatch or ruler visible).
- One person handles, one measures, one records.
- Change **one thing at a time** between design versions.

## Test procedures (fill in after the concept is chosen)
| ID | Req | Procedure | Expected result |
|---|---|---|---|
| T-R1 | R1 | | |
| T-R2 | R2 | | |
| T-R3 | R3 | Open STL in slicer, check bed fit, errors, thin-wall warnings, print time. Screenshot. | Slices without blocking errors, < 3 h |
| T-R4 | R4 | Run the failing test on v1, record data, change design (log in docs/ai-process.md), print v2, re-run the same test. | Measured difference documented |
| T-R5 | R5 | End of Saturday: every requirement row in test-results.md has a status and evidence link. | No blank rows |

## Verification checklist (Person 4)
- [ ] Measuring tools ready (caliper/ruler, scale, stopwatch/phone, tape)
- [ ] Each test run at least once; failures recorded
- [ ] Video/photo evidence linked in test-results.md
- [ ] Limitations written down (what we did NOT test)
