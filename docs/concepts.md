# Historical concept selection

**Chosen: SeaGuardian** (decision D-002 in [decisions.md](decisions.md)). This page keeps the options we compared, because the jury wants to see *why* we chose.

## Why SeaGuardian
- Lands in MTC's sensor integration, automation/autonomy and safety areas, and their recent combat-systems focus (integrating sensors on a vessel).
- Every core function can be tested on a dry bench this weekend, with repeated measurements.
- Combines CAD, electronics, integration, verification and user research.
- Clear, honest scope: simulated supervised mission + real safety logic, not "an autonomous boat".

## Options we considered (all printable within hours)
| # | Option | Main MTC area | Why not chosen as the main concept |
|---|---|---|---|
| 1 | Self-aligning dock + battery swap for a drone/USV | Energy, autonomy | Close to the Copenhagen winner; high mechanical risk |
| 2 | Quick-release modular sensor mount | Sensor integration | Kept as SeaGuardian's swappable sensor bay |
| 3 | Parametric hull A/B test | Naval architecture | Needs water and print time; weaker live demo |
| 4 | Drone-droppable rescue capsule | Safety and rescue | Too close to the concept we dropped |
| 5 | Low-signature sensor mast cover | Signature management | Physics only an analogy (laser for radar) |

These are original selection notes, not current capability claims. See [current architecture](architecture.md) and [evidence](../tests/test-results.md).
