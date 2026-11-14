"""Operator console: the event log and the warnings shown on the page.

Everything here comes from real equipment: the control ESP32 (boatlink.py) and
the camera viewer (camera.py). There is no simulated data. It knows nothing
about HTTP or HTML.
"""
import threading
import time

from .config import Config


class OperatorConsole:
    def __init__(self, config=None, camera=None, boat=None, wall=time.time):
        self._wall = wall
        self._lock = threading.Lock()
        self.cfg = (config or Config()).validate()
        self.camera = camera        # optional CameraMonitor; never part of the motor path
        self.boat = boat            # optional BoatLink
        self.events = []
        self._last = {}             # last seen flags from the ESP32, to log each change once
        self.log("Dashboard started. Waiting for the boat ESP32 to connect.")

    def log(self, text, level="info"):
        with self._lock:
            self.events.append({"time": self._wall(), "level": level, "text": text})
            del self.events[:-200]

    def _changed(self, key, value):
        old = self._last.get(key)
        self._last[key] = value
        return old is not None and old != value

    def on_telemetry(self, msg):
        """Called for every telemetry frame from the ESP32: log state changes once."""
        sys_, motors, imu = msg.get("sys") or {}, msg.get("motors") or {}, msg.get("imu") or {}
        estop, failsafe, armed, imu_ok = bool(sys_.get("estop")), bool(sys_.get("failsafe")), bool(motors.get("armed")), bool(imu.get("ok"))
        if self._changed("estop", estop):
            self.log("Boat reports EMERGENCY STOP latched; motors off" if estop else "Boat emergency stop released (still disarmed)",
                     "fault" if estop else "info")
        if self._changed("failsafe", failsafe) and failsafe:
            self.log("Boat watchdog stopped the motors: no command for 1.0 s", "warn")
        if self._changed("armed", armed):
            self.log("Motors ARMED" if armed else "Motors disarmed", "warn" if armed else "info")
        if self._changed("imu_ok", imu_ok):
            self.log("IMU answering" if imu_ok else "IMU stopped answering (check SDA 21, SCL 22, 3V3, GND)", "info" if imu_ok else "warn")
        values = [v for v in (imu.get("roll"), imu.get("pitch")) if isinstance(v, (int, float))]
        tilted = bool(values) and max(abs(v) for v in values) > self.cfg.tilt_warning_deg
        if self._changed("tilt", tilted):
            self.log(f"TILT WARNING: roll {imu.get('roll')} deg, pitch {imu.get('pitch')} deg" if tilted else "Tilt back within limits",
                     "warn" if tilted else "info")

    def snapshot(self):
        cam = self.camera.snapshot() if self.camera else {"configured": False, "viewer_url": None, "status": "NOT_CONFIGURED"}
        boat = self.boat.snapshot() if self.boat else {"connected": False, "telemetry": None}
        t = boat["telemetry"] or {}
        sys_, imu, gps = t.get("sys") or {}, t.get("imu") or {}, t.get("gps") or {}
        warnings = []
        if not boat["connected"]:
            warnings.append("BOAT ESP32 NOT CONNECTED")
        else:
            if sys_.get("estop"):
                warnings.append("EMERGENCY STOP ACTIVE")
            if sys_.get("failsafe"):
                warnings.append("WATCHDOG STOP: no command reached the boat for 1.0 s")
            if not imu.get("ok"):
                warnings.append("IMU NOT ANSWERING")
            if self._last.get("tilt"):
                warnings.append("TILT WARNING: roll or pitch beyond the limit")
            if gps.get("receiving") and not gps.get("fix"):
                warnings.append("GPS: NO FIX")
        if cam["status"] in ("CAMERA_DOWN", "VIEWER_UNREACHABLE", "STALE", "BAD_RESPONSE"):
            warnings.append("CAMERA: " + cam["status"].replace("_", " ") + " (motor control unaffected)")
        with self._lock:
            events = self.events[-60:]
        return {"mode": "HARDWARE", "boat_connected": boat["connected"], "estop": bool(sys_.get("estop")),
                "warnings": warnings, "events": events, "camera": cam, "config": self.cfg.to_dict()}
