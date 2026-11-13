"""Runs the controller against the simulator or a real ESP32, and serves the dashboard."""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import protocol as p
from .controller import Controller
from .sim_esp32 import SimulatedESP32

STATIC = Path(__file__).resolve().parent.parent / "static"


class SimLink:
    """Connects the controller to a SimulatedESP32 in the same process."""

    def __init__(self):
        self.sim = SimulatedESP32(time.monotonic())
        self.controller = None

    def send(self, msg):
        self.sim.handle(msg, time.monotonic())

    def poll(self):
        now = time.monotonic()
        self.sim.step(now)
        return self.sim.drain()


class SerialLink:
    """Talks to the real ESP32 over USB serial (needs: pip install pyserial)."""

    def __init__(self, port: str, baud: int = 115200):
        import serial  # imported here so the simulator works without pyserial
        self.ser = serial.Serial(port, baud, timeout=0.05)
        self.bad_lines = 0
        self._buf = b""

    def send(self, msg):
        self.ser.write(p.encode(msg).encode("ascii"))

    def poll(self):
        self._buf += self.ser.read(self.ser.in_waiting or 1)
        *lines, self._buf = self._buf.split(b"\n")
        out = []
        for raw in lines:
            msg = p.decode(raw.decode("utf-8", "replace"))
            if msg is None:
                self.bad_lines += 1
            else:
                out.append(msg)
        return out


class App:
    def __init__(self, link, log_path):
        self.link = link
        self.lock = threading.Lock()
        self.ctl = Controller(self._safe_send, time.monotonic(), log_path=log_path)
        self.running = True

    def _safe_send(self, msg):
        try:
            self.link.send(msg)
        except Exception as exc:  # noqa: BLE001 - a dead link must not crash the controller
            self.ctl.event(f"Send failed: {exc}", "fault")

    def loop(self):
        while self.running:
            try:
                messages = self.link.poll()
            except Exception as exc:  # noqa: BLE001
                messages = []
                with self.lock:
                    self.ctl.event(f"Read failed: {exc}", "fault")
                time.sleep(0.5)
            with self.lock:
                now = time.monotonic()
                for msg in messages:
                    self.ctl.on_message(msg, now)
                self.ctl.tick(now)
            time.sleep(0.05)

    def action(self, name: str) -> str:
        with self.lock:
            now = time.monotonic()
            c = self.ctl
            actions = {
                "start": lambda: c.start_mission(now),
                "abort": lambda: c.abort_mission(now),
                "estop": lambda: c.estop(now),
                "reset": lambda: c.reset(now),
                "cut": lambda: c.cut_link(now),
                "restore": lambda: c.restore_link(now),
            }
            sim = getattr(self.link, "sim", None)
            if sim is not None:  # fault injection exists only in simulator mode
                def toggle_tilt():
                    sim.tilt_deg = 0.0 if sim.tilt_deg else 40.0
                    c.event(f"SIM: tilt set to {sim.tilt_deg} deg")
                def toggle_leak():
                    sim.leak = not sim.leak
                    c.event(f"SIM: leak sensor {'WET' if sim.leak else 'dry'}")
                actions.update({"sim_tilt": toggle_tilt, "sim_leak": toggle_leak})
            if name not in actions:
                return f"Unknown action {name}"
            return actions[name]() or "ok"

    def snapshot(self):
        with self.lock:
            snap = self.ctl.snapshot(time.monotonic())
        snap["mode"] = "SIMULATOR" if isinstance(self.link, SimLink) else "HARDWARE"
        return snap


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # keep the console quiet
            pass

        def _reply(self, code, body, ctype="application/json"):
            data = body if isinstance(body, bytes) else body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self._reply(200, (STATIC / "index.html").read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/api/state":
                self._reply(200, json.dumps(app.snapshot()))
            else:
                self._reply(404, '{"error":"not found"}')

        def do_POST(self):
            if self.path.startswith("/api/action/"):
                result = app.action(self.path.rsplit("/", 1)[-1])
                self._reply(200, json.dumps({"result": result}))
            else:
                self._reply(404, '{"error":"not found"}')

    return Handler


def serve(app: App, host: str, port: int):
    threading.Thread(target=app.loop, daemon=True).start()
    server = ThreadingHTTPServer((host, port), make_handler(app))
    print(f"SeaGuardian dashboard on http://{host}:{port}  ({'SIMULATOR' if isinstance(app.link, SimLink) else 'HARDWARE'} mode)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        app.running = False
        server.server_close()
