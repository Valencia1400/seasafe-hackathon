# Architecture and message protocol

Owners: Person 2 (both ESP32s, safety) and Person 3 (laptop dashboard). **Freeze the protocol on Friday** so both sides can be built in parallel; any change later goes in decisions.md.

## System overview
```
 [Laptop]  operator dashboard + simulated mission + event log      (dashboard/)
   |
   |-- Wi-Fi (planned) --> [ESP32 #1 - CAMERA]  live video for visual inspection
   |
   '-- USB serial today (Wi-Fi planned for an untethered boat), 115200 baud, JSON lines
        |
       [ESP32 #2 - CONTROL]  sensors + SAFETY + propulsion + steering   (electronics/firmware/)
         |-- IMU (roll, pitch, yaw rate)
         |-- GPS/GNSS receiver (position)
         |-- Pressure sensor (atmospheric pressure, hPa - label it as such)
         |-- Leak sensor input
         |-- Motor driver --> one DC motor --> propeller (bench: no propeller)
         |-- Servo --> rear rudder (steering / yaw)
         |-- E-stop button + safety state machine
         '-- Optional: P controller on yaw rate -> rudder (PID = stretch)
```
There is **no Raspberry Pi** and **no voice control** in the design (decision D-007).

**Status of each part (keep honest):**
| Part | Status |
|---|---|
| Two ESP32 boards (camera + control), one DC motor, one rudder servo | Confirmed hardware choice |
| Laptop dashboard, simulated mission, simulator | Implemented in `dashboard/` (simulator tested, see dashboard/README.md) |
| Control ESP32 firmware: telemetry, heartbeat, e-stop, leak, comms-loss stop | Written, not yet run on hardware |
| Camera stream to the dashboard | Planned, not implemented |
| GPS reading and coordinates on the dashboard | Planned, not implemented |
| Rudder servo command | Planned, not implemented (current code still has two motor outputs `l`/`r`, see "Protocol change needed") |
| P / PID rudder control | Optional, not implemented |

**Design rules:**
- The control ESP32 never needs the laptop to be safe. If the laptop crashes, freezes or the link is cut, the ESP32 stops the propulsion motor by itself. The laptop is never the only safety enforcement point.
- E-stop has the highest priority, above any operator or controller command.
- The motor and the servo are powered through a motor driver / their own supply, never directly from ESP32 GPIO pins; common ground.

**What the sensors can and cannot tell us:**
- The IMU gives roll, pitch and **yaw rate** (how fast the boat turns). A standard 6-axis IMU does **not** give drift-free absolute heading.
- GPS gives **position**. It does not give a reliable heading when the boat is stationary (only course over ground while moving), and position alone is not autonomous navigation.
- The rear rudder steers (yaw). It does **not** stabilise roll or pitch - we do not claim automatic roll/pitch correction.

## Messages (JSON lines)
Laptop -> control ESP32
| Message | Example | Meaning |
|---|---|---|
| Heartbeat | `{"t":"hb","seq":42}` | Sent every 200 ms. Missing for 1.0 s = comms lost |
| Motor command | `{"t":"cmd","l":0.3,"r":0.3}` | Motor demand -1.0 ... 1.0. Ignored while in a stop state |
| Emergency stop | `{"t":"estop"}` | Operator e-stop |
| Reset | `{"t":"reset"}` | Operator clears a stop state (only if the fault is gone) |

Control ESP32 -> laptop (telemetry, 5-10 Hz)
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

Events ESP32 -> laptop: `{"t":"evt","ms":605200,"evt":"COMMLOST"}` whenever the state changes.

### Protocol change needed (PROPOSED - Person 2 + Person 3 must agree before coding)
The implemented protocol above still uses two motor outputs `l`/`r` from the earlier two-motor assumption. The confirmed hardware is **one propulsion motor + one rudder servo**, so we propose (not implemented yet):
- Command: `{"t":"cmd","thr":0.3,"rud":-10}` - `thr` propulsion 0.0 ... 1.0 (reverse only if the driver supports it), `rud` rudder angle in degrees (limits set by Person 1 + Person 2 from the mechanism).
- Telemetry adds: `thr`, `rud` (applied values), `gz` (yaw rate, deg/s), `lat`, `lon`, `fix` (0/1). Missing sensors are sent as `null`, as today.
- Safety: in every stop state `thr` = 0 (same rules and timings as below, unchanged). Proposed: rudder returns to centre on a stop.
- Camera: ESP32 #1 serves its own video stream on Wi-Fi; the dashboard shows it by URL. It is not part of the safety chain.

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
Tilt > 30 deg is a **warning** shown by the laptop dashboard (R6), not a stop, unless we decide otherwise (log it in decisions.md).

## Simulation
`dashboard/` includes a simulator that sends the same ESP32 telemetry, so the dashboard can be built before the hardware works. **Anything shown from the simulator is labelled SIMULATED on screen.**

## Mechanical layout (Person 1)
Two hulls joined by a deck; sealed electronics bay in the centre (control ESP32, motor driver, battery, GPS); camera ESP32 with a clear view forward; **one** propeller mount for the DC motor; **rear rudder** with a servo mount and linkage; sensor bay at the bow with a standard interface (size, fixing, cable pass-through) so payloads can be swapped.

| Interface | Decision | Owner |
|---|---|---|
| Electronics bay inner size | | P1 <- P2 |
| Sensor bay interface (size, fixing, connector) | | P1 + P2 |
| Propulsion mount (motor diameter, fixing, shaft/propeller position) | | P1 <- P2 |
| Rudder + servo mount (servo size, linkage, angle limits) | | P1 + P2 |
| Camera mount (field of view, window/sealing) | | P1 + P2 |
| GPS antenna position (needs open sky view) | | P1 + P2 |
| Cable pass-through / sealing approach | | P1 |
