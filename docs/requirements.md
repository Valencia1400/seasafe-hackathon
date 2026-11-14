# Scope and acceptance criteria

Challenge and rubric are team-provided notes, not a substitute for the organizer's official instructions.

| Jury criterion | Weight | Evidence focus |
|---|---|---|
| Problem understanding | 20% | Specific harbour user and sourced problem evidence |
| User value | 20% | Useful preliminary observations; no unmeasured savings claims |
| Feasibility | 15% | Component choices, risks and controlled next test |
| Technical quality | 15% | Working code, test records and honest hardware status |
| Innovation | 10% | Purposeful integration and human-verified AI-assisted engineering |
| Presentation | 10% | Clear demonstration and traceable evidence |
| Partner relevance | 10% | Maritime prototyping, sensing and control |

## Current acceptance goals

- A remotely supervised twin-hull surface platform with two propulsion motors and a separate rear rudder.
- Camera → laptop object detection → operator dashboard, with stale/unavailable data clearly labelled.
- Control ESP32 → laptop WebSocket telemetry and operator commands; no fabricated sensor readings.
- Physically verified motor-stop behaviour and mechanically safe rudder travel before powered vessel trials.
- Traceable AI contributions, human corrections and test outcomes.
- Clear separation between physical prototype, visualization and future capabilities.

These goals are not all achieved. See [verification status](../tests/test-results.md). The [original numbered requirements](history/requirements.md) remain available to interpret historical AI logs; obsolete sensor, simulator and steering requirements are not silently treated as implemented.

No autonomous waypoint navigation, structural-damage diagnosis, certified safety, proven savings or validated swappable-payload performance is claimed.
