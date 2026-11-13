"""Camera monitor: polls vision/viewer.py's /detections and turns it into a safe, display-ready state.

Data flow (see vision/INTEGRATION.md):
    ESP32 #1 --MJPEG--> vision/viewer.py (YOLO) --/stream.mjpg--> the operator's BROWSER (video)
                                                --/detections--> this module (detections + health)
ONLY the viewer opens the ESP32 stream (it serves one client at a time); the dashboard never does.
YOLO inference runs in the viewer, never here. Polling runs on its own thread, so a slow or dead
viewer cannot block the dashboard or the simulated control loop.

This module is deliberately separate from the motor-control path: a camera problem produces a
camera warning only. Detections never change the mission state, the motor or the rudder.

What the data does NOT mean: a detected "person" is not necessarily a person in the water, a "bottle"
is not proof of floating debris, and the confidence is the model's own score, not a calibrated
accuracy. Everything is shown as "potential object, operator review required".
"""
import json
import threading
import time
import urllib.error
import urllib.request

POLL_PERIOD_S = 0.4        # about 2.5 Hz
FETCH_TIMEOUT_S = 1.0
MAX_BODY_BYTES = 1_000_000
STALE_S = 2.0              # same frame sequence number for this long -> data is not live
ALERT_REPEAT_S = 10.0      # log the same class at most this often

# Operator-facing wording. Unknown classes (e.g. from a future fine-tuned model) get a generic label.
LABELS = {
    "person": "Person detected",
    "boat": "Vessel detected",
    "bird": "Bird detected",
    "surfboard": "Board detected",
    "bottle": "Bottle detected",
}
REVIEW_NOTICE = "Potential object detected - operator review required"

NOT_CONFIGURED, CONNECTING, OK = "NOT_CONFIGURED", "CONNECTING", "OK"
CAMERA_DOWN, VIEWER_UNREACHABLE, STALE, BAD_RESPONSE = "CAMERA_DOWN", "VIEWER_UNREACHABLE", "STALE", "BAD_RESPONSE"
OFF = "OFF"   # turned off by the operator: no polling, no video, no detections


def fetch_json(url, timeout=FETCH_TIMEOUT_S):
    """GET a small JSON document. Raises OSError / ValueError on any problem."""
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read(MAX_BODY_BYTES).decode("utf-8"))


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def parse_detections(msg):
    """Validate one /detections message. Returns (info, detections, ignored) or raises ValueError.

    Only fields that actually exist are used; when the camera is DOWN the viewer omits w, h, fps and
    infer_ms, so every field is optional. Malformed detection entries are dropped and counted.
    """
    if not isinstance(msg, dict):
        raise ValueError("detection message is not an object")
    cam = msg.get("cam")
    if cam not in ("OK", "DOWN"):
        raise ValueError(f"unexpected cam value: {cam!r}")
    src = msg.get("src")
    if not isinstance(src, str):
        raise ValueError("missing src")
    raw = msg.get("dets", [])
    if not isinstance(raw, list):
        raise ValueError("dets is not a list")
    dets, ignored = [], 0
    for d in raw[:200]:
        ok = (isinstance(d, dict) and isinstance(d.get("cls"), str) and _num(d.get("conf")) and 0 <= d["conf"] <= 1
              and isinstance(d.get("box"), list) and len(d["box"]) == 4 and all(_num(x) for x in d["box"]))
        if not ok:
            ignored += 1
            continue
        cls = d["cls"][:40]
        dets.append({"cls": cls, "label": LABELS.get(cls, f"Object detected ({cls})"),
                     "conf": round(float(d["conf"]), 2), "conf_pct": round(d["conf"] * 100),
                     "box": [round(float(x)) for x in d["box"]]})
    info = {"cam": cam, "src": src[:20], "seq": msg.get("seq") if isinstance(msg.get("seq"), int) else None,
            "model": msg.get("model") if isinstance(msg.get("model"), str) else None,
            "fps": msg.get("fps") if _num(msg.get("fps")) else None,
            "infer_ms": msg.get("infer_ms") if _num(msg.get("infer_ms")) else None,
            "w": msg.get("w") if _num(msg.get("w")) else None, "h": msg.get("h") if _num(msg.get("h")) else None}
    return info, dets, ignored


class CameraMonitor:
    def __init__(self, viewer_url, log=None, fetch=fetch_json, clock=time.monotonic):
        self.url = viewer_url.rstrip("/") if viewer_url else None
        self._log = log or (lambda text, level="info": None)
        self._fetch = fetch
        self._clock = clock
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self.enabled = True
        self.status = CONNECTING if self.url else NOT_CONFIGURED
        self.message = ""
        self.info, self.dets, self.ignored = {}, [], 0
        self.last_seq, self.seq_changed_at, self.last_ok_at = None, None, None
        self._alert_at = {}
        self._announced = None   # last status written to the event log

    # -- polling -------------------------------------------------------------
    def start(self):
        if self.url:
            threading.Thread(target=self._loop, daemon=True).start()

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.is_set():
            self.poll_once()
            self._stop.wait(POLL_PERIOD_S)

    def set_enabled(self, on):
        """Operator camera switch. Returns (ok, message) like the console commands."""
        if not self.url:
            return False, "No camera viewer configured."
        self.enabled = bool(on)
        self._set(CONNECTING if on else OFF, self._clock(), "" if on else "Camera turned off by the operator", clear=True)
        return True, "ok"

    def poll_once(self):
        """One poll. Never raises: every failure becomes a status."""
        if not self.url or not self.enabled:
            return
        now = self._clock()
        try:
            msg = self._fetch(self.url + "/detections")
        except (OSError, ValueError) as exc:   # URLError, timeouts and JSON errors are all subclasses
            self._set(VIEWER_UNREACHABLE if not isinstance(exc, ValueError) else BAD_RESPONSE, now,
                      "Cannot reach the camera viewer" if not isinstance(exc, ValueError)
                      else "Viewer sent an unreadable response", clear=True)
            return
        try:
            info, dets, ignored = parse_detections(msg)
        except ValueError as exc:
            self._set(BAD_RESPONSE, now, f"Viewer response not understood: {exc}", clear=True)
            return
        if info["cam"] == "DOWN":
            self._set(CAMERA_DOWN, now, "Viewer receives no camera frames", info=info, clear=True)
            return
        # Frozen output must not look live: the sequence number has to keep moving.
        if info["seq"] is None:              # no sequence number: freshness cannot be judged, do not guess
            self.seq_changed_at = now
        elif info["seq"] != self.last_seq:
            self.last_seq, self.seq_changed_at = info["seq"], now
        elif self.seq_changed_at is None:
            self.seq_changed_at = now
        self.last_ok_at = now
        if now - self.seq_changed_at > STALE_S:
            self._set(STALE, now, "Detection data is not updating (frozen)", info=info, clear=True)
            return
        self._set(OK, now, "", info=info, dets=dets, ignored=ignored)
        self._announce_detections(dets, info, now)

    def _set(self, status, now, message, info=None, dets=None, ignored=0, clear=False):
        with self._lock:
            if not self.enabled and status != OFF:
                return   # a poll that was in flight when the camera was turned off
            self.status, self.message = status, message
            self.info = info or {}
            self.dets = [] if clear or dets is None else dets   # never keep old detections on a bad poll
            self.ignored = ignored
        self._announce_status(status, info)

    # -- event log (warnings only: never a fault, never touches the motor) -----------
    def _announce_status(self, status, info):
        if status == self._announced:
            return
        self._announced = status
        src = (info or {}).get("src")
        if status == OK:
            test = src is not None and src != "esp32"
            self._log("Camera viewer connected" + (f" - TEST INPUT ({src}), not the boat camera" if test else " (boat camera)"),
                      "warn" if test else "info")
        elif status == CAMERA_DOWN:
            self._log("CAMERA DOWN: the viewer receives no frames (control link unaffected)", "warn")
        elif status == VIEWER_UNREACHABLE:
            self._log("Camera viewer unreachable (control link unaffected)", "warn")
        elif status == STALE:
            self._log("Camera detections frozen: not shown as live", "warn")
        elif status == BAD_RESPONSE:
            self._log("Camera viewer sent an unreadable response", "warn")
        elif status == OFF:
            self._log("Camera turned off by the operator (video and detections paused)")
        elif status == CONNECTING:
            self._log("Camera turned on by the operator")

    def _announce_detections(self, dets, info, now):
        test = info.get("src") != "esp32"
        for cls in sorted({d["cls"] for d in dets}):
            if now - self._alert_at.get(cls, -1e9) >= ALERT_REPEAT_S:
                best = max(d["conf_pct"] for d in dets if d["cls"] == cls)
                self._log(f"{REVIEW_NOTICE}: {cls} {best}% (model score){' - TEST INPUT' if test else ''}", "warn")
            self._alert_at[cls] = now

    # -- snapshot for the page -------------------------------------------------
    def snapshot(self):
        with self._lock:
            status, info = self.status, dict(self.info)
            src = info.get("src")
            current = status == OK
            return {
                "configured": bool(self.url),
                "viewer_url": self.url,
                "stream_url": self.url + "/stream.mjpg" if self.url else None,
                "status": status,
                "message": self.message,
                "input": None if src is None else ("REAL CAMERA" if src == "esp32" else "TEST INPUT"),
                "src": src,
                "fps": info.get("fps") if current else None,
                "infer_ms": info.get("infer_ms") if current else None,
                "model": info.get("model"),
                "detections": list(self.dets) if current else [],     # only current, fresh data
                "ignored": self.ignored,
                "notice": REVIEW_NOTICE,
            }
