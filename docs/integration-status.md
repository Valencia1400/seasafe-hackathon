# Electronics reconciliation pending

Comparison: GitHub `a86eb17` versus Heritage's `SeaGuardian_revD.zip`, supplied 14 November 2026. The ZIP has not been merged. Its higher version string does not establish that every file is newer.

| Topic | GitHub | Heritage package | Required decision |
|---|---|---|---|
| Motor safety | Output mutex and repeated safe-state writes | Fixes absent | Preserve/review GitHub fixes |
| Endpoint | Port 8000, `/ws`, host in secrets.h | Port 5000, placeholder host in Config.h | Agree endpoint and private configuration |
| Battery | Two cells configured; monitor disabled | Three cells configured; monitor disabled | Confirm series wiring and fitted protection before changing |
| IMU missing at boot | Retried discovery | Task only started after successful initialization | Preserve recovery |
| Motor/network tuning | Gentler ramp and longer retry/heartbeat tolerances | Earlier settings | Confirm hardware-tested configuration |
| Live control telemetry | Repository reports real board/IMU connection | Heritage reports connection not achieved | Identify board, flashed build, date and server for each report |
| Servo travel | Dashboard ±6°; firmware wider | Procedure asks 45°/135° | Confirm mechanism limits before testing |

The proposed 3S power budget is calculated, not measured. Motor ratings/current, cell discharge rating, regulator and fuse choice remain unresolved. The L298N current rating is not an automatic current limiter. Include camera-board load if it shares the pack. Battery monitoring is disabled in both versions.

Historical BTS7960/2S/two-servo drawings in Heritage's package do not represent the intended L298N/3S/one-servo wiring. Rev B emulator tests do not verify the current Arduino hardware.

This documentation cleanup does not modify firmware settings, wiring or test claims. The next integration change must identify the exact flashed build and record its bench results.
