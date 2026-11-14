"""Dashboard configuration.

Override any value with a JSON file:
    python run_operator.py --config my_config.json
    {"tilt_warning_deg": 25, "imu_pitch_sign": -1}
"""
import json
from dataclasses import asdict, dataclass, fields


@dataclass
class Config:
    # Roll/pitch beyond this shows a tilt warning (a warning, not a stop).
    tilt_warning_deg: float = 30.0
    # IMU mounting: maps raw sensor values to the vessel frame
    # (vessel frame: roll + = starboard side down, pitch + = bow up, yaw rate + = turning to starboard).
    # The page also has Invert roll / pitch / yaw tick boxes for quick changes.
    imu_roll_sign: int = 1
    imu_pitch_sign: int = 1
    imu_yaw_sign: int = 1
    imu_swap_roll_pitch: bool = False   # True if the board's X axis points to the side instead of forward
    # Address of vision/viewer.py (annotated camera stream + detections), e.g. "http://127.0.0.1:8001".
    # None = no camera: the dashboard shows a placeholder. See vision/INTEGRATION.md.
    camera_viewer_url: str = None

    def validate(self):
        if self.tilt_warning_deg <= 0:
            raise ValueError("tilt_warning_deg must be positive")
        for name in ("imu_roll_sign", "imu_pitch_sign", "imu_yaw_sign"):
            if getattr(self, name) not in (1, -1):
                raise ValueError(f"{name} must be 1 or -1")
        url = self.camera_viewer_url
        if url is not None and not (isinstance(url, str) and url.startswith(("http://", "https://"))):
            raise ValueError("camera_viewer_url must be None or start with http:// or https://")
        if url is not None:
            rest = url.split("://", 1)[1]
            if "/" in rest.rstrip("/") or "?" in rest or "#" in rest or " " in url:
                raise ValueError("camera_viewer_url must be the viewer's base address, e.g. http://127.0.0.1:8001 "
                                 "(never the ESP32 :81/stream: it serves one client and only viewer.py may use it)")
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
        if d["camera_viewer_url"]:
            d["camera_viewer_url"] = d["camera_viewer_url"].rstrip("/")
        return d
