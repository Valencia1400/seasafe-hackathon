"""Start the SeaGuardian operator dashboard (SIMULATION mode, no hardware needed).

    python run_operator.py            then open http://127.0.0.1:8000
    python run_operator.py --http-port 8080
    python run_operator.py --camera-viewer http://127.0.0.1:8001   (after starting vision/viewer.py)
"""
import argparse

from opsdash.config import Config
from opsdash.server import serve

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="SeaGuardian operator dashboard (simulation)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--http-port", type=int, default=8000)
    ap.add_argument("--config", help="JSON file overriding the provisional limits / IMU mounting (see opsdash/config.py)")
    ap.add_argument("--camera-viewer", help="address of vision/viewer.py, e.g. http://127.0.0.1:8001 (default: no camera)")
    args = ap.parse_args()
    cfg = Config.from_json(args.config) if args.config else Config()
    if args.camera_viewer:
        cfg.camera_viewer_url = args.camera_viewer
    serve(args.host, args.http_port, cfg.validate())
