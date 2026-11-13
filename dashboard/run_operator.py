"""Start the SeaGuardian operator dashboard (SIMULATION mode, no hardware needed).

    python run_operator.py            then open http://127.0.0.1:8000
    python run_operator.py --http-port 8080
"""
import argparse

from opsdash.server import serve

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="SeaGuardian operator dashboard (simulation)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--http-port", type=int, default=8000)
    args = ap.parse_args()
    serve(args.host, args.http_port)
