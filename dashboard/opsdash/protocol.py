"""Message format between the laptop dashboard and the control ESP32 (#2).

This follows the PROPOSED one-motor + rudder protocol in docs/architecture.md
("Protocol change needed"). It is NOT agreed or implemented in firmware yet:
Person 2 and Person 3 must confirm it before hardware mode. One JSON object
per message, so the same dashboard code can later read a real ESP32.

Laptop -> controller
    {"t":"hb","seq":42}                    heartbeat every HEARTBEAT_PERIOD_S
    {"t":"cmd","thr":0.4,"rud":-10}        throttle 0..1, rudder angle in degrees (+ = starboard)
    {"t":"estop"}                          latch an emergency stop
    {"t":"reset"}                          clear a stop state (never starts the motor)

Controller -> laptop (telemetry)
    {"t":"tel","src":"SIM","seq":1201,"ms":605123,
     "roll":2.1,"pitch":-0.4,"gz":3.1,      raw IMU values, degrees and degrees/second
     "lat":56.1,"lon":15.5,"fix":1,         GPS position and fix (0/1)
     "thr":0.4,"rud":-9.6,                  throttle and rudder angle actually applied
     "leak":0,"state":"OK"}                 state: OK | ESTOP | COMMLOST | LEAK

A sensor that is not available is sent as null. "src" is "SIM" for simulated data.
"gz" is a rotation SPEED (yaw rate), not a compass heading. Raw IMU values are
converted to the vessel frame by the dashboard using the IMU mounting in config.py.
Not modelled yet: "evt" messages, pressure ("p_hpa"), motor current.
"""

HEARTBEAT_PERIOD_S = 0.2     # laptop sends a heartbeat this often (docs/architecture.md)
HEARTBEAT_TIMEOUT_S = 1.0    # controller stops the motor after this long without one (docs/architecture.md)
TELEMETRY_PERIOD_S = 0.2     # simulated telemetry rate (architecture says 5-10 Hz)
LINK_TIMEOUT_S = 1.0         # laptop: no telemetry for this long -> communication lost

OK, ESTOP, COMMLOST, LEAK = "OK", "ESTOP", "COMMLOST", "LEAK"
