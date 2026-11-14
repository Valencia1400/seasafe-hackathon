"""Local web server for the operator dashboard (Python standard library only).

One port serves three things:
  GET  /            the page
  GET  /api/...     state for the page, POST /api/command/... operator commands
  GET  /ws          WebSocket server for the control ESP32 (boatlink.py): telemetry in, commands out
There is no simulated data: without the ESP32 the page shows "not connected".
"""
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .boatlink import BoatLink
from .camera import CameraMonitor
from .config import Config
from .console import OperatorConsole

STATIC = Path(__file__).resolve().parent / "static"


class Dashboard:
    """Ties the boat link, the camera monitor and the event log together and applies operator commands."""

    def __init__(self, config=None):
        config = config or Config()
        self.camera = CameraMonitor(config.camera_viewer_url, log=self._log_event)
        self.boat = BoatLink(config, log=self._log_event, on_telemetry=self._on_telemetry)
        self.console = OperatorConsole(config=config, camera=self.camera, boat=self.boat)

    def _log_event(self, text, level="info"):
        self.console.log(text, level)

    def _on_telemetry(self, msg):
        self.console.on_telemetry(msg)

    def command(self, name, body):
        if name in ("camera-on", "camera-off"):
            ok, msg = self.camera.set_enabled(name == "camera-on")
        elif name == "estop":
            self.console.log("EMERGENCY STOP pressed on the dashboard", "fault")
            ok, msg = self.boat.command("estop", {})
            if not ok:
                ok, msg = True, "Boat ESP32 is not connected: its own firmware stops the motors when the link is down."
                self.console.log("E-STOP could not reach the boat (not connected); the firmware stops the motors on link loss", "warn")
        elif name == "reset":
            if body.get("confirm") is not True:
                ok, msg = False, "Releasing the emergency stop needs confirmation."
            else:
                ok, msg = self.boat.command("estop_reset", {})     # still disarmed afterwards: Arm must be pressed again
        elif name.startswith("boat-"):
            ok, msg = self.boat.command(name[len("boat-"):], body)
        else:
            ok, msg = False, f"Unknown command {name}"
        return {"ok": ok, "message": msg}

    def snapshot(self):
        return self.console.snapshot()


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


def serve(host="0.0.0.0", port=8000, config=None):
    dash = Dashboard(config)
    dash.camera.start()          # own thread: a slow or dead viewer cannot block the dashboard
    threading.Thread(target=dash.boat.keepalive_loop, daemon=True).start()
    server = ThreadingHTTPServer((host, port), make_handler(dash))
    print(f"SeaGuardian operator dashboard: open http://127.0.0.1:{port}  - Ctrl+C to stop", flush=True)
    if host in ("127.0.0.1", "localhost"):
        print("Boat ESP32: cannot connect to this address. Use --host 0.0.0.0 (the default).", flush=True)
    else:
        print(f'Boat ESP32 WebSocket server: ws://{lan_address()}:{port}/ws   (firmware: WS_HOST "{lan_address()}", '
              f'WS_PORT {port}, WS_PATH "/ws")', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        dash.camera.stop()
        dash.boat.stop()
        server.server_close()
