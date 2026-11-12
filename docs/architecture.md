# Architecture

Keep this to one page. Update it when the design changes (and log why in decisions.md).

## System overview
```
 [Housing (printed, parametric)]
   |-- Ballast cup (low centre of gravity -> self-righting)
   |-- Electronics compartment (sealed, dry)
   |      '-- [Electronics MODULE - removable]
   |             |-- Battery pack
   |             |-- Button
   |             '-- LED (+ resistor) driven by MCU (Arduino/ESP32)
   '-- Lid / window (LED visible)
 (optional) ESP32 --Wi-Fi--> Laptop dashboard
```

## Module interface (the thing that makes it "modular")
Define and freeze on Friday: module envelope (L x W x H), mass, how it is retained (clip / thumbscrew / friction fit), how it connects electrically (e.g. 2-pin connector), button/LED position relative to the housing.

| Interface item | Decision | Owner |
|---|---|---|
| Envelope | | Person 2 -> Person 1 |
| Retention | | Person 1 |
| Electrical connector | | Person 2 |
| Seal (gasket / lid) | | Person 1 |

## Flotation logic (state assumptions, then measure)
- Total mass vs displaced water volume decides draft; **centre of gravity below centre of buoyancy** gives self-righting.
- Do a quick calculation Friday (mass, volume, expected draft) and compare prediction vs measurement in test-results.md. A prediction that is wrong, then corrected, is good evidence.

## Software (optional)
ESP32 firmware sends a local status message; dashboard shows Idle/ACTIVE. Not required for the minimum demo.

## Folder ownership
`cad/` P1, `electronics/` P2, `dashboard/` P3, `tests/` P4, `docs/` + `presentation/` P5 (decisions: anyone, via small edits).
