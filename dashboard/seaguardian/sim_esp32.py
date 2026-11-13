"""A SIMULATED ESP32 that follows the same safety rules as the real firmware.

Used to build and test the Pi software without hardware. Every telemetry
message carries "src": "SIM" so the dashboard can label it as simulated.

Safety rules (must match electronics/firmware and docs/architecture.md):
- Motors are 0 at boot, and motor commands are ignored until the first heartbeat.
- After the first heartbeat, no heartbeat for HEARTBEAT_TIMEOUT_S -> COMMLOST.
- "estop" message -> ESTOP. Leak input -> LEAK.
- In every state except OK the motor output is 0 and commands are ignored.
- Only a "reset" returns to OK, and only when the cause is gone
  (heartbeat fresh again for COMMLOST, leak dry for LEAK).
"""
import math
import random

from . import protocol as p


class SimulatedESP32:
    def __init__(self, now: float, seed: int = 1):
        self.boot = now
        self.state = p.OK
        self.left = 0.0
        self.right = 0.0
        self.last_hb = None      # monotonic time of the last heartbeat, None until the first
        self.leak = False        # fault injection: leak sensor wet
        self.tilt_deg = 0.0      # fault injection: forced roll angle
        self.seq = 0
        self.outbox = []         # messages for the Pi, drained by the transport
        self._rng = random.Random(seed)

    # -- helpers ----------------------------------------------------------
    def _ms(self, now: float) -> int:
        return int((now - self.boot) * 1000)

    def _hb_fresh(self, now: float) -> bool:
        return self.last_hb is not None and now - self.last_hb <= p.HEARTBEAT_TIMEOUT_S

    def _enter(self, state: str, now: float):
        if state != self.state:
            self.state = state
            if state != p.OK:
                self.left = self.right = 0.0
            self.outbox.append({"t": "evt", "ms": self._ms(now), "evt": state, "src": "SIM"})

    # -- input from the Pi ------------------------------------------------
    def handle(self, msg: dict, now: float):
        kind = msg.get("t")
        if kind == "hb":
            self.last_hb = now
        elif kind == "cmd":
            if self.state == p.OK and self.last_hb is not None:
                self.left = max(-1.0, min(1.0, float(msg.get("l", 0))))
                self.right = max(-1.0, min(1.0, float(msg.get("r", 0))))
        elif kind == "estop":
            self._enter(p.ESTOP, now)
        elif kind == "reset":
            cause_gone = {
                p.ESTOP: True,
                p.COMMLOST: self._hb_fresh(now),
                p.LEAK: not self.leak,
            }.get(self.state, True)
            if self.state != p.OK and cause_gone:
                self._enter(p.OK, now)

    # -- periodic work: safety checks + telemetry ---------------------------
    def step(self, now: float, telemetry: bool = True):
        if self.state == p.OK:
            if self.leak:
                self._enter(p.LEAK, now)
            elif self.last_hb is not None and not self._hb_fresh(now):
                self._enter(p.COMMLOST, now)
        if telemetry:
            t = now - self.boot
            noise = lambda s: self._rng.uniform(-s, s)
            self.seq += 1
            self.outbox.append({
                "t": "tel", "seq": self.seq, "ms": self._ms(now),
                "roll": round(self.tilt_deg + 1.5 * math.sin(t * 0.9) + noise(0.3), 1),
                "pitch": round(0.8 * math.sin(t * 0.6 + 1.0) + noise(0.3), 1),
                "p_hpa": round(1013.2 + 0.2 * math.sin(t * 0.05) + noise(0.05), 1),
                "leak": 1 if self.leak else 0,
                "l": self.left, "r": self.right,
                "state": self.state, "src": "SIM",
            })

    def drain(self):
        out, self.outbox = self.outbox, []
        return out
