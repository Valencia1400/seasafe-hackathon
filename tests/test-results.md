# Evidence and verification status

Documentation review baseline: GitHub a86eb17, 14 November 2026. Sources below distinguish repository-reported tests from checks independently rerun during review. No hardware was available in the review environment.

| Area | Evidence | Status / limitation |
|---|---|---|
| Current dashboard | `python -m unittest discover -s tests -v`: 40 tests passed during review | Software-tested with stand-in ESP32/mock viewer; no physical actuation proof |
| Vision parser | Review run could not import cv2 | Not rerun successfully in this environment; missing dependency, not a demonstrated product failure |
| Control firmware | Firmware README reports 79 host checks and compilation | Reported software tests; not independently rebuilt in this review |
| Camera chain | Commits 4cc3389 and f94fcfa; vision/INTEGRATION.md | Earlier real-camera chain reported; performance depends on build/network |
| Detection scope | Commit 02601ec reports 64-image testing and removal of weak classes | Controlled-image evidence, not harbour accuracy |
| Latest UDP camera option | Commit 4300b86 | Compiled and software-tested as reported; not yet board-tested |
| Control ESP32/IMU dashboard connection | Commit 06a3305 reports connection/live attitude | Conflicts with Heritage's separate report; final board/build unresolved |
| Motors, rudder and physical stop response | Current dashboard README says not bench-tested | Unverified on final integrated hardware |
| GPS | Heritage reports initial NMEA reception, later errors, no fix | No verified stable position fix |
| Mechanical vessel | Team reports printed assembly | CAD files/measurements and water-trial evidence absent here |
| AI correction example | docs/ai-process.md AI-001 | Historical simulator result; not current physical stop timing |

## Preserved historical record

The [original test results](../docs/history/test-results.md) were an unfilled requirement checklist. They are preserved rather than retroactively marked passed. Historical counts such as 14, 58 or 60 tests refer to earlier code versions; they are not the current dashboard suite count.

## Limitations

No demonstrated water operation, sealing, buoyancy, full-load propulsion, field inspection accuracy or time/cost savings. No verified customer interview is recorded. Hardware and safety sign-off remain pending the [electronics reconciliation](../docs/integration-status.md).
