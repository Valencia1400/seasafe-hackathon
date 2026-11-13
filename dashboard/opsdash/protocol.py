"""Message format between the laptop dashboard and the control ESP32 (#2).

DRAFT. This is OUR proposal, used by the simulator today. The real wire format
must be agreed with the electrical engineer (Person 2) before hardware mode.
Messages are plain dicts (JSON-serialisable), so the same dashboard code can
later receive them from a real ESP32 instead of the simulator.

Laptop -> controller
    {"type": "hb"}                              heartbeat, every HEARTBEAT_PERIOD_S
    {"type": "set_motor", "run": true|false}    DC propulsion motor on/off
    {"type": "set_rudder", "deg": -30..30}      rear rudder angle, + = starboard
    {"type": "estop"}                           latch an emergency stop
    {"type": "reset"}                           clear a latched fault (never starts the motor)

Controller -> laptop (telemetry, TELEMETRY_PERIOD_S)
    {"type": "telemetry", "src": "SIM", "seq": 12, "t_ms": 2400,
     "imu":   {"roll_deg": 1.2, "pitch_deg": -0.4, "yaw_rate_dps": 3.1},
     "gps":   {"valid": true, "lat": 56.1, "lon": 15.5},
     "motor": {"running": false},
     "rudder": {"command_deg": 0, "angle_deg": 0.0},
     "leak": false,
     "fault": null | "ESTOP" | "COMMS_TIMEOUT" | "LEAK",
     "comms": "OK" | "TIMEOUT"}

"src" is "SIM" for simulated data. Real firmware would send "ESP32".
Yaw rate is a rotation SPEED in degrees/second (+ = turning to starboard).
It is not a compass heading and the dashboard never shows one.
"""

HEARTBEAT_PERIOD_S = 0.2     # laptop sends a heartbeat this often
HEARTBEAT_TIMEOUT_S = 1.0    # controller stops the motor after this long without one
TELEMETRY_PERIOD_S = 0.2     # controller sends telemetry at 5 Hz
LINK_TIMEOUT_S = 1.0         # laptop: no telemetry for this long -> communication lost
RUDDER_LIMIT_DEG = 30        # mechanical/software limit of the rear rudder (assumed, to confirm with P1/P2)
TILT_WARNING_DEG = 30.0      # roll or pitch beyond this shows a tilt warning (assumed threshold)

FAULT_ESTOP, FAULT_COMMS, FAULT_LEAK = "ESTOP", "COMMS_TIMEOUT", "LEAK"
