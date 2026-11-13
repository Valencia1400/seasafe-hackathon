"""Pi <-> ESP32 message protocol (see docs/architecture.md). One JSON object per line."""
import json

HEARTBEAT_PERIOD_S = 0.2   # Pi sends a heartbeat this often
HEARTBEAT_TIMEOUT_S = 1.0  # ESP32 stops the motors after this long without one
TILT_WARNING_DEG = 30.0    # Pi shows a TILT warning beyond this roll or pitch

OK, ESTOP, COMMLOST, LEAK = "OK", "ESTOP", "COMMLOST", "LEAK"
STATES = (OK, ESTOP, COMMLOST, LEAK)


def encode(msg: dict) -> str:
    """Message -> one line of compact JSON with a newline."""
    return json.dumps(msg, separators=(",", ":")) + "\n"


def decode(line: str):
    """One line -> message dict, or None if the line is not a valid message."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        msg = json.loads(line)
    except ValueError:
        return None
    return msg if isinstance(msg, dict) and isinstance(msg.get("t"), str) else None


def heartbeat(seq: int) -> dict:
    return {"t": "hb", "seq": seq}


def motor_cmd(left: float, right: float) -> dict:
    clamp = lambda v: max(-1.0, min(1.0, float(v)))
    return {"t": "cmd", "l": round(clamp(left), 3), "r": round(clamp(right), 3)}


ESTOP_MSG = {"t": "estop"}
RESET_MSG = {"t": "reset"}
