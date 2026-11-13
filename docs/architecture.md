# Architecture and message protocol

Owners: Person 2 (ESP32, safety) and Person 3 (Pi, dashboard). **Freeze the protocol on Friday** so both sides can be built in parallel; any change later goes in decisions.md.

## System overview
```
 Operator laptop / browser
        |  (Wi-Fi or Pi screen)
 [Raspberry Pi]  mission logic + dashboard + event log        (dashboard/)
        |  USB serial, 115200 baud, one JSON message per line
 [ESP32]  sensors + SAFETY + motor output                     (electronics/firmware/)
   |-- IMU (roll, pitch, motion)
   |-- Pressure sensor (atmospheric pressure, hPa - label it as such)
   |-- Leak sensor input
   '-- Motor outputs L/R (bench: LEDs or motor driver without propeller)
```

**Camera (separate board):** a XIAO ESP32S3 Sense streams video over Wi-Fi; `vision/viewer.py` runs object detection on it and serves the results to the dashboard. Endpoints and JSON: [vision/INTEGRATION.md](../vision/INTEGRATION.md). The camera has no part in the safety chain.

**Design rule:** the ESP32 never needs the Pi to be safe. If the Pi crashes, freezes or the cable is pulled, the ESP32 stops the motors by itself.

## Messages (JSON lines)
Pi -> ESP32
| Message | Example | Meaning |
|---|---|---|
| Heartbeat | `{"t":"hb","seq":42}` | Sent every 200 ms. Missing for 1.0 s = comms lost |
| Motor command | `{"t":"cmd","l":0.3,"r":0.3}` | Motor demand -1.0 ... 1.0. Ignored while in a stop state |
| Emergency stop | `{"t":"estop"}` | Operator e-stop |
| Reset | `{"t":"reset"}` | Operator clears a stop state (only if the fault is gone) |

ESP32 -> Pi (telemetry, 5-10 Hz)
```
{"t":"tel","seq":1201,"ms":605123,"roll":2.1,"pitch":-0.4,"p_hpa":1013.2,"leak":0,"l":0.0,"r":0.0,"state":"OK"}
```
| Field | Meaning |
|---|---|
| `seq` | Counter; gaps = lost messages (used for R4) |
| `ms` | ESP32 uptime in ms (used to time responses) |
| `roll`, `pitch` | Degrees from the IMU |
| `p_hpa` | Atmospheric pressure, hPa |
| `leak` | 0 dry, 1 wet |
| `l`, `r` | Motor output actually applied (after safety) |
| `state` | `OK`, `ESTOP`, `COMMLOST`, `LEAK` |

Events ESP32 -> Pi: `{"t":"evt","ms":605200,"evt":"COMMLOST"}` whenever the state changes.

Additions (implemented in the code):
- A sensor that is not connected is sent as `null` (e.g. `"roll":null`).
- The simulator adds `"src":"SIM"` to every message; the dashboard then shows SIMULATED.
- Motor commands are ignored until the first heartbeat after boot; the timeout is only armed after that first heartbeat (so a booting ESP32 does not start in COMMLOST).
- The comms-loss stop comes 0.8-1.05 s after the link is cut, because the timeout counts from the last heartbeat (sent every 200 ms).
- ESTOP from the physical button can only be reset once the button is released.

## ESP32 safety state machine
```
 OK --estop msg--------> ESTOP    --reset (operator)--> OK
 OK --no hb for 1.0 s--> COMMLOST --hb back + reset---> OK
 OK --leak = 1---------> LEAK     --leak = 0 + reset--> OK
 In every state except OK: motor output = 0, motor commands ignored.
```
Tilt > 30 deg is a **warning** shown by the Pi (R6), not a stop, unless we decide otherwise (log it in decisions.md).

## Simulation
`dashboard/` includes a simulator that sends the same ESP32 telemetry, so the dashboard can be built before the hardware works. **Anything shown from the simulator is labelled SIMULATED on screen.**

## Mechanical layout (Person 1)
Two hulls joined by a deck; sealed electronics bay in the centre (Pi, ESP32, battery, motor drivers); one propulsion mount per hull; sensor bay at the bow with a standard interface (size, fixing, cable pass-through) so payloads can be swapped.

| Interface | Decision | Owner |
|---|---|---|
| Electronics bay inner size | | P1 <- P2 |
| Sensor bay interface (size, fixing, connector) | | P1 + P2 |
| Propulsion mount (motor diameter, fixing) | | P1 <- P2 |
| Cable pass-through / sealing approach | | P1 |
