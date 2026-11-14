# Jury questions and factual answers

| Question | Answer |
|---|---|
| Who is it for? | Harbour maintenance and operations personnel needing preliminary observations. Direct user validation is still needed. |
| Is it autonomous? | No demonstrated autonomous navigation. The current dashboard provides operator commands and telemetry. |
| Where does detection run? | On the laptop; the camera ESP32 supplies images. |
| Does it detect damage? | No. It detects selected visible object classes for operator review. |
| What physically works? | Camera tests are documented; control-board reports differ between builds. Consult the evidence table rather than claiming full integration. |
| Does it stop safely? | Stop/watchdog logic is implemented and software-tested; final physical stop behaviour is unverified. |
| What did AI contribute? | Code, tests, documentation and visualization, with documented human review and corrections. |
| What did the team correct? | AI-001 records a wrong timeout-test assumption and missing-IMU handling; later detection tests narrowed the default classes. |
| What is innovative? | A problem-focused integration and documented AI-assisted engineering process; we do not claim to have invented autonomous boats or vision models. |
| What happens next? | Resolve firmware differences, record controlled bench results, validate the hull in water and interview harbour operators. |

[Evidence](../tests/test-results.md) · [AI log](../docs/ai-process.md) · [Demo guide](demo-script.md)
