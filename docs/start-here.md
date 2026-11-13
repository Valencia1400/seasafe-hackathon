# Start here - what each person does first

Read your own section, then start. Raise a blocker at the table after 30 minutes at most. Log every AI use (see [ai-process.md](ai-process.md)).

## Everyone (first 15 minutes)
1. `git pull` (or open the repo on github.com).
2. Read the README and [requirements.md](requirements.md) section 2.
3. Agree the checkpoint times (every 60-90 min) and the Saturday freeze time.

## Person 3 - Product lead (you)
1. **Mentor question, first thing** (the top two criteria = 40% of the score):
   > "We're considering a small unmanned vehicle for initial harbour inspections after storms or incidents. Is this a real problem for your intended users? What information would be most useful before sending personnel, and how is that collected today?"
   Write the answer word for word in [research.md](research.md). If it changes the mission or sensors, record it in [decisions.md](decisions.md).
2. Freeze the message protocol with Person 2 ([architecture.md](architecture.md)) so dashboard and firmware can be built in parallel.
3. Build the dashboard in `dashboard/`, first against a **simulator** that sends the same messages, then against the real ESP32.
4. Keep the README status table current at each checkpoint.

## Person 1 - CAD
1. Get component dimensions from Person 2 ([components.md](components.md)).
2. Parametric catamaran assembly: two hulls, sealed electronics bay, two propulsion mounts, interchangeable sensor bay. See [cad/README.md](../cad/README.md).
3. Geometry check: every component fits with the stated clearance; exploded view exported.
4. Optional, only if a printer is free: print the sensor-bay module to show the swap physically.

## Person 2 - Electronics
1. List the boards and sensors you actually have in [components.md](components.md); send dimensions to Person 1.
2. ESP32: read IMU, pressure sensor and leak input; send telemetry; implement the safety rules (e-stop, comms-loss timeout, override). See [electronics/README.md](../electronics/README.md).
3. Motor output on the bench: LEDs or a motor driver with no propeller. **Nothing powered near water.**

## Person 4 - Verification
1. Turn each requirement into a test in [tests/test-plan.md](../tests/test-plan.md) (procedure, how to measure, pass criterion).
2. Run the tests as soon as a function works: five repeats where practicable. Record every trial, also failures, in [tests/test-results.md](../tests/test-results.md).
3. Film at least one trial per test.

## Person 5 - Research, AI log, pitch
1. Research how harbour inspection is done today and what exists (Saab Autonomous Ocean Core, others) - **sources for every claim** in [research.md](research.md).
2. Keep the curated AI log in [ai-process.md](ai-process.md): especially one AI mistake and how we found and fixed it.
3. Draft the pitch in [presentation/pitch-outline.md](../presentation/pitch-outline.md); keep the "with more time/money we would..." list.

## Friday - Definition of Done
- [ ] Problem statement and target user validated by a mentor (quote recorded)
- [ ] Requirements v1 agreed (section 2)
- [ ] First editable CAD assembly
- [ ] Pi/ESP32 architecture and message protocol frozen
- [ ] At least one real or simulated sensor reading shown on the dashboard
- [ ] Test plan written; AI log started
- [ ] Preliminary pitch narrative

## Saturday - Definition of Done
- [ ] CAD reviewed and improved (v2, with the reason logged)
- [ ] Repeatable sensor-to-dashboard demo
- [ ] Verified motor-stop fault response (e-stop and comms loss)
- [ ] Five repeated tests of each core function where practicable
- [ ] Every requirement marked Pass / Fail / Not tested
- [ ] One real design problem and its correction documented
- [ ] Final pitch and recorded backup demo
- [ ] **Freeze** at the agreed time
