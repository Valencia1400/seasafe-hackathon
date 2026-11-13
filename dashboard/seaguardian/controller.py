"""Pi mission controller: heartbeat, simulated supervised inspection mission, faults and event log.

All decisions happen in `tick(now)` and `on_message(msg, now)`, which take the
time as an argument, so the logic can be unit-tested without threads or hardware.
"""
import json
import time

from . import protocol as p

# Simulated mission: state, duration in seconds, motor demand (left, right)
MISSION = [
    ("TRANSIT", 8.0, (0.4, 0.4)),
    ("INSPECTING", 6.0, (0.0, 0.0)),
    ("RETURNING", 8.0, (0.4, 0.4)),
]
# Simulated route (quay -> inspection point), in metres, for the map view
ROUTE = [(0, 0), (20, 6), (38, 22), (52, 30)]
LINK_TIMEOUT_S = 1.0  # Pi side: no telemetry for this long -> link lost


class Controller:
    def __init__(self, send, now: float, log_path=None, wall=time.time):
        self._send = send            # callable(dict): writes one message to the ESP32
        self._wall = wall
        self._log = open(log_path, "a", encoding="utf-8") if log_path else None
        self.hb_seq = 0
        self.last_hb_sent = None
        self.link_cut = False        # operator "Cut link": stop sending heartbeats
        self.cut_at = None
        self.estop_at = None
        self.telemetry = None
        self.last_rx = None
        self.rx_count = 0
        self.seq_gaps = 0
        self._last_seq = None
        self.link_ok = False
        self.mission = "IDLE"        # IDLE, TRANSIT, INSPECTING, RETURNING, DONE, ABORTED
        self.phase_started = now
        self.progress = 0.0          # 0..1 along the route (simulated)
        self.events = []
        self.tilt_warning = False
        self.simulated = False       # set when telemetry says src == SIM
        self.inspection_report = None

    # -- logging ------------------------------------------------------------
    def event(self, text: str, level: str = "info"):
        entry = {"wall": self._wall(), "level": level, "text": text}
        self.events.append(entry)
        del self.events[:-200]
        self._write({"kind": "event", **entry})

    def _write(self, record: dict):
        if self._log:
            self._log.write(json.dumps({"wall": self._wall(), **record}) + "\n")
            self._log.flush()

    def send(self, msg: dict):
        self._write({"kind": "tx", "msg": msg})
        self._send(msg)

    # -- operator actions ---------------------------------------------------
    def start_mission(self, now: float):
        if self.mission not in ("IDLE", "DONE", "ABORTED"):
            return "Mission already running."
        state = self.telemetry and self.telemetry.get("state")
        if not self.link_ok or state != p.OK:
            return f"Cannot start: link {'OK' if self.link_ok else 'LOST'}, ESP32 state {state}."
        self.mission, self.phase_started, self.progress = "TRANSIT", now, 0.0
        self.inspection_report = None
        self.event("Mission started: inspection of quay area (SIMULATED route)")
        return "Mission started."

    def abort_mission(self, now: float, reason: str = "Operator abort"):
        if self.mission in ("TRANSIT", "INSPECTING", "RETURNING"):
            self.mission = "ABORTED"
            self.send(p.motor_cmd(0, 0))
            self.event(f"Mission aborted: {reason}", "warn")

    def estop(self, now: float):
        self.estop_at = now
        self.send(p.ESTOP_MSG)
        self.event("Operator pressed E-STOP", "fault")
        self.abort_mission(now, "E-STOP")

    def reset(self, now: float):
        self.send(p.RESET_MSG)
        self.event("Operator sent RESET")

    def cut_link(self, now: float):
        if not self.link_cut:
            self.link_cut, self.cut_at = True, now
            self.event("Operator cut the link: heartbeats stopped (comms-loss test)", "warn")

    def restore_link(self, now: float):
        if self.link_cut:
            self.link_cut, self.cut_at = False, None
            self.event("Link restored: heartbeats resumed (press RESET to clear COMMLOST)")

    # -- input from the ESP32 -----------------------------------------------
    def on_message(self, msg: dict, now: float):
        self._write({"kind": "rx", "msg": msg})
        if msg.get("src") == "SIM":
            self.simulated = True
        if msg.get("t") == "tel":
            self._on_telemetry(msg, now)
        elif msg.get("t") == "evt":
            self._on_esp_event(msg, now)

    def _on_telemetry(self, msg: dict, now: float):
        seq = msg.get("seq")
        if isinstance(seq, int) and self._last_seq is not None and seq > self._last_seq + 1:
            self.seq_gaps += seq - self._last_seq - 1
        if isinstance(seq, int):
            self._last_seq = seq
        self.rx_count += 1
        self.telemetry, self.last_rx = msg, now
        if not self.link_ok:
            self.link_ok = True
            self.event("Telemetry link up")
        # roll/pitch are null when the firmware has no IMU connected
        tilted = max(abs(msg.get("roll") or 0), abs(msg.get("pitch") or 0)) > p.TILT_WARNING_DEG
        if tilted and not self.tilt_warning:
            self.event(f"TILT warning: roll {msg.get('roll')} deg, pitch {msg.get('pitch')} deg", "warn")
        elif self.tilt_warning and not tilted:
            self.event("Tilt back within limits")
        self.tilt_warning = tilted

    def _on_esp_event(self, msg: dict, now: float):
        evt = msg.get("evt")
        if evt == p.OK:
            self.event("ESP32 back to OK")
            return
        note = ""
        if evt == p.COMMLOST and self.cut_at is not None:
            note = f" - {int((now - self.cut_at) * 1000)} ms after the link was cut (Pi clock)"
        if evt == p.ESTOP and self.estop_at is not None:
            note = f" - confirmed {int((now - self.estop_at) * 1000)} ms after the E-STOP press (Pi clock)"
        self.event(f"ESP32 safety stop: {evt}, motors 0{note}", "fault")
        self.abort_mission(now, f"ESP32 reported {evt}")

    # -- periodic work --------------------------------------------------------
    def tick(self, now: float):
        if not self.link_cut and (self.last_hb_sent is None or now - self.last_hb_sent >= p.HEARTBEAT_PERIOD_S):
            self.hb_seq += 1
            self.last_hb_sent = now
            self.send(p.heartbeat(self.hb_seq))
        if self.link_ok and self.last_rx is not None and now - self.last_rx > LINK_TIMEOUT_S:
            self.link_ok = False
            self.event("Telemetry link LOST (no data for 1 s)", "fault")
            self.abort_mission(now, "telemetry link lost")
        self._advance_mission(now)

    def _advance_mission(self, now: float):
        names = [m[0] for m in MISSION]
        if self.mission not in names:
            return
        i = names.index(self.mission)
        name, duration, (left, right) = MISSION[i]
        elapsed = now - self.phase_started
        frac = min(1.0, elapsed / duration)
        if name == "TRANSIT":
            self.progress = frac
        elif name == "RETURNING":
            self.progress = 1.0 - frac
        if not self.link_cut:
            self.send(p.motor_cmd(left, right))
        if name == "INSPECTING" and self.inspection_report is None and self.telemetry:
            t = self.telemetry
            self.inspection_report = {
                "roll": t.get("roll"), "pitch": t.get("pitch"), "p_hpa": t.get("p_hpa"),
                "leak": t.get("leak"), "simulated": self.simulated,
            }
            self.event(f"Inspection point reached: roll {t.get('roll')} deg, pressure {t.get('p_hpa')} hPa, "
                       f"leak {'YES' if t.get('leak') else 'no'}")
        if elapsed >= duration:
            if i + 1 < len(MISSION):
                self.mission, self.phase_started = MISSION[i + 1][0], now
                self.event(f"Mission phase: {self.mission}")
            else:
                self.mission, self.progress = "DONE", 0.0
                self.send(p.motor_cmd(0, 0))
                self.event("Mission complete: vessel back at the quay (SIMULATED)")

    # -- snapshot for the dashboard ---------------------------------------
    def snapshot(self, now: float) -> dict:
        (x0, y0), pts = ROUTE[0], ROUTE
        # position along the polyline by fraction of total length
        seg = [((a, b), ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5) for a, b in zip(pts, pts[1:])]
        total = sum(length for _, length in seg)
        dist, pos = self.progress * total, (x0, y0)
        for (a, b), length in seg:
            if dist <= length:
                f = dist / length if length else 0
                pos = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
                break
            dist -= length
            pos = b
        return {
            "telemetry": self.telemetry,
            "link_ok": self.link_ok,
            "link_cut": self.link_cut,
            "rx_count": self.rx_count,
            "seq_gaps": self.seq_gaps,
            "mission": self.mission,
            "progress": round(self.progress, 3),
            "position": [round(pos[0], 1), round(pos[1], 1)],
            "route": ROUTE,
            "tilt_warning": self.tilt_warning,
            "simulated": self.simulated,
            "inspection_report": self.inspection_report,
            "events": self.events[-60:],
        }
