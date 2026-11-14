"""Boat link: the real control ESP32's WebSocket, tested with a stand-in ESP32 over real sockets.

The stand-in speaks the protocol of electronics/firmware/seaguardian_revC (README section 7).
This proves the laptop side only; it is not a test of the firmware or of any hardware.

Run it as a script to feed a running dashboard with moving fake data (to see the 3D model):
    python tests/test_opsdash_boatlink.py 127.0.0.1 8000
"""
import base64
import json
import math
import os
import queue
import socket
import struct
import sys
import threading
import time
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from opsdash.boatlink import accept_key, read_frame  # noqa: E402
from opsdash.config import Config  # noqa: E402
from opsdash.server import Dashboard, make_handler  # noqa: E402


class FakeEsp32:
    """Minimal WebSocket client: masked frames out, unmasked frames in, like the Arduino library."""

    def __init__(self, host, port):
        self.sock = socket.create_connection((host, port), timeout=3)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f"GET /ws HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n"
                           f"Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\n\r\n").encode())
        self.file = self.sock.makefile("rb")
        head = b""
        while not head.endswith(b"\r\n\r\n"):
            head += self.file.read(1)
        assert b" 101 " in head.split(b"\r\n")[0], head
        assert accept_key(key).encode() in head, head
        self.sock.settimeout(None)
        self.frames = queue.Queue()
        threading.Thread(target=self._reader, daemon=True).start()

    def send(self, obj, opcode=1):
        data = obj if isinstance(obj, bytes) else json.dumps(obj).encode()
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x80 | opcode]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n))
        self.sock.sendall(head + mask + bytes(c ^ mask[i & 3] for i, c in enumerate(data)))

    def _reader(self):
        try:
            while True:
                _, op, data = read_frame(self.file.read)
                self.frames.put((op, data))
        except (OSError, ValueError):
            pass

    def recv(self, timeout=2):
        """Next frame as (opcode, payload)."""
        return self.frames.get(timeout=timeout)

    def recv_cmds(self, seconds):
        """Every JSON command that arrives within `seconds`."""
        out, end = [], time.monotonic() + seconds
        while time.monotonic() < end:
            try:
                op, data = self.recv(max(0.01, end - time.monotonic()))
            except queue.Empty:
                break
            if op == 1:
                out.append(json.loads(data))
        return out

    def close(self):
        try:
            self.sock.shutdown(socket.SHUT_RDWR)   # the reader thread's file object keeps the socket open otherwise
        except OSError:
            pass
        self.sock.close()


def telemetry(roll=0.0, pitch=0.0, yaw=0.0, armed=False, estop=False, left=0.0, right=0.0, servo=90, imu_ok=True):
    v = lambda x: x if imu_ok else None
    return {"type": "telemetry", "seq": 1, "t_ms": 1000,
            "imu": {"ok": imu_ok, "t_ms": 999, "ax": v(0.0), "ay": v(0.0), "az": v(1.0), "gx": v(0.0), "gy": v(0.0), "gz": v(0.0),
                    "roll": v(roll), "pitch": v(pitch), "yaw": v(yaw), "yaw_relative": True, "temp": v(24.1), "errors": 0},
            "gps": {"receiving": False, "fix": False, "lat": None, "lon": None, "alt_m": None, "speed_kmh": None,
                    "course": None, "hdop": None, "sats": 0, "age_ms": 0, "utc": None},
            "motors": {"armed": armed, "left": left, "right": right, "limit": 0.5}, "servos": [servo],
            "batt": {"v": None, "state": "disabled"},
            "sys": {"estop": estop, "failsafe": False, "wifi": True, "rssi": -52, "ip": "10.0.0.7", "reconnects": 0,
                    "server_reconnects": 0, "heap": 200000, "uptime_s": 12, "reset": "power_on", "fw": "1.0.0-arduino"}}


class BoatLinkTest(unittest.TestCase):
    def setUp(self):
        self.dash = Dashboard(Config())
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.dash))
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        threading.Thread(target=self.dash.boat.keepalive_loop, daemon=True).start()
        self.esp = None

    def tearDown(self):
        if self.esp:
            self.esp.close()
        self.dash.boat.stop()
        self.server.shutdown()
        self.server.server_close()

    def get(self, path):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=3) as r:
            return json.loads(r.read())

    def post(self, name, body=None):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/command/{name}", data=json.dumps(body or {}).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as r:
            return json.loads(r.read())

    def connect(self, **tel):
        self.esp = FakeEsp32("127.0.0.1", self.port)
        self.esp.send({"type": "hello", "device": "seaguardian", "fw": "1.0.0-arduino", "reset": "power_on"})
        self.esp.send(telemetry(**tel))
        for _ in range(100):
            if self.dash.boat.snapshot()["connected"]:
                return
            time.sleep(0.01)
        self.fail("telemetry did not arrive")

    def test_no_esp32_is_reported_as_not_connected_and_commands_fail_cleanly(self):
        b = self.get("/api/boat")
        self.assertFalse(b["connected"])
        self.assertIsNone(b["attitude"])
        self.assertFalse(self.post("boat-arm", {"value": True})["ok"])

    def test_telemetry_reaches_the_page_with_attitude(self):
        self.connect(roll=12.5, pitch=-3.0, yaw=40.0)
        b = self.get("/api/boat")
        self.assertTrue(b["connected"])
        self.assertEqual(b["fw"], "1.0.0-arduino")
        self.assertEqual(b["attitude"], {"roll": 12.5, "pitch": -3.0, "yaw": 40.0})
        self.assertEqual(b["telemetry"]["servos"], [90])

    def test_imu_mounting_signs_from_config_are_applied(self):
        self.dash.boat.cfg = Config(imu_pitch_sign=-1, imu_swap_roll_pitch=True)
        self.connect(roll=10.0, pitch=4.0)
        self.assertEqual(self.get("/api/boat")["attitude"], {"roll": 4.0, "pitch": -10.0, "yaw": 0.0})

    def test_missing_imu_gives_no_attitude_never_fake_numbers(self):
        self.connect(imu_ok=False)
        b = self.get("/api/boat")
        self.assertTrue(b["connected"])
        self.assertIsNone(b["attitude"])

    def test_operator_commands_are_forwarded_in_the_firmware_format(self):
        self.connect()
        for name, body in (("boat-arm", {"value": True}), ("boat-drive", {"throttle": 1, "steer": -0.5}),
                           ("boat-servo", {"angle": 95}), ("boat-speed", {"value": 0.7}), ("boat-stop", None)):
            self.assertTrue(self.post(name, body)["ok"], name)
        got = [c for c in self.esp.recv_cmds(0.3) if c["cmd"] != "ping"]
        self.assertEqual(got, [{"cmd": "arm", "value": True}, {"cmd": "drive", "throttle": 1.0, "steer": -0.5},
                               {"cmd": "servo", "angle": 95}, {"cmd": "speed", "value": 0.7}, {"cmd": "stop"}])

    def test_values_are_clamped_and_garbage_is_refused(self):
        self.connect()
        self.assertTrue(self.post("boat-servo", {"angle": 999})["ok"])
        self.assertFalse(self.post("boat-servo", {"angle": "abc"})["ok"])
        self.assertFalse(self.post("boat-drive", {"throttle": 1})["ok"])
        self.assertFalse(self.post("boat-nonsense")["ok"])
        got = [c for c in self.esp.recv_cmds(0.3) if c["cmd"] != "ping"]
        self.assertEqual(got, [{"cmd": "servo", "angle": 100}], "servo stays inside centre +/- servo_limit_deg")

    def test_keepalive_only_while_a_browser_is_polling(self):
        self.connect()
        self.assertEqual(self.esp.recv_cmds(0.6), [], "no page open: the firmware watchdog must be allowed to trip")
        end = time.monotonic() + 0.7
        while time.monotonic() < end:
            self.get("/api/boat")
            time.sleep(0.1)
        pings = self.esp.recv_cmds(0.1)
        self.assertGreaterEqual(len(pings), 2)
        self.assertTrue(all(c == {"cmd": "ping"} for c in pings))

    def test_dashboard_estop_latches_the_real_boat_and_reset_releases_it(self):
        self.connect()
        self.assertTrue(self.post("estop")["ok"])
        self.assertIn({"cmd": "estop"}, self.esp.recv_cmds(0.3))
        self.assertTrue(self.post("reset", {"confirm": True})["ok"])
        self.assertIn({"cmd": "estop_reset"}, self.esp.recv_cmds(0.3))

    def test_esp32_ping_is_answered_and_rejections_are_shown(self):
        self.connect()
        self.esp.send(b"hi", opcode=9)
        self.assertEqual(self.esp.recv(), (0xA, b"hi"))
        self.esp.send({"type": "error", "cmd": "move", "msg": "not armed"})
        time.sleep(0.1)
        self.assertEqual(self.get("/api/boat")["last_error"], "move: not armed")

    def test_disconnect_and_silence_are_shown_as_not_connected(self):
        self.connect()
        self.esp.close()
        self.esp = None
        time.sleep(0.2)
        self.assertFalse(self.get("/api/boat")["connected"])
        self.assertIsNone(self.get("/api/boat")["telemetry"])

    def test_state_has_no_simulated_data_and_warns_without_the_esp32(self):
        s = self.get("/api/state")
        self.assertEqual(s["mode"], "HARDWARE")
        self.assertIn("BOAT ESP32 NOT CONNECTED", s["warnings"])
        self.assertNotIn("telemetry", s)
        self.connect()
        self.assertNotIn("BOAT ESP32 NOT CONNECTED", self.get("/api/state")["warnings"])

    def test_estop_without_a_link_is_accepted_and_logged(self):
        r = self.post("estop")
        self.assertTrue(r["ok"])
        self.assertIn("not connected", r["message"])
        self.assertTrue(any("could not reach the boat" in e["text"] for e in self.get("/api/state")["events"]))

    def test_release_needs_confirmation(self):
        self.connect()
        self.assertFalse(self.post("reset")["ok"])
        self.assertEqual([c for c in self.esp.recv_cmds(0.2) if c["cmd"] != "ping"], [])

    def test_state_changes_from_the_boat_are_logged_once_and_shown(self):
        self.connect()
        for _ in range(3):
            self.esp.send(telemetry(estop=True, roll=45.0))
        time.sleep(0.2)
        s = self.get("/api/state")
        self.assertTrue(s["estop"])
        self.assertIn("EMERGENCY STOP ACTIVE", s["warnings"])
        self.assertIn("TILT WARNING: roll or pitch beyond the limit", s["warnings"])
        texts = [e["text"] for e in s["events"]]
        self.assertEqual(sum("EMERGENCY STOP latched" in t for t in texts), 1)
        self.assertEqual(sum(t.startswith("TILT WARNING") for t in texts), 1)


if __name__ == "__main__" and len(sys.argv) == 3:
    # Stand-in ESP32 with moving attitude, for looking at the page. It obeys arm/estop/servo so the buttons react.
    esp = FakeEsp32(sys.argv[1], int(sys.argv[2]))
    esp.send({"type": "hello", "device": "seaguardian", "fw": "FAKE-not-hardware", "reset": "power_on"})
    st = {"armed": False, "estop": False, "servo": 90, "l": 0.0, "r": 0.0}
    t0 = time.monotonic()
    while True:
        for c in esp.recv_cmds(0.1):
            k = c["cmd"]
            if k == "arm":
                st["armed"] = c["value"] and not st["estop"]
            elif k == "estop":
                st.update(estop=True, armed=False, l=0.0, r=0.0)
            elif k == "estop_reset":
                st["estop"] = False
            elif k == "servo" and not st["estop"]:
                st["servo"] = c["angle"]
            elif k == "drive" and st["armed"]:
                st["l"], st["r"] = 0.5 * max(-1, min(1, c["throttle"] + c["steer"])), 0.5 * max(-1, min(1, c["throttle"] - c["steer"]))
            elif k == "stop":
                st["l"] = st["r"] = 0.0
        t = time.monotonic() - t0
        esp.send(telemetry(roll=25 * math.sin(t), pitch=12 * math.sin(t * 0.7), yaw=(t * 20) % 360 - 180, armed=st["armed"],
                           estop=st["estop"], left=st["l"], right=st["r"], servo=st["servo"]))
elif __name__ == "__main__":
    unittest.main()
