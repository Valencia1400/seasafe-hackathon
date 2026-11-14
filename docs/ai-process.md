# AI-assisted engineering evidence

AI contributed code, tests, documentation and visualization. A committed output is not proof that a human reviewed it or that hardware worked. Original prompts are retained where available; missing prompts are not reconstructed as historical facts.

## Historical verified record

The following entry describes an earlier simulator implementation. Its 14-test count and 842 ms observation do not describe the current dashboard or a physical motor stop.

### AI-001 - Dashboard software and simulator: wrong assumption about the comms-loss timing
- Time / person / task: Fri 13 Nov, Software/product lead with Claude Code (Fable 5.2), dashboard + ESP32 simulator
- AI tool + model: Claude Code, Claude Fable 5.2
- Prompt: "Write the ESP32 safety firmware and the dashboard with simulator" (following docs/architecture.md)
- Result: Python controller, simulated ESP32, dashboard, 13 unit tests; ESP32 Arduino firmware.
- Human verification: unit tests run with a fake clock; the dashboard run in simulator mode and driven through its API (mission start, tilt, link cut, reset).
- Errors / limitations found: 1 of 13 tests failed. The AI-written test expected the motor stop exactly 1.0 s after the link was cut, but the timeout counts from the **last heartbeat**, sent up to 0.2 s before the cut. Measured in the live run: stop 842 ms after the cut. The safety code was right; the AI's expectation (and our requirement wording) was too simple. A second issue found in review: a missing IMU (null values) would have crashed the tilt check.
- Changes made afterwards: test now expects the stop 0.8-1.05 s after the cut; timing explained in docs/architecture.md and dashboard/README.md; tilt check handles null values, with a new test (14 tests pass).
- Still unverified: the firmware has not been compiled or run on an ESP32.
- Linked: R8, R9, R11


## Additional commit evidence

| Activity | Commit | Evidence and limits |
|---|---|---|
| Camera connection correction | [4cc3389](https://github.com/Valencia1400/seasafe-hackathon/commit/4cc3389) | Reports hotspot-name correction and real-camera test |
| Camera integration validation | [8ca3cac](https://github.com/Valencia1400/seasafe-hackathon/commit/8ca3cac) | Mock-viewer freshness/validation tests |
| Narrowing weak detection classes | [02601ec](https://github.com/Valencia1400/seasafe-hackathon/commit/02601ec) | Reports 64-photo evaluation; not field accuracy |
| Control firmware integration | [703dfe1](https://github.com/Valencia1400/seasafe-hackathon/commit/703dfe1) | Stop-race/recovery fixes and reported host tests |
| Removing operational simulation | [06a3305](https://github.com/Valencia1400/seasafe-hackathon/commit/06a3305) | Real telemetry reported; final hardware identity needs reconciliation |
| Congested-network camera update | [4300b86](https://github.com/Valencia1400/seasafe-hackathon/commit/4300b86) | UDP code and software tests; board test pending |
| Photo-based visualization | [7d5904f](https://github.com/Valencia1400/seasafe-hackathon/commit/7d5904f) | Approximate Three.js model; not CAD validation |

These commits record AI co-authorship; model names are repository-recorded labels, not independently authenticated. Commit authorship does not establish who ran every test. Full original prompts for these entries are not present in the inspected raw-log directory.

The [electronics activity log](../electronics/firmware/seaguardian_revC/ACTIVITY_LOG.md) provides additional version-specific history. Heritage's separately supplied rev D history awaits reconciliation before inclusion.

New entries should state task, original prompt/reference, tool/model, output, human review, test, failure, correction, retest and linked commit. Keep failures and distinguish emulator, host and physical evidence.
