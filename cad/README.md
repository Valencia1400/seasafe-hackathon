# CAD - Owner: Person 1 (support: Person 4)

Requirements R2, R3 (and R12 if a part is printed). Layout and interfaces: [docs/architecture.md](../docs/architecture.md).

## The assembly
- Two hulls joined by a deck (catamaran: stable platform, space for a central bay).
- Sealed electronics bay: control ESP32, motor driver, battery, GPS receiver.
- Camera ESP32 with a clear forward view (window/sealing).
- **One** propeller mount for the DC motor.
- **Rear rudder** with a servo mount and linkage (steering only; it does not stabilise roll/pitch).
- Swappable sensor bay at the bow with a standard interface.

## Tooling
Parametric (OpenSCAD lets AI edit the model as code and every change is a git diff; Fusion/FreeCAD/Onshape also fine). Keep the parameter table below current.

## Files
- `models/` - source files.
- `exports/` - STEP/STL, exploded-view image, geometry-check screenshots. Versioned names (`seaguardian_v1`, `_v2`).

## Parameter table
| Parameter | Meaning | v1 | v2 | Why changed |
|---|---|---|---|---|
| hull_length | | | | |
| hull_spacing | | | | |
| bay_inner_lwh | Electronics bay inner size (from P2's component list) | | | |
| sensor_bay_lwh | Sensor bay interface size | | | |
| clearance | Component clearance (target >= 3 mm, R3) | | | |

## Geometry check (Person 4 can verify)
- [ ] Every component from docs/components.md placed as a simple box at its real size
- [ ] Clearance >= 3 mm everywhere, or the exception noted
- [ ] Cable route from sensor bay to electronics bay shown
- [ ] Exploded view exported to `exports/`

## Iteration log
| Version | Date/time | Change | Reason (test or review finding) | AI used? | Checked by |
|---|---|---|---|---|---|
| v1 | | | | | |
