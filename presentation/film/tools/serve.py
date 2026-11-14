"""Local server for the SeaGuardian film.

Serves the `presentation/` folder (so the film pages can load their modules) and accepts
POST /__save?name=<file> which writes the request body to presentation/film/out/<file>.
The export page uses that to save the rendered MP4 without any browser download dialog.

    python presentation/film/tools/serve.py [port]
"""
import http.server
import os
import re
import sys
import urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))   # presentation/
OUT = os.path.join(ROOT, "film", "out")
SAFE = re.compile(r"^[A-Za-z0-9._-]{1,80}$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")          # always serve the latest scripts
        super().end_headers()

    def do_GET(self):
        """Adds HTTP Range support so the browser can seek inside the exported MP4."""
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        m = re.match(r"bytes=(\d*)-(\d*)$", rng or "")
        if not m or not os.path.isfile(path):
            return super().do_GET()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        end = min(size - 1, int(m.group(2))) if m.group(1) and m.group(2) else size - 1
        if start > end or start >= size:
            self.send_error(416, "range not satisfiable")
            return
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(left, 1 << 20))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(url.query).get("name", [""])[0]
        if url.path != "/__save" or not SAFE.match(name):
            self.send_error(400, "bad save request")
            return
        os.makedirs(OUT, exist_ok=True)
        todo = int(self.headers.get("Content-Length", "0"))
        mode = "ab" if urllib.parse.parse_qs(url.query).get("append") else "wb"
        with open(os.path.join(OUT, name), mode) as f:
            while todo > 0:
                chunk = self.rfile.read(min(todo, 1 << 20))
                if not chunk:
                    break
                f.write(chunk)
                todo -= len(chunk)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"saved")

    def log_message(self, fmt, *args):
        if "__save" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    print(f"Serving {ROOT} at http://localhost:{port}/film/  (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
