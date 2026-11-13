"""SIMULATED control ESP32 (#2). Generates telemetry and enforces its own safety rules.

Nothing here is a real measurement. Every telemetry message carries "src": "SIM".
The physics is a deliberately crude toy (speed proportional to throttle, yaw rate
proportional to rudder angle and speed) so the demo looks plausible. It is NOT a
vessel model and uses no real hardware numbers.

Safety rules modelled (they follow docs/architecture.md; the real firmware must
implement and prove its own, independently of this file):
- Motor is stopped at boot; commands are ignored until the first heartbeat.
- After the first heartbeat, no heartbeat for HEARTBEAT_TIMEOUT_S -> COMMLOST.
- estop -> ESTOP. Leak sensor wet -> LEAK.
- In every state except OK the throttle is 0 and commands are ignored
  (and the rudder is centred, if config.rudder_centre_on_stop, which is only proposed).
- reset leaves a stop state only when the cause is gone (fresh heartbeat for
  COMMLOST, dry sensor for LEAK). Reset NEVER starts the motor.
"""
import math
import random

from . import protocol as p
from .config import Config

START_LAT, START_LON = 56.1612, 15.5869   # arbitrary simulated start position
SPEED_AT_FULL_THROTTLE = 2.0              # simulated m/s at throttle 1.0 (toy value)
RUDDER_RATE_DPS = 60.0                    # simulated servo slew rate (toy value)
YAW_PER_RUDDER_DEG = 0.5                  # (deg/s of yaw) per degree of rudder at 1 m/s (toy value)
TILT_PEAK_DEG, TILT_DURATION_S = 38.0, 4.0


class SimulatedESP32:
    def __init__(self, now, config=None, seed=1):
        self.cfg = config or Config()
        self.boot = self.last_step = now
        self.rng = random.Random(seed)
        self.state = p.OK
        self.thr = 0.0
        self.rud_cmd = 0.0
        self.rud = 0.0
        self.last_hb = None
        self.leak = False
        self.fix = True
        self.tilt_start = None
        self.heading = 0.0          # internal only, used to move the simulated position; never reported
        self.yaw_rate = 0.0
        self.lat, self.lon = START_LAT, START_LON
        self.seq = 0
        self.last_tel = None

    # -- helpers ----------------------------------------------------------
    def _hb_fresh(self, now):
        return self.last_hb is not None and now - self.last_hb <= p.HEARTBEAT_TIMEOUT_S

    def _enter(self, state):
        if self.state == p.OK:
            self.state = state
            self.thr = 0.0
            if self.cfg.rudder_centre_on_stop:
                self.rud_cmd = 0.0

    # -- scenario injection (simulation only) ---------------------------------
    def inject_tilt(self, now):
        self.tilt_start = now

    def set_leak(self, wet):
        self.leak = wet

    def set_fix(self, has_fix):
        self.fix = has_fix

    # -- messages from the laptop ---------------------------------------------
    def handle(self, msg, now):
        kind = msg.get("t")
        if kind == "hb":
            self.last_hb = now
        elif kind == "cmd":
            if self.state == p.OK and self.last_hb is not None:
                self.thr = max(0.0, min(self.cfg.throttle_max, float(msg.get("thr", 0))))
                lim = self.cfg.rudder_limit_deg
                self.rud_cmd = max(-lim, min(lim, float(msg.get("rud", 0))))
        elif kind == "estop":
            self._enter(p.ESTOP)
        elif kind == "reset":
            cause_gone = {p.ESTOP: True, p.COMMLOST: self._hb_fresh(now), p.LEAK: not self.leak}.get(self.state, True)
            if self.state != p.OK and cause_gone:
                self.state = p.OK
            self.thr = 0.0

    # -- periodic work: safety checks, dynamics, telemetry -------------------
    def step(self, now):
        dt = max(0.0, now - self.last_step)
        self.last_step = now
        if self.leak:
            self._enter(p.LEAK)
        if self.last_hb is not None and not self._hb_fresh(now):
            self._enter(p.COMMLOST)
        delta = self.rud_cmd - self.rud
        self.rud += max(-RUDDER_RATE_DPS * dt, min(RUDDER_RATE_DPS * dt, delta))
        speed = SPEED_AT_FULL_THROTTLE * self.thr
        self.yaw_rate = YAW_PER_RUDDER_DEG * self.rud * speed
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
            "t": "tel", "src": "SIM", "seq": self.seq, "ms": int(t * 1000),
            "roll": round(tilt + 1.5 * math.sin(t * 0.9) + noise(0.3), 1),
            "pitch": round(0.4 * tilt + 0.8 * math.sin(t * 0.6 + 1.0) + noise(0.3), 1),
            "gz": round(self.yaw_rate + noise(0.2), 1),
            "lat": round(self.lat, 6) if self.fix else None,
            "lon": round(self.lon, 6) if self.fix else None,
            "fix": 1 if self.fix else 0,
            "thr": round(self.thr, 2), "rud": round(self.rud, 1),
            "leak": 1 if self.leak else 0,
            "state": self.state,
        }
