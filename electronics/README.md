# Electronics - Owner: Person 2 (support: Person 3)

## Scope
Essential: **button -> LED flash**, battery powered, on a **removable module** with a defined interface.
Optional (only after essentials pass): ESP32 wireless alert, water-contact sensor, battery indicator.

## First deliverable (Friday, early): module envelope
Send Person 1 the module dimensions, mass and connector position **before CAD freeze**.

| Item | Value | Source / measured by |
|---|---|---|
| Module length x width x height (mm) | ? | |
| Module mass (g) | ? | |
| Battery type / holder | ? | |
| How the module connects to the housing | ? | |
| Button type and position | ? | |
| LED type and resistor value | ? | |

## Safety rules
- **Exposed or unverified electronics never go in water.** Flotation tests use an **unpowered dummy module of the same mass**.
- Use a low-voltage primary battery pack (e.g. AAA/AA cells). **No loose LiPo/Li-ion cells in or near water tests.**
- Current-limiting resistor on every LED; check battery polarity before connecting.
- Person 2 signs off any powered test in the log below.

## Folders
- `firmware/` - sketches. Commit only code that has been run on hardware; note board and result below.
- `wiring/` - schematic, breadboard photo or pin table.

## Test log (what was actually run)
| Date/time | What | Board | Result | Photo/video |
|---|---|---|---|---|
| | | | | |
