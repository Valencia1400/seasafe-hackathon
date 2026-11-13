"""Start the SeaGuardian dashboard.

Simulator (no hardware):   python run.py --sim
Real ESP32 over USB:       python run.py --port COM5          (Windows)
                           python run.py --port /dev/ttyUSB0  (Raspberry Pi)
Then open http://127.0.0.1:8000 (use --host 0.0.0.0 to open it from another computer).
"""
import argparse
import time
from pathlib import Path

from seaguardian.app import App, SerialLink, SimLink, serve


def main():
    ap = argparse.ArgumentParser(description="SeaGuardian operator dashboard")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--sim", action="store_true", help="use the built-in simulated ESP32")
    src.add_argument("--port", help="serial port of the real ESP32, e.g. COM5 or /dev/ttyUSB0")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--http-port", type=int, default=8000)
    args = ap.parse_args()

    logs = Path(__file__).resolve().parent / "logs"
    logs.mkdir(exist_ok=True)
    log_path = logs / f"session-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
    link = SimLink() if args.sim else SerialLink(args.port, args.baud)
    print(f"Logging every message and event to {log_path}")
    serve(App(link, log_path), args.host, args.http_port)


if __name__ == "__main__":
    main()
