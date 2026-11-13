"""Dashboard configuration: every hardware-dependent number lives here.

NOTHING in this file is a confirmed hardware specification. Values marked
PLACEHOLDER are only there so the simulation runs; they must be replaced when
the team (CAD developer + electrical engineer) confirms the real mechanism and
wiring. The dashboard shows which values are still unconfirmed.

Override any value with a JSON file:
    python run_operator.py --config my_config.json
    {"rudder_limit_deg": 25, "imu_yaw_sign": -1}
"""
import json
from dataclasses import asdict, dataclass, fields

# Values still waiting for a team decision (shown as UNCONFIRMED on the dashboard).
UNCONFIRMED = (
    "rudder_limit_deg", "throttle_run", "throttle_max",
    "imu_roll_sign", "imu_pitch_sign", "imu_yaw_sign", "imu_swap_roll_pitch",
    "rudder_centre_on_stop",
)


@dataclass
class Config:
    # Rear rudder travel each way, in degrees. PLACEHOLDER: depends on the servo mount and linkage (P1 + P2).
    rudder_limit_deg: float = 30.0
    # Throttle (0..1) the SIMULATED mission uses while RUNNING. PLACEHOLDER: depends on motor + driver (P2).
    throttle_run: float = 0.4
    # Highest throttle the dashboard will ever command (0..1). PLACEHOLDER.
    throttle_max: float = 1.0
    # Roll/pitch beyond this shows a tilt warning. Value from docs/architecture.md (R6); a warning, not a stop.
    tilt_warning_deg: float = 30.0
    # Proposed in docs/architecture.md: the rudder returns to centre on a stop state. Not agreed yet.
    rudder_centre_on_stop: bool = True
    # IMU mounting: maps raw sensor values to the vessel frame
    # (vessel frame: roll + = starboard side down, pitch + = bow up, yaw rate + = turning to starboard).
    # Identity until CAD confirms how the IMU is mounted.
    imu_roll_sign: int = 1
    imu_pitch_sign: int = 1
    imu_yaw_sign: int = 1
    imu_swap_roll_pitch: bool = False   # True if the board's X axis points to the side instead of forward

    def validate(self):
        if not 0 < self.rudder_limit_deg <= 90:
            raise ValueError("rudder_limit_deg must be in (0, 90]")
        if not 0 <= self.throttle_run <= self.throttle_max <= 1:
            raise ValueError("need 0 <= throttle_run <= throttle_max <= 1")
        if self.tilt_warning_deg <= 0:
            raise ValueError("tilt_warning_deg must be positive")
        for name in ("imu_roll_sign", "imu_pitch_sign", "imu_yaw_sign"):
            if getattr(self, name) not in (1, -1):
                raise ValueError(f"{name} must be 1 or -1")
        return self

    @classmethod
    def from_json(cls, path):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        known = {f.name for f in fields(cls)}
        unknown = set(data) - known
        if unknown:
            raise ValueError(f"Unknown config keys: {', '.join(sorted(unknown))}")
        return cls(**data).validate()

    def to_dict(self):
        d = asdict(self)
        d["unconfirmed"] = list(UNCONFIRMED)
        return d

    def imu_to_vessel(self, roll, pitch, yaw_rate):
        """Apply the mounting orientation. None (sensor missing) stays None."""
        if self.imu_swap_roll_pitch:
            roll, pitch = pitch, roll
        sign = lambda v, s: None if v is None else round(v * s, 1)
        return {"roll": sign(roll, self.imu_roll_sign),
                "pitch": sign(pitch, self.imu_pitch_sign),
                "yaw_rate": sign(yaw_rate, self.imu_yaw_sign)}
