# CAD - Owner: Person 1 (support: Person 4)

## Tooling
Prefer a **text-based parametric tool** (e.g. OpenSCAD) so that AI can generate and edit the model as code, every change is a readable git diff, and "change one parameter, re-export" can be shown live. Fusion/FreeCAD/Onshape is fine too: keep the parameter table and export STEP + STL.

## Fast-print rules (we need a part in hours, not days)
- Target print time **< 3 h** for v1; check the slicer estimate before printing.
- Flat bottom, few overhangs, no supports if possible; split big parts.
- Wall thickness >= 2x nozzle width (ask the printer owner).
- Print a small **test piece** first (a fit/tolerance test) if parts must fit together.

## Files
- `models/` - source model files.
- `exports/` - STL and STEP. Version the names: `part_v1.stl`, `part_v2.stl`. Never overwrite a version that was physically tested.

## Parameter table - fill in
| Parameter | Meaning | v1 | v2 | Why changed |
|---|---|---|---|---|
| | | | | |

## Printability checklist (Person 4 can verify)
- [ ] Fits the print bed; print time estimate noted
- [ ] Overhangs within printer limits or supports planned
- [ ] Slicer preview inspected; screenshot saved in `cad/exports/`

## Iteration log
| Version | Date/time | Change | Reason (requirement or test finding) | AI used? | Tested? |
|---|---|---|---|---|---|
| v1 | | | | | |
