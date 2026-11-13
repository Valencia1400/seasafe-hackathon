"""SIMULATED control ESP32 (#2). Generates telemetry and enforces its own safety rules.

Nothing here is a real measurement. Every telemetry message carries "src": "SIM".
The physics is a deliberately crude kinematic toy (constant speed, yaw rate
proportional to rudder angle) so the demo looks plausible. It is NOT a vessel model.

Safety rules modelled (the real firmware must implement its own, independently):
- Motor is stopped at boot; run commands are ignored until a heartbeat has arrived.
- No heartbeat for HEARTBEAT_TIMEOUT_S -> latch COMMS_TIMEOUT, motor stopped.
- estop message -> latch ESTOP. Leak sensor wet -> latch LEAK. Motor stopped in both.
- While a fault is latched, motor and rudder commands are ignored.
- reset clears a latch only when its cause is gone (fresh heartbeat for COMMS_TIMEOUT,
  dry sensor for LEAK). Reset NEVER starts the motor.
This simulates the intended logic; it is not evidence that real hardware is safe.
"""
import math
import random

from . import protocol as p

START_LAT, START_LON = 56.1612, 15.5869   # arbitrary simulated start position
SPEED_MPS = 1.0                            # simulated speed when the motor runs
RUDDER_RATE_DPS = 60.0                     # simulated servo slew rate
YAW_PER_RUDDER_DEG = 0.5                   # (deg/s of yaw) per degree of rudder at full speed
TILT_PEAK_DEG, TILT_DURATION_S = 38.0, 4.0


class SimulatedESP32:
    def __init__(self, now, seed=1):
        self.boot = self.last_step = now
        self.rng = random.Random(seed)
        self.fault = None
        self.motor_run = False
        self.rudder_cmd = 0
        self.rudder = 0.0
        self.last_hb = None
        self.leak = False
        self.tilt_start = None
        self.heading = 0.0          # internal only, used to move the simulated position; never reported
        self.yaw_rate = 0.0
        self.lat, self.lon = START_LAT, START_LON
        self.seq = 0
        self.last_tel = None

    # -- helpers ----------------------------------------------------------
    def _hb_fresh(self, now):
        return self.last_hb is not None and now - self.last_hb <= p.HEARTBEAT_TIMEOUT_S

    def _latch(self, fault):
        if self.fault is None:
            self.fault = fault
            self.motor_run = False

    # -- scenario injection (simulation only) ---------------------------------
    def inject_tilt(self, now):
        self.tilt_start = now

    def set_leak(self, wet):
        self.leak = wet

    # -- commands from the laptop ---------------------------------------------
    def handle(self, msg, now):
        kind = msg.get("type")
        if kind == "hb":
            self.last_hb = now
        elif kind == "set_motor":
            self.motor_run = bool(msg.get("run")) and self.fault is None and self._hb_fresh(now)
        elif kind == "set_rudder":
            if self.fault is None:
                limit = p.RUDDER_LIMIT_DEG
                self.rudder_cmd = max(-limit, min(limit, float(msg.get("deg", 0))))
        elif kind == "estop":
            self._latch(p.FAULT_ESTOP)
        elif kind == "reset":
            cause_gone = {p.FAULT_ESTOP: True,
                          p.FAULT_COMMS: self._hb_fresh(now),
                          p.FAULT_LEAK: not self.leak}.get(self.fault, True)
            if self.fault is not None and cause_gone:
                self.fault = None
            self.motor_run = False

    # -- periodic work: safety checks, dynamics, telemetry -------------------
    def step(self, now):
        dt = max(0.0, now - self.last_step)
        self.last_step = now
        if self.leak:
            self._latch(p.FAULT_LEAK)
        if self.last_hb is not None and not self._hb_fresh(now):
            self._latch(p.FAULT_COMMS)
        # rudder servo slews toward its command
        delta = self.rudder_cmd - self.rudder
        self.rudder += max(-RUDDER_RATE_DPS * dt, min(RUDDER_RATE_DPS * dt, delta))
        speed = SPEED_MPS if self.motor_run else 0.0
        self.yaw_rate = YAW_PER_RUDDER_DEG * self.rudder * speed
        self.heading += self.yaw_rate * dt
        h = math.radians(self.heading)
        self.lat += speed * math.cos(h) * dt / 111320.0
        self.lon += speed * math.sin(h) * dt / (111320.0 * math.cos(math.radians(self.lat)))
        if self.last_tel is None or now - self.last_tel >= p.TELEMETRY_PERIOD_S - 1e-9:
            self.last_tel = now
            return [self._telemetry(now)]
        return []

    def _tilt(self, now):
        if self.tilt_start is None:
            return 0.0
        t = now - self.tilt_start
        if t > TILT_DURATION_S:
            self.tilt_start = None
            return 0.0
        # smooth bump: above the 30 deg warning limit for about 2 s, so 5 Hz telemetry cannot miss it
        return TILT_PEAK_DEG * math.sin(math.pi * t / TILT_DURATION_S)

    def _telemetry(self, now):
        t = now - self.boot
        noise = lambda s: self.rng.uniform(-s, s)
        tilt = self._tilt(now)
        self.seq += 1
        return {
            "type": "telemetry", "src": "SIM", "seq": self.seq, "t_ms": int(t * 1000),
            "imu": {"roll_deg": round(tilt + 1.5 * math.sin(t * 0.9) + noise(0.3), 1),
                    "pitch_deg": round(0.4 * tilt + 0.8 * math.sin(t * 0.6 + 1.0) + noise(0.3), 1),
                    "yaw_rate_dps": round(self.yaw_rate + noise(0.2), 1)},
            "gps": {"valid": True, "lat": round(self.lat, 6), "lon": round(self.lon, 6)},
            "motor": {"running": self.motor_run},
            "rudder": {"command_deg": self.rudder_cmd, "angle_deg": round(self.rudder, 1)},
            "leak": self.leak,
            "fault": self.fault,
            "comms": "OK" if self._hb_fresh(now) else "TIMEOUT",
        }
