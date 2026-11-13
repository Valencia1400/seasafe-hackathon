# Concept options and choice - Owner: Person 3 (with the whole team)

Goal from the brief: a self-chosen problem, taken as far as possible with AI, with the **path** shown (rationale, validation, problems, tools, team competencies). A working printed prototype is a bonus that lands well (Copenhagen winners: printed moving mechanism, live on stage).

Our filter for every idea: printable in < 3 h per part, demo works on a table, at least one sensor or technology we can show, one measurable test today or Saturday, and a v1 -> v2 improvement we can measure.

## The five options

### 1. Self-aligning dock + battery swap for a small drone or USV (energy, autonomy)
- **Problem:** small unmanned craft spend time and crew effort on charging; a dock that guides the craft in and swaps the battery keeps it operating.
- **Prototype:** printed funnel/cone dock that corrects misalignment, plus a slide-in battery cartridge with a latch. A servo or a hand crank pushes the old pack out.
- **Sensor/tech:** limit switch or hall sensor confirms "docked" and "battery locked"; LED shows state.
- **Test:** maximum misalignment the dock still corrects (mm, degrees); swap time; latch success over 10 tries.
- **v1 -> v2:** funnel angle or latch clearance changed after measured failures.
- **Risk:** closest to the Copenhagen winner - must clearly be *our* take (USV/boat side, not a copy). Mechanism tolerances.

### 2. Quick-release modular sensor mount for small vessels (sensor integration, combat systems)
- **Problem:** small craft need to switch sensors (camera, IMU, ultrasonic, antenna) per mission; each swap means tools and re-calibration.
- **Prototype:** a printed rail/bayonet mount on a mast section with a keyed, tool-less latch; two or three sensor "pods" that click in, in a fixed orientation.
- **Sensor/tech:** a real IMU or ultrasonic sensor in one pod, read by an Arduino/ESP32; the reading shows the pod sits at the same angle after every swap.
- **Test:** swap time (s); orientation repeatability after 10 swaps (degrees, measured by the IMU); does it hold when shaken.
- **v1 -> v2:** clearance and latch stiffness changed after measured wobble or angle error.
- **Risk:** low. Less "wow" than a moving mechanism unless the live sensor reading is shown.

### 3. Parametric hull A/B test (naval architecture)
- **Problem:** early hull choices are slow to compare; AI + parametric CAD can generate and test variants fast.
- **Prototype:** two or three small printed hulls from one parametric model (beam, deadrise or length changed).
- **Sensor/tech:** phone video tracking; a luggage scale or a constant-weight pull for tow tests; roll period from video.
- **Test:** time to cross a tub under the same pull; roll angle and recovery after a fixed tilt.
- **v1 -> v2:** a genuine measured design improvement - the strongest validation story of the five.
- **Risk:** needs water and space; hulls take print time; results are small-scale only.

### 4. Drone-droppable rescue capsule (safety and rescue)
- **Problem:** getting a flotation aid or a marker to a person in the water quickly.
- **Prototype:** a printed capsule that floats upright, with a servo or hook release that a drone could carry.
- **Sensor/tech:** servo release triggered by a button or a simple remote; optional water-contact LED.
- **Test:** release reliability (10 tries), floats upright, drop from a fixed height without breaking.
- **v1 -> v2:** latch or ballast changed after a failed release or tilt.
- **Risk:** very close to the concept we dropped; water + electronics need care.

### 5. Low-signature sensor mast cover (signature management)
- **Problem:** sensors on a mast reflect radar/light back toward the observer; faceted shapes deflect it away.
- **Prototype:** two printed covers for the same sensor - a round one and a faceted one designed with AI help.
- **Sensor/tech:** a laser pointer (stand-in for radar, clearly stated as an analogy) and a target screen or a light sensor next to the source measuring reflected light.
- **Test:** reflected intensity back to the source at several angles, round vs faceted.
- **v1 -> v2:** facet angles changed after the first measurement.
- **Risk:** the physics is an analogy, not real radar; judges in signature management will probe it, so be explicit about the limits.

## Scoring (1-5, fill in as a team - our pre-filled guess in brackets)
| Criterion | 1 Dock/swap | 2 Sensor mount | 3 Hull A/B | 4 Rescue capsule | 5 Signature cover |
|---|---|---|---|---|---|
| Fits MTC core areas | (5) | (5) | (5) | (4) | (5) |
| Printable today, < 3 h per part | (3) | (5) | (3) | (4) | (5) |
| Live table demo with a "wow" | (5) | (3) | (2) | (3) | (3) |
| Sensor / technology to show | (4) | (5) | (3) | (3) | (3) |
| Measurable test today/Saturday | (4) | (5) | (4) | (4) | (4) |
| Clear v1 -> v2 improvement | (4) | (4) | (5) | (3) | (4) |
| Uses all five competencies | (5) | (4) | (3) | (4) | (3) |
| **Total** | **(30)** | **(31)** | **(25)** | **(25)** | **(27)** |

## Decision
Record the final choice and the scores in [decisions.md](decisions.md) (D-004). Then write section 2 of [requirements.md](requirements.md).

## Running list for the pitch ending: "with more time, money or a test environment we would..."
- (add items as they come up during the weekend)
