"""Operator console: connects the mission state machine to a (simulated) controller.

This is the application logic. It knows nothing about HTTP or HTML. Time is
passed in, so every scenario can be tested with a fake clock.

Data source: today `SimulatedESP32`. A future HARDWARE mode would feed real
telemetry into `_on_telemetry` and send commands over serial/Wi-Fi in `_send`;
the rest of this file should not need to change. Hardware mode is NOT implemented.
"""
import time

from . import mission as m
from . import protocol as p
from .config import Config
from .simulator import SimulatedESP32

TRACK_POINTS = 300


class OperatorConsole:
    def __init__(self, now, wall=time.time, config=None, camera=None):
        self._wall = wall
        self.cfg = (config or Config()).validate()
        self.camera = camera   # optional CameraMonitor; separate from the control path, never affects the mission
        self.restart(now)

    # -- (re)start the whole simulation --------------------------------------
    def restart(self, now):
        self.mission = m.MissionStateMachine(clock=self._wall)
        self.esp = SimulatedESP32(now, self.cfg)
        self.link_cut = False
        self.hb_seq = 0
        self.last_hb = None
        self.last_rx = None
        self.link_up = False
        self.telemetry = None
        self.last_state = p.OK
        self.tilt_warning = False
        self.rud_cmd = 0
        self.started_at = None
        self.track = []
        self.mission.log("Simulation started (SIMULATION MODE: all data is simulated)")

    # -- link to the controller ------------------------------------------------
    def _send(self, msg, now):
        """Laptop -> controller. A cut link drops the message."""
        if self.link_cut:
            return False
        self.esp.handle(msg, now)
        return True

    @property
    def thr_cmd(self):
        return self.cfg.throttle_run if self.mission.state == m.RUNNING else 0.0

    def _send_cmd(self, now):
        return self._send({"t": "cmd", "thr": self.thr_cmd, "rud": self.rud_cmd}, now)

    @property
    def comms_ok(self):
        return self.link_up and not self.link_cut

    # -- periodic work ---------------------------------------------------------
    def tick(self, now):
        if not self.link_cut and (self.last_hb is None or now - self.last_hb >= p.HEARTBEAT_PERIOD_S - 1e-9):
            self.last_hb = now
            self.hb_seq += 1
            self._send({"t": "hb", "seq": self.hb_seq}, now)
            self._send_cmd(now)            # refresh the command with every heartbeat
        if self.mission.state == m.FAULT and self.cfg.rudder_centre_on_stop and self.rud_cmd != 0:
            self.rud_cmd = 0
            self.mission.log("Rudder command centred (fault)")
        for msg in self.esp.step(now):
            if not self.link_cut:  # telemetry cannot cross a cut link
                self._on_telemetry(msg, now)
        if self.link_up and now - self.last_rx > p.LINK_TIMEOUT_S:
            self._on_link_lost()

    def _on_link_lost(self):
        self.link_up = False
        mm = self.mission
        mm.log("Communication LOST: no telemetry for 1.0 s", "fault")
        if mm.state == m.RUNNING:
            mm.raise_fault(m.COMMS_LOST)   # fault + motor command STOPPED
            mm.log("Motor stop expected from the controller's own timeout (cannot be confirmed while the link is down)", "warn")
        else:
            mm.set_condition(m.COMMS_LOST)

    def _on_telemetry(self, msg, now):
        mm = self.mission
        self.last_rx, self.telemetry = now, msg
        if not self.link_up:
            mm.log("Telemetry link up" if not mm.active_conditions else "Telemetry link restored")
            self.link_up = True
            mm.condition_cleared(m.COMMS_LOST)
        if msg.get("fix") and msg.get("lat") is not None and msg.get("lon") is not None:
            self.track.append([msg["lat"], msg["lon"]])
            del self.track[:-TRACK_POINTS]
        # controller state: react once, when it leaves OK
        state = msg.get("state", p.OK)
        if state != p.OK and state != self.last_state:
            if state == p.ESTOP:
                mm.log("Controller reports E-STOP latched; motor stopped", "fault")
                mm.latch_fault(m.ESTOP)
            elif state == p.COMMLOST:
                mm.log("Controller timeout: no heartbeat for 1.0 s; controller commanded motor STOPPED", "fault")
                mm.latch_fault(m.COMMS_LOST)
            elif state == p.LEAK:
                mm.log("LEAK detected by controller; motor stopped", "fault")
                mm.raise_fault(m.LEAK)
        self.last_state = state
        if not msg.get("leak"):
            mm.condition_cleared(m.LEAK)
        imu = self.imu(msg)
        values = [v for v in (imu["roll"], imu["pitch"]) if v is not None]
        tilted = bool(values) and max(abs(v) for v in values) > self.cfg.tilt_warning_deg
        if tilted and not self.tilt_warning:
            mm.log(f"TILT WARNING: roll {imu['roll']} deg, pitch {imu['pitch']} deg", "warn")
        elif self.tilt_warning and not tilted:
            mm.log("Tilt back within limits")
        self.tilt_warning = tilted

    def imu(self, msg=None):
        """IMU values in the vessel frame (mounting orientation from config applied)."""
        msg = msg or self.telemetry or {}
        return self.cfg.imu_to_vessel(msg.get("roll"), msg.get("pitch"), msg.get("gz"))

    # -- operator commands: each returns (ok, message) -------------------------
    def _refuse(self, text):
        self.mission.log(f"Rejected: {text}", "warn")
        return False, text

    def start(self, now):
        if self.mission.state == m.READY:
            if not self.comms_ok:
                return self._refuse("Cannot start: controller communication is not OK.")
            if self.last_state != p.OK:
                return self._refuse(f"Cannot start: controller state is {self.last_state}.")
        ok, msg = self.mission.start()
        if ok:
            self.started_at = now
            self._send_cmd(now)
        return ok, msg

    def stop(self, now):
        ok, msg = self.mission.stop()
        if ok:
            self._send_cmd(now)    # thr_cmd is 0 now
        return ok, msg

    def estop(self, now):
        ok, msg = self.mission.estop()
        if not self._send({"t": "estop"}, now):
            self.mission.log("E-STOP could not reach the controller (link cut). "
                             "Dashboard shows FAULT; the controller's own timeout must stop the motor.", "warn")
        return ok, msg

    def reset(self, now, confirmed=False):
        ok, msg = self.mission.reset(confirmed)
        if ok:
            self._send({"t": "reset"}, now)   # clears the controller stop state; never starts the motor
            self.started_at = None
        return ok, msg

    def set_rudder(self, now, deg):
        if self.mission.state == m.FAULT:
            return self._refuse("Rudder commands are blocked while in FAULT.")
        lim = self.cfg.rudder_limit_deg
        deg = max(-lim, min(lim, round(float(deg))))
        if deg != self.rud_cmd:
            self.rud_cmd = deg
            self.mission.log(f"Rudder command changed to {deg:+g} deg (simulated servo)")
        self._send_cmd(now)
        return True, f"Rudder command {deg:+g} deg."

    # -- simulation scenarios (demo controls, not operator functions) ---------
    def scenario(self, now, name, confirmed=False):
        mm = self.mission
        if name == "tilt":
            self.esp.inject_tilt(now)
            mm.log("SIMULATION: tilt disturbance injected")
        elif name == "link_cut":
            if not self.link_cut:
                self.link_cut = True
                mm.log("SIMULATION: communication with the control ESP32 cut", "warn")
        elif name == "link_restore":
            if self.link_cut:
                self.link_cut = False
                mm.log("SIMULATION: communication restored (a latched fault still needs a deliberate reset)")
        elif name == "leak_on":
            self.esp.set_leak(True)
            mm.log("SIMULATION: leak sensor set WET", "warn")
        elif name == "leak_off":
            self.esp.set_leak(False)
            mm.log("SIMULATION: leak sensor set dry")
        elif name == "gps_off":
            self.esp.set_fix(False)
            mm.log("SIMULATION: GPS fix lost", "warn")
        elif name == "gps_on":
            self.esp.set_fix(True)
            mm.log("SIMULATION: GPS fix regained")
        elif name == "restart":
            if not confirmed:
                return self._refuse("Restarting the simulation needs confirmation.")
            self.restart(now)
        else:
            return False, f"Unknown scenario {name}"
        return True, "ok"

    # -- snapshot for the web page ------------------------------------------------
    def snapshot(self, now):
        snap = self.mission.snapshot()
        snap["allowed"]["start"] = snap["allowed"]["start"] and self.comms_ok and self.last_state == p.OK
        cfgd = self.cfg.to_dict()
        cam = self.camera.snapshot() if self.camera else {"configured": False, "viewer_url": None, "status": "NOT_CONFIGURED"}
        t = self.telemetry
        stale = t is not None and not self.comms_ok
        warnings = []
        if t is not None and not self.link_up:
            warnings.append("COMMUNICATION LOST: no telemetry from the control ESP32")
        if self.tilt_warning:
            warnings.append("TILT WARNING: roll or pitch beyond the limit")
        if t and t.get("leak"):
            warnings.append("LEAK DETECTED")
        if t and not t.get("fix"):
            warnings.append("GPS: NO FIX")
        if cam["status"] in ("CAMERA_DOWN", "VIEWER_UNREACHABLE", "STALE", "BAD_RESPONSE"):
            warnings.append("CAMERA: " + cam["status"].replace("_", " ") + " (motor control unaffected)")
        snap.update({
            "mode": "SIMULATION",
            "comms": "WAITING" if t is None else ("OK" if self.comms_ok else "LOST"),
            "link_cut": self.link_cut,
            "telemetry": t,
            "imu": self.imu(),
            "rudder_command": self.rud_cmd,
            "telemetry_stale": stale,
            "telemetry_age_s": None if self.last_rx is None else round(now - self.last_rx, 1),
            "warnings": warnings,
            "tilt_warning": self.tilt_warning,
            "controller_state": self.last_state,
            "config": cfgd,
            "mission_elapsed_s": None if self.started_at is None or self.mission.state != m.RUNNING
            else round(now - self.started_at),
            "track": self.track,
            "camera": cam,
        })
        return snap
