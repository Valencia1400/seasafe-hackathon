"""Operator console: connects the mission state machine to a (simulated) controller.

This is the application logic. It knows nothing about HTTP or HTML. Time is
passed in, so every scenario can be tested with a fake clock.

Today the controller is `SimulatedESP32`. In a future HARDWARE mode the
`_deliver` / telemetry input would come from the real ESP32 instead; the rest
of this file should not need to change. Hardware mode is NOT implemented.
"""
import time

from . import mission as m
from . import protocol as p
from .simulator import SimulatedESP32

TRACK_POINTS = 300


class OperatorConsole:
    def __init__(self, now, wall=time.time):
        self._wall = wall
        self.restart(now)

    # -- (re)start the whole simulation --------------------------------------
    def restart(self, now):
        self.mission = m.MissionStateMachine(clock=self._wall)
        self.esp = SimulatedESP32(now)
        self.link_cut = False
        self.last_hb = None
        self.last_rx = None
        self.link_up = False
        self.telemetry = None
        self.last_fault = None
        self.tilt_warning = False
        self.rudder_cmd = 0
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
    def comms_ok(self):
        return self.link_up and not self.link_cut

    # -- periodic work ---------------------------------------------------------
    def tick(self, now):
        if not self.link_cut and (self.last_hb is None or now - self.last_hb >= p.HEARTBEAT_PERIOD_S - 1e-9):
            self.last_hb = now
            self._send({"type": "hb"}, now)
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
            mm.log("Telemetry link up" if self.last_fault is None and not mm.active_conditions
                   else "Telemetry link restored")
            self.link_up = True
            mm.condition_cleared(m.COMMS_LOST)
        gps = msg["gps"]
        if gps["valid"]:
            self.track.append([gps["lat"], gps["lon"]])
            del self.track[:-TRACK_POINTS]
        # controller-reported faults: react once, when a fault first appears
        fault = msg["fault"]
        if fault and fault != self.last_fault:
            if fault == p.FAULT_ESTOP:
                mm.log("Controller reports E-STOP latched; motor stopped", "fault")
                mm.latch_fault(m.ESTOP)
            elif fault == p.FAULT_COMMS:
                mm.log("Controller timeout: no heartbeat for 1.0 s; controller commanded motor STOPPED", "fault")
                mm.latch_fault(m.COMMS_LOST)
            elif fault == p.FAULT_LEAK:
                mm.log("LEAK detected by controller; motor stopped", "fault")
                mm.raise_fault(m.LEAK)
        self.last_fault = fault
        if not msg["leak"]:
            mm.condition_cleared(m.LEAK)
        imu = msg["imu"]
        tilted = max(abs(imu["roll_deg"]), abs(imu["pitch_deg"])) > p.TILT_WARNING_DEG
        if tilted and not self.tilt_warning:
            mm.log(f"TILT WARNING: roll {imu['roll_deg']} deg, pitch {imu['pitch_deg']} deg", "warn")
        elif self.tilt_warning and not tilted:
            mm.log("Tilt back within limits")
        self.tilt_warning = tilted

    # -- operator commands: each returns (ok, message) -------------------------
    def _refuse(self, text):
        self.mission.log(f"Rejected: {text}", "warn")
        return False, text

    def start(self, now):
        if self.mission.state == m.READY:
            if not self.comms_ok:
                return self._refuse("Cannot start: controller communication is not OK.")
            if self.last_fault:
                return self._refuse(f"Cannot start: controller reports {self.last_fault}.")
        ok, msg = self.mission.start()
        if ok:
            self.started_at = now
            self._send({"type": "set_motor", "run": True}, now)
        return ok, msg

    def stop(self, now):
        ok, msg = self.mission.stop()
        if ok:
            self._send({"type": "set_motor", "run": False}, now)
        return ok, msg

    def estop(self, now):
        ok, msg = self.mission.estop()
        if not self._send({"type": "estop"}, now):
            self.mission.log("E-STOP could not reach the controller (link cut). "
                             "Dashboard shows FAULT; the controller's own timeout must stop the motor.", "warn")
        return ok, msg

    def reset(self, now, confirmed=False):
        ok, msg = self.mission.reset(confirmed)
        if ok:
            self._send({"type": "reset"}, now)   # clears the controller latch; never starts the motor
            self.started_at = None
        return ok, msg

    def set_rudder(self, now, deg):
        if self.mission.state == m.FAULT:
            return self._refuse("Rudder commands are blocked while in FAULT.")
        deg = max(-p.RUDDER_LIMIT_DEG, min(p.RUDDER_LIMIT_DEG, round(float(deg))))
        if deg != self.rudder_cmd:
            self.rudder_cmd = deg
            self.mission.log(f"Rudder command changed to {deg:+d} deg (simulated servo)")
        self._send({"type": "set_rudder", "deg": deg}, now)
        return True, f"Rudder command {deg:+d} deg."

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
        snap["allowed"]["start"] = snap["allowed"]["start"] and self.comms_ok and not self.last_fault
        stale = self.telemetry is not None and not self.comms_ok
        warnings = []
        if self.link_up is False and self.telemetry is not None:
            warnings.append("COMMUNICATION LOST: no telemetry from the control ESP32")
        if self.tilt_warning:
            warnings.append("TILT WARNING: roll or pitch beyond the limit")
        if self.telemetry and self.telemetry["leak"]:
            warnings.append("LEAK DETECTED")
        snap.update({
            "mode": "SIMULATION",
            "comms": "WAITING" if self.telemetry is None else ("OK" if self.comms_ok else "LOST"),
            "link_cut": self.link_cut,
            "telemetry": self.telemetry,
            "telemetry_stale": stale,
            "telemetry_age_s": None if self.last_rx is None else round(now - self.last_rx, 1),
            "warnings": warnings,
            "tilt_warning": self.tilt_warning,
            "controller_fault": self.last_fault,
            "rudder_limit_deg": p.RUDDER_LIMIT_DEG,
            "mission_elapsed_s": None if self.started_at is None or self.mission.state != m.RUNNING
            else round(now - self.started_at),
            "track": self.track,
            "camera": {"connected": False},
        })
        return snap
