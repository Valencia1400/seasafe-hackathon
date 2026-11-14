"""Link to the REAL control ESP32 (firmware: electronics/firmware/seaguardian_revC).

The ESP32 is a WebSocket CLIENT: it dials ws://<laptop>:<http-port>/ws and then
sends one JSON telemetry frame every 100 ms and accepts JSON commands (its
README, section 7). This module is the server side of that socket, written with
the standard library only so the dashboard still needs no installs.

Safety, as far as the laptop is involved (the firmware enforces its own rules):
- The firmware stops the motors if no valid command arrives for 1.0 s. The
  keep-alive ping below is only sent while a browser is polling /api/boat, so
  closing the page (or the laptop) stops the boat.
- Losing the socket makes the firmware stop and disarm by itself.
"""
import base64
import hashlib
import json
import struct
import threading
import time

WS_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
PING_PERIOD_S = 0.2        # keep-alive rate (firmware watchdog is 1.0 s)
BROWSER_TIMEOUT_S = 1.0    # no page polling for this long -> stop sending keep-alives
STALE_S = 1.5              # no telemetry for this long -> shown as not connected
SOCKET_TIMEOUT_S = 5.0     # a silent socket is closed (telemetry normally arrives at 10 Hz)
MAX_FRAME = 16384


def accept_key(key):
    return base64.b64encode(hashlib.sha1(key.encode() + WS_GUID).digest()).decode()


def encode_frame(payload, opcode=1):
    """One unmasked server-to-client frame."""
    n = len(payload)
    head = bytes([0x80 | opcode]) + (bytes([n]) if n < 126 else b"\x7e" + struct.pack(">H", n))
    return head + payload


def read_frame(read):
    """Read one frame with `read(n)` (exactly n bytes). Returns (fin, opcode, payload)."""
    b0, b1 = read(2)
    n = b1 & 0x7F
    if n == 126:
        n = struct.unpack(">H", read(2))[0]
    elif n == 127:
        n = struct.unpack(">Q", read(8))[0]
    if n > MAX_FRAME:
        raise ValueError("frame too large")
    mask = read(4) if b1 & 0x80 else None
    data = read(n) if n else b""
    if mask:
        data = bytes(c ^ mask[i & 3] for i, c in enumerate(data))
    return bool(b0 & 0x80), b0 & 0x0F, data


def _num(body, key, lo, hi):
    v = float(body.get(key))
    if v != v:
        raise ValueError(key)
    return max(lo, min(hi, v))


class BoatLink:
    def __init__(self, config=None, log=None, clock=time.monotonic, on_telemetry=None):
        self.cfg = config
        self._log = log or (lambda text, level="info": None)
        self._clock = clock
        self._on_telemetry = on_telemetry or (lambda msg: None)
        self._lock = threading.Lock()       # state below
        self._tx = threading.Lock()         # one writer on the socket at a time
        self._sock = None
        self.telemetry = None
        self.hello = None
        self.last_rx = None
        self.last_error = None
        self.last_browser = None
        self.running = True

    # -- socket side (runs on the HTTP server's thread for that connection) ---
    def serve(self, handler):
        """Take over an HTTP GET /ws request from the ESP32 until the socket closes."""
        key = handler.headers.get("Sec-WebSocket-Key")
        if not key or "websocket" not in (handler.headers.get("Upgrade") or "").lower():
            handler.send_error(400, "WebSocket upgrade expected")
            return
        sock = handler.connection
        sock.settimeout(SOCKET_TIMEOUT_S)
        sock.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                      f"Sec-WebSocket-Accept: {accept_key(key)}\r\n\r\n").encode())
        with self._lock:
            old, self._sock = self._sock, sock
        if old is not None:                 # the ESP32 restarted: only the newest connection counts
            try:
                old.close()
            except OSError:
                pass
        self._log(f"Boat ESP32 connected from {handler.client_address[0]}")

        def read(n):
            data = handler.rfile.read(n)
            if len(data) != n:
                raise ConnectionError("closed")
            return data

        parts = []
        try:
            while self.running:
                fin, op, data = read_frame(read)
                if op == 8:
                    break
                if op == 9:
                    self._write(sock, encode_frame(data, 0xA))
                elif op in (0, 1):
                    parts.append(data)
                    if fin:
                        self._on_text(b"".join(parts))
                        parts = []
        except (OSError, ValueError, ConnectionError):
            pass
        finally:
            with self._lock:
                mine = self._sock is sock
                if mine:
                    self._sock = None
            if mine:
                self._log("Boat ESP32 disconnected (its firmware stops and disarms the motors on link loss)", "warn")

    def _on_text(self, raw):
        try:
            msg = json.loads(raw)
        except ValueError:
            return
        if not isinstance(msg, dict):
            return
        kind = msg.get("type")
        with self._lock:
            if kind == "telemetry":
                self.telemetry, self.last_rx = msg, self._clock()
            elif kind == "hello":
                self.hello = msg
            elif kind == "error":
                self.last_error = f"{msg.get('cmd')}: {msg.get('msg')}"
        if kind == "telemetry":
            self._on_telemetry(msg)
        if kind == "error":
            self._log(f"Boat ESP32 rejected '{msg.get('cmd')}': {msg.get('msg')}", "warn")

    def _write(self, sock, frame):
        with self._tx:
            sock.sendall(frame)

    # -- laptop -> ESP32 -------------------------------------------------------
    def send(self, cmd):
        with self._lock:
            sock = self._sock
        if sock is None:
            return False
        try:
            self._write(sock, encode_frame(json.dumps(cmd).encode()))
            return True
        except OSError:
            return False

    @property
    def connected(self):
        with self._lock:
            return self._sock is not None and self.last_rx is not None and self._clock() - self.last_rx <= STALE_S

    def command(self, name, body):
        """Operator commands from the page. Returns (ok, message). The firmware validates everything again."""
        try:
            if name == "arm":
                cmd = {"cmd": "arm", "value": body.get("value") is True}
            elif name == "drive":
                cmd = {"cmd": "drive", "throttle": _num(body, "throttle", -1, 1), "steer": _num(body, "steer", -1, 1)}
            elif name == "motors":
                cmd = {"cmd": "motors", "left": _num(body, "left", -1, 1), "right": _num(body, "right", -1, 1)}
            elif name == "speed":
                cmd = {"cmd": "speed", "value": _num(body, "value", 0.1, 1)}
            elif name == "servo":
                cmd = {"cmd": "servo", "angle": round(_num(body, "angle", 0, 180))}
            elif name in ("stop", "estop", "estop_reset", "servo_neutral", "imu_zero"):
                cmd = {"cmd": name}
            else:
                return False, f"Unknown boat command {name}"
        except (TypeError, ValueError):
            return False, "Invalid value."
        if not self.send(cmd):
            return False, "Boat ESP32 is not connected."
        if name in ("arm", "estop", "estop_reset", "imu_zero"):
            self._log(f"Boat ESP32 <- {json.dumps(cmd)}")
        return True, "ok"

    # -- keep-alive: only while a browser is watching ---------------------------
    def browser_seen(self):
        self.last_browser = self._clock()

    def keepalive_due(self):
        return self.last_browser is not None and self._clock() - self.last_browser <= BROWSER_TIMEOUT_S

    def keepalive_loop(self):
        while self.running:
            if self.keepalive_due():
                self.send({"cmd": "ping"})
            time.sleep(PING_PERIOD_S)

    def stop(self):
        self.running = False
        with self._lock:
            sock = self._sock
        if sock is not None:
            try:
                sock.close()
            except OSError:
                pass

    # -- snapshot for the page ---------------------------------------------------
    def snapshot(self):
        with self._lock:
            t, hello, err = self.telemetry, self.hello, self.last_error
            age = None if self.last_rx is None else round(self._clock() - self.last_rx, 2)
            live = self._sock is not None and age is not None and age <= STALE_S
        imu = (t or {}).get("imu") or {}
        att = None
        if live and imu.get("ok"):
            c = self.cfg
            roll, pitch = imu.get("roll"), imu.get("pitch")
            if c is not None and c.imu_swap_roll_pitch:
                roll, pitch = pitch, roll
            sign = lambda v, s: None if v is None else v * s
            att = {"roll": sign(roll, c.imu_roll_sign if c else 1), "pitch": sign(pitch, c.imu_pitch_sign if c else 1),
                   "yaw": sign(imu.get("yaw"), c.imu_yaw_sign if c else 1)}
        return {"connected": live, "age_s": age, "fw": (hello or {}).get("fw"), "telemetry": t if live else None,
                "attitude": att, "last_error": err}
