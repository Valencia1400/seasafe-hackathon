# CAD - Owner: Person 1 (support: Person 4)

## Tooling (proposed - see D-001 in docs/decisions.md; Person 1 confirms)
A **text-based parametric tool** (OpenSCAD proposed) so that: (a) AI can generate and edit the model as code, (b) every change is a readable git diff, (c) "change one parameter, re-export" can be shown live. If Person 1 prefers Fusion/FreeCAD/Onshape, keep the parameter table below and export STEP + STL.

## Files
- `models/` - source model (e.g. `seasafe_housing.scad`). Suggested parts: housing, lid, electronics module tray, ballast cup.
- `exports/` - STL (slicer) and STEP. Version the names: `housing_v1.stl`, `housing_v2.stl`. Never overwrite a version that was physically tested.

## Parameter table (mm / g) - fill in
| Parameter | Meaning | v1 | v2 | Why changed |
|---|---|---|---|---|
| module_w / module_l / module_h | Electronics module envelope (**from Person 2 before CAD freeze**) | ? | ? | |
| wall | Wall thickness | ? | ? | |
| outer_d | Housing outer diameter | ? | ? | |
| ballast_mass | Ballast in base (g) | ? | ? | |
| lid_clearance | Lid / tray fit clearance | ? | ? | |

## Printability checklist (Person 4 can verify)
- [ ] Wall thickness >= 2x nozzle width (ask the printer owner)
- [ ] Overhangs within printer limits or supports planned
- [ ] Fits the print bed; print time estimate noted
- [ ] Module removal needs no tools (or one named tool) and takes < 60 s (R4)
- [ ] Slicer preview inspected (R6); screenshot saved in `cad/exports/`
- [ ] 3D prints are not guaranteed watertight - plan a sealed dry compartment or accept it is not waterproof (docs/risks.md)

## Iteration log
| Version | Date/time | Change | Reason (requirement or test finding) | AI used? | Tested? |
|---|---|---|---|---|---|
| v1 | | | | | |
