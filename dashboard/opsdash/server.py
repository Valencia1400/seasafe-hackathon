"""Tiny local web server for the operator dashboard (Python standard library only).

The mission, GPS and leak data are still SIMULATED. The real control ESP32 (motors,
servo, IMU) connects to ws://<this laptop>:<port>/ws and is handled by boatlink.py.
"""
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .boatlink import BoatLink
from .camera import CameraMonitor
from .config import Config
from .console import OperatorConsole

STATIC = Path(__file__).resolve().parent / "static"
TICK_S = 0.05


class Dashboard:
    """Runs the console on a background thread and applies operator commands (one lock)."""

    def __init__(self, config=None):
        self.lock = threading.Lock()
        config = config or Config()
        self.camera = CameraMonitor(config.camera_viewer_url, log=self._log_event)
        self.console = OperatorConsole(time.monotonic(), config=config, camera=self.camera)
        self.boat = BoatLink(config, log=self._log_event)   # real control ESP32, separate from the simulation
        self.running = True

    def _log_event(self, text, level="info"):
        with self.lock:
            self.console.mission.log(text, level)

    def loop(self):
        while self.running:
            with self.lock:
                self.console.tick(time.monotonic())
            time.sleep(TICK_S)

    def command(self, name, body):
        now, c = time.monotonic(), self.console
        confirmed = body.get("confirm") is True
        if name in ("camera-on", "camera-off"):   # outside self.lock: the camera logs through _log_event
            ok, msg = self.camera.set_enabled(name == "camera-on")
            return {"ok": ok, "message": msg}
        if name.startswith("boat-"):               # outside self.lock: the boat link logs through _log_event
            ok, msg = self.boat.command(name[len("boat-"):], body)
            return {"ok": ok, "message": msg}
        if name == "estop":                        # the dashboard E-STOP also latches the real boat's emergency stop
            self.boat.command("estop", {})
        with self.lock:
            if name == "start":
                ok, msg = c.start(now)
            elif name == "stop":
                ok, msg = c.stop(now)
            elif name == "estop":
                ok, msg = c.estop(now)
            elif name == "reset":
                ok, msg = c.reset(now, confirmed)
                release_boat = ok
            elif name == "rudder":
                try:
                    ok, msg = c.set_rudder(now, body.get("deg", 0))
                except (TypeError, ValueError):
                    ok, msg = False, "Invalid rudder angle."
            elif name.startswith("scenario-"):
                ok, msg = c.scenario(now, name[len("scenario-"):], confirmed)
            else:
                ok, msg = False, f"Unknown command {name}"
        if name == "reset" and release_boat:       # still disarmed afterwards: Arm must be pressed again
            self.boat.command("estop_reset", {})
        return {"ok": ok, "message": msg}

    def snapshot(self):
        with self.lock:
            return self.console.snapshot(time.monotonic())


def make_handler(dash):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
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
            elif self.path == "/ws":
                dash.boat.serve(self)              # the boat ESP32's WebSocket; returns when it disconnects
                self.close_connection = True
            elif self.path == "/api/boat":
                dash.boat.browser_seen()
                self._reply(200, json.dumps(dash.boat.snapshot()))
            elif self.path == "/api/state":
                self._reply(200, json.dumps(dash.snapshot()))
            else:
                self._reply(404, '{"error":"not found"}')

        def do_POST(self):
            if not self.path.startswith("/api/command/"):
                self._reply(404, '{"error":"not found"}')
                return
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                body = {}
            if not isinstance(body, dict):
                body = {}
            self._reply(200, json.dumps(dash.command(self.path.rsplit("/", 1)[-1], body)))

    return Handler


def lan_address():
    """This laptop's address on the local network (no packet is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def serve(host="127.0.0.1", port=8000, config=None):
    dash = Dashboard(config)
    threading.Thread(target=dash.loop, daemon=True).start()
    dash.camera.start()          # own thread: a slow or dead viewer cannot block the dashboard
    threading.Thread(target=dash.boat.keepalive_loop, daemon=True).start()
    server = ThreadingHTTPServer((host, port), make_handler(dash))
    print(f"SeaGuardian operator dashboard on http://{host}:{port}  - Ctrl+C to stop")
    if host in ("127.0.0.1", "localhost"):
        print("Boat ESP32: cannot connect to this address. Restart with --host 0.0.0.0 to use the real boat.")
    else:
        print(f"Boat ESP32: set WS_HOST \"{lan_address()}\" and WS_PORT {port} in the firmware's secrets.h / Config.h")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        dash.running = False
        dash.camera.stop()
        dash.boat.stop()
        server.server_close()
