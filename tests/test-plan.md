# Test Plan - Owner: Person 4 (with Person 2 and Person 3)

Each test checks the requirement with the same number in [docs/requirements.md](../docs/requirements.md). Record every trial in `tests/test-results.md`. A test that was not run is **Not tested**, never "Pass".

## Safety rules
- Dry bench only. No powered electronics near water. No propellers on bench motors.
- Person 2 is present for every powered test.

## How to time things
Use the dashboard log file: it timestamps each message and the ESP32 `ms` field shows when the output changed. Film the screen and the bench together as backup evidence.

## Tests
| ID | Procedure | Pass criterion | Repeats |
|---|---|---|---|
| T-R1 | Ask a Saab/MTC mentor the problem question (docs/start-here.md); write the answer word for word, with name and time | Answer recorded | 1 |
| T-R2 | Open the CAD model, change one parameter, regenerate; export the exploded view | Model regenerates; all required parts present | 1 |
| T-R3 | Place every component from components.md in CAD at real size; measure the smallest gap | All gaps >= 3 mm or exceptions listed | 1 |
| T-R4 | Run the link for 5 minutes; count telemetry `seq` gaps in the log | >= 5 Hz and >= 99% received | 3 |
| T-R5 | With the real sensors: check roll/pitch against a phone level app at 0 and about 30 deg; check the pressure value is plausible for atmospheric pressure | Values shown, labelled, units correct, update >= 1/s | 5 |
| T-R6 | Tilt the IMU past 30 deg; time from tilt to TILT warning (video) | <= 1 s | 5 |
| T-R7 | Trigger the leak input; time to LEAK fault and motor output 0 | <= 1 s | 5 |
| T-R8 | Motors running on the bench; press E-STOP; compare log time of the press with the ESP32 `ms` of output 0 | <= 200 ms | 5 |
| T-R9 | Motors running; press "Cut link" (or pull the USB cable); time until output 0; then check motors stay off until Reset | Stop within 1.2 s; no restart without Reset | 5 |
| T-R10 | Run the full demo sequence (README) from a fresh start | Completes without a restart | 5 |
| T-R11 | Pick one AI-generated design or code part that failed review or a test; fix; re-run the same test | Before/after documented | 1 |
| T-R12 | (If printed) remove and replace the sensor-bay module, stopwatch | < 60 s | 5 |

## Verification checklist (Person 4)
- [ ] Every test above has a row in test-results.md
- [ ] Failures are kept, with the corrective action
- [ ] Video evidence linked for T-R6, T-R8, T-R9, T-R10
- [ ] Limitations listed (what we did not test)
