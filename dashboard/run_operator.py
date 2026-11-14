"""Start the SeaGuardian operator dashboard: web page + WebSocket server for the control ESP32.

    python run_operator.py            then open http://127.0.0.1:8000
    python run_operator.py --camera-viewer http://127.0.0.1:8001   (after starting vision/viewer.py)

It listens on the whole network by default, because the ESP32 dials in to ws://<this laptop>:8000/ws.
There is no login: use it on a network you trust.
"""
import argparse

from opsdash.config import Config
from opsdash.server import serve

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="SeaGuardian operator dashboard")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--http-port", type=int, default=8000)
    ap.add_argument("--config", help="JSON file overriding the tilt limit / IMU mounting (see opsdash/config.py)")
    ap.add_argument("--camera-viewer", help="address of vision/viewer.py, e.g. http://127.0.0.1:8001 (default: no camera)")
    args = ap.parse_args()
    cfg = Config.from_json(args.config) if args.config else Config()
    if args.camera_viewer:
        cfg.camera_viewer_url = args.camera_viewer
    serve(args.host, args.http_port, cfg.validate())
