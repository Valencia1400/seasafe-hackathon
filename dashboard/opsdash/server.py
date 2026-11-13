"""Tiny local web server for the operator dashboard (Python standard library only).

Hardware mode is future work: it needs the protocol confirmed by the electrical
engineer and tested equipment. Only SIMULATION mode exists.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .console import OperatorConsole

STATIC = Path(__file__).resolve().parent / "static"
TICK_S = 0.05


class Dashboard:
    """Runs the console on a background thread and applies operator commands (one lock)."""

    def __init__(self, config=None):
        self.lock = threading.Lock()
        self.console = OperatorConsole(time.monotonic(), config=config)
        self.running = True

    def loop(self):
        while self.running:
            with self.lock:
                self.console.tick(time.monotonic())
            time.sleep(TICK_S)

    def command(self, name, body):
        now, c = time.monotonic(), self.console
        confirmed = body.get("confirm") is True
        with self.lock:
            if name == "start":
                ok, msg = c.start(now)
            elif name == "stop":
                ok, msg = c.stop(now)
            elif name == "estop":
                ok, msg = c.estop(now)
            elif name == "reset":
                ok, msg = c.reset(now, confirmed)
            elif name == "rudder":
                try:
                    ok, msg = c.set_rudder(now, body.get("deg", 0))
                except (TypeError, ValueError):
                    ok, msg = False, "Invalid rudder angle."
            elif name.startswith("scenario-"):
                ok, msg = c.scenario(now, name[len("scenario-"):], confirmed)
            else:
                ok, msg = False, f"Unknown command {name}"
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


def serve(host="127.0.0.1", port=8000, config=None):
    dash = Dashboard(config)
    threading.Thread(target=dash.loop, daemon=True).start()
    server = ThreadingHTTPServer((host, port), make_handler(dash))
    print(f"SeaGuardian operator dashboard (SIMULATION) on http://{host}:{port}  - Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        dash.running = False
        server.server_close()
