"""Camera integration tests (T1-T9). ALL of these use MOCK viewer responses, never real camera hardware
or the real YOLO viewer: they prove the dashboard's handling of vision/INTEGRATION.md messages, not
that the physical camera works. (The boat link has its own file, test_opsdash_boatlink.py.)

Run from the dashboard folder:  python -m unittest discover -s tests -v
"""
import json
import socket
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from opsdash import camera as cam  # noqa: E402
from opsdash.config import Config  # noqa: E402
from opsdash.server import Dashboard, make_handler  # noqa: E402

# The example message from vision/INTEGRATION.md section 4
SAMPLE = {"t": "det", "seq": 812, "ts": 1763037000.123, "src": "esp32", "model": "yolo26n.pt", "cam": "OK",
          "w": 640, "h": 480, "fps": 9.8, "infer_ms": 38.2,
          "dets": [{"cls": "boat", "conf": 0.82, "box": [120, 200, 260, 300]},
                   {"cls": "person", "conf": 0.57, "box": [400, 180, 430, 260]}]}
DOWN = {"t": "det", "seq": 0, "src": "esp32", "cam": "DOWN", "dets": []}   # no w, h, fps, infer_ms


KEEP = object()   # poll(): keep the previous scripted reply (None is a valid "bad reply" to test)


class Mon:
    """CameraMonitor driven by a fake clock and a scripted fetch function."""

    def __init__(self, url="http://127.0.0.1:8001"):
        self.now, self.reply, self.events = 100.0, SAMPLE, []
        self.m = cam.CameraMonitor(url, log=lambda t, lvl="info": self.events.append((lvl, t)),
                                   fetch=self._fetch, clock=lambda: self.now)

    def _fetch(self, url):
        self.url = url
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply

    def poll(self, reply=KEEP, dt=0.4):
        if reply is not KEEP:
            self.reply = reply
        self.now += dt
        self.m.poll_once()
        return self.m.snapshot()


class T3ParsesDetectionJson(unittest.TestCase):
    def test_documented_sample_is_parsed(self):
        s = Mon().poll()
        self.assertEqual(s["status"], "OK")
        self.assertEqual([d["cls"] for d in s["detections"]], ["boat", "person"])
        self.assertEqual(s["detections"][1]["conf_pct"], 57)
        self.assertEqual(s["detections"][0]["box"], [120, 200, 260, 300])
        self.assertEqual((s["fps"], s["infer_ms"], s["model"]), (9.8, 38.2, "yolo26n.pt"))

    def test_polls_only_the_detections_endpoint(self):
        t = Mon()
        t.poll()
        self.assertEqual(t.url, "http://127.0.0.1:8001/detections")


class T4Labels(unittest.TestCase):
    def test_operator_labels_for_all_supported_classes(self):
        dets = [{"cls": c, "conf": 0.6, "box": [0, 0, 1, 1]} for c in ("person", "boat", "bird", "surfboard", "bottle")]
        s = Mon().poll({**SAMPLE, "dets": dets})
        self.assertEqual([d["label"] for d in s["detections"]],
                         ["Person detected", "Vessel detected", "Bird detected", "Board detected", "Bottle detected"])

    def test_unknown_class_gets_generic_label_not_a_claim(self):
        s = Mon().poll({**SAMPLE, "dets": [{"cls": "buoy", "conf": 0.5, "box": [0, 0, 1, 1]}]})
        self.assertEqual(s["detections"][0]["label"], "Object detected (buoy)")

    def test_detection_events_say_review_required_and_never_claim_an_emergency(self):
        t = Mon()
        t.poll()
        texts = " ".join(text for _, text in t.events).lower()
        self.assertIn("operator review required", texts)
        for banned in ("in the water", "drowning", "emergency", "damage", "pollution"):
            self.assertNotIn(banned, texts)
        self.assertTrue(all(level != "fault" for level, _ in t.events))   # a camera event is never a fault

    def test_repeated_detections_do_not_flood_the_event_log(self):
        t = Mon()
        for _ in range(10):
            t.poll({**SAMPLE, "seq": t.m.last_seq + 1 if t.m.last_seq else 1})
        self.assertLessEqual(len([e for e in t.events if "person" in e[1]]), 1)


class T5RealVersusTestInput(unittest.TestCase):
    def test_labels(self):
        self.assertEqual(Mon().poll({**SAMPLE, "src": "esp32"})["input"], "REAL CAMERA")
        for src in ("webcam", "file"):
            s = Mon().poll({**SAMPLE, "src": src})
            self.assertEqual((s["input"], s["src"]), ("TEST INPUT", src))

    def test_test_input_is_flagged_in_the_event_log(self):
        t = Mon()
        t.poll({**SAMPLE, "src": "webcam"})
        self.assertTrue(any("TEST INPUT" in text for _, text in t.events))


class T6CameraDown(unittest.TestCase):
    def test_down_message_without_optional_fields(self):
        t = Mon()
        t.poll()
        s = t.poll(DOWN)
        self.assertEqual(s["status"], "CAMERA_DOWN")
        self.assertEqual((s["detections"], s["fps"], s["infer_ms"]), ([], None, None))
        self.assertTrue(any("CAMERA DOWN" in text for _, text in t.events))

    def test_recovery_after_down(self):
        t = Mon()
        t.poll(DOWN)
        self.assertEqual(t.poll({**SAMPLE, "seq": 900})["status"], "OK")


class CameraSwitch(unittest.TestCase):
    def test_off_stops_polling_and_clears_detections_then_on_resumes(self):
        t = Mon()
        self.assertEqual(t.poll()["status"], cam.OK)
        self.assertEqual(t.m.set_enabled(False), (True, "ok"))
        t.url = None
        s = t.poll()
        self.assertEqual((s["status"], s["detections"], t.url), (cam.OFF, [], None))   # not even fetched
        self.assertTrue(any("turned off" in text for _, text in t.events))
        t.m.set_enabled(True)
        self.assertEqual(t.poll()["status"], cam.OK)
        self.assertEqual(len(t.m.snapshot()["detections"]), 2)

    def test_switch_without_a_viewer_is_refused(self):
        self.assertFalse(Mon(url=None).m.set_enabled(False)[0])


class T7MalformedOrMissingResponses(unittest.TestCase):
    def test_bad_responses_never_raise_and_never_show_detections(self):
        bad = [None, [], "text", 42, {}, {"cam": "OK"}, {"cam": "MAYBE", "src": "esp32"},
               {"cam": "OK", "src": 5}, {**SAMPLE, "dets": "boat"}, {**SAMPLE, "dets": {"cls": "boat"}}]
        for reply in bad:
            s = Mon().poll(reply)
            self.assertEqual(s["status"], "BAD_RESPONSE", msg=repr(reply))
            self.assertEqual(s["detections"], [], msg=repr(reply))

    def test_unreachable_viewer_and_non_json_are_handled(self):
        for exc, status in ((urllib.error.URLError("refused"), "VIEWER_UNREACHABLE"), (socket.timeout(), "VIEWER_UNREACHABLE"),
                            (ConnectionResetError(), "VIEWER_UNREACHABLE"), (json.JSONDecodeError("x", "y", 0), "BAD_RESPONSE")):
            self.assertEqual(Mon().poll(exc)["status"], status, msg=repr(exc))

    def test_malformed_detection_entries_are_dropped_and_counted(self):
        junk = [{"cls": "person", "conf": 1.5, "box": [0, 0, 1, 1]}, {"cls": "person", "conf": "high", "box": [0, 0, 1, 1]},
                {"cls": "person", "conf": float("nan"), "box": [0, 0, 1, 1]}, {"cls": 5, "conf": 0.5, "box": [0, 0, 1, 1]},
                {"cls": "person", "conf": 0.5, "box": [0, 0, 1]}, {"cls": "person", "conf": 0.5}, "x", None,
                {"cls": "boat", "conf": 0.9, "box": [1, 2, 3, 4]}]
        s = Mon().poll({**SAMPLE, "dets": junk})
        self.assertEqual(s["status"], "OK")
        self.assertEqual([d["cls"] for d in s["detections"]], ["boat"])
        self.assertEqual(s["ignored"], 8)

    def test_missing_optional_fields_are_fine(self):
        s = Mon().poll({"cam": "OK", "src": "webcam", "dets": []})
        self.assertEqual((s["status"], s["fps"], s["detections"]), ("OK", None, []))

    def test_unreachable_viewer_does_not_keep_showing_old_detections(self):
        t = Mon()
        self.assertEqual(len(t.poll()["detections"]), 2)
        s = t.poll(urllib.error.URLError("gone"))
        self.assertEqual((s["status"], s["detections"], s["fps"]), ("VIEWER_UNREACHABLE", [], None))

    def test_viewer_not_configured_is_a_quiet_placeholder(self):
        mon = cam.CameraMonitor(None)
        mon.poll_once()
        self.assertEqual(mon.snapshot()["status"], "NOT_CONFIGURED")


class T8StaleData(unittest.TestCase):
    def test_frozen_sequence_is_not_presented_as_live(self):
        t = Mon()
        self.assertEqual(t.poll()["status"], "OK")
        for _ in range(4):                           # same seq for 1.6 s: still tolerated
            s = t.poll()
        self.assertEqual(s["status"], "OK")
        s = t.poll(dt=0.8)                           # now more than 2.0 s with the same seq
        self.assertEqual(s["status"], "STALE")
        self.assertEqual((s["detections"], s["fps"]), ([], None))
        self.assertTrue(any("frozen" in text for _, text in t.events))

    def test_moving_sequence_recovers_and_stays_live(self):
        t = Mon()
        t.poll()
        for _ in range(8):
            t.poll()
        self.assertEqual(t.poll()["status"], "STALE")
        self.assertEqual(t.poll({**SAMPLE, "seq": 813})["status"], "OK")

    def test_without_sequence_number_freshness_is_not_guessed(self):
        t = Mon()
        msg = {k: v for k, v in SAMPLE.items() if k != "seq"}
        for _ in range(10):
            s = t.poll(msg)
        self.assertEqual(s["status"], "OK")



class ConfigGuards(unittest.TestCase):
    def test_viewer_url_must_be_the_viewer_never_the_esp32_stream(self):
        for ok in ("http://127.0.0.1:8001", "http://192.168.1.20:8001/", "https://viewer.example:8001"):
            Config(camera_viewer_url=ok).validate()
        for bad in ("http://seasafe-cam.local:81/stream", "http://172.20.10.2:81/stream", "http://127.0.0.1:8001/stream.mjpg",
                    "http://127.0.0.1:8001/?x=1", "javascript:alert(1)", "127.0.0.1:8001", "http://a b:8001"):
            with self.assertRaises(ValueError, msg=bad):
                Config(camera_viewer_url=bad).validate()


class MockViewer:
    """A real local HTTP server that imitates vision/viewer.py's /detections (MOCK, not the real viewer)."""

    def __init__(self):
        self.reply, self.paths = SAMPLE, []
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                outer.paths.append(self.path)
                if self.path != "/detections":
                    self.send_response(404)
                    self.end_headers()
                    return
                body = outer.reply if isinstance(outer.reply, bytes) else json.dumps(outer.reply).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


class T1DashboardStartsAndT2PanelOverHttp(unittest.TestCase):
    """Starts the real dashboard web server against a MOCK viewer and talks to it over HTTP."""

    @classmethod
    def setUpClass(cls):
        cls.viewer = MockViewer()
        cls.dash = Dashboard(Config(camera_viewer_url=cls.viewer.url))
        cls.dash.camera.start()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(cls.dash))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.dash.camera.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.viewer.close()

    def state(self):
        return json.load(urllib.request.urlopen(self.base + "/api/state", timeout=2))

    def wait_for(self, status):
        for _ in range(40):
            s = self.state()
            if s["camera"]["status"] == status:
                return s
            time.sleep(0.1)
        self.fail(f"camera never reached {status}; last: {self.state()['camera']['status']}")

    def test_t1_page_and_state_are_served_and_page_has_the_camera_panel(self):
        page = urllib.request.urlopen(self.base + "/", timeout=2).read().decode()
        self.assertIn("seaguardian", page.lower())
        self.assertIn('id="camimg"', page)
        self.assertEqual(self.state()["mode"], "HARDWARE")

    def test_t2_state_exposes_the_viewer_stream_url_and_detections(self):
        s = self.wait_for("OK")
        self.assertEqual(s["camera"]["stream_url"], self.viewer.url + "/stream.mjpg")
        self.assertEqual(len(s["camera"]["detections"]), 2)

    def test_dashboard_server_never_requests_the_video_stream_itself(self):
        self.wait_for("OK")
        self.assertTrue(set(self.viewer.paths) <= {"/detections"}, self.viewer.paths)

    def test_viewer_going_away_and_coming_back_without_restarting_the_dashboard(self):
        self.viewer.reply = b"this is not json"
        self.assertEqual(self.wait_for("BAD_RESPONSE")["camera"]["detections"], [])
        self.viewer.reply = {**SAMPLE, "src": "webcam", "seq": 5000}
        s = self.wait_for("OK")
        self.assertEqual(s["camera"]["input"], "TEST INPUT")
        self.assertFalse(s["estop"])               # the boat side was never disturbed


if __name__ == "__main__":
    unittest.main()
