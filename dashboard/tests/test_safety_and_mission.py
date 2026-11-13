"""Unit tests for the simulator's safety rules and the laptop controller.

Run from the dashboard folder:  python -m unittest discover -s tests -v
These test the SIMULATOR and the laptop logic, not the real ESP32 firmware.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from seaguardian import protocol as p  # noqa: E402
from seaguardian.controller import Controller  # noqa: E402
from seaguardian.sim_esp32 import SimulatedESP32  # noqa: E402


class Bench:
    """Controller + simulated ESP32 wired together, driven by a fake clock."""

    def __init__(self):
        self.now = 0.0
        self.esp = SimulatedESP32(self.now)
        self.ctl = Controller(lambda m: self.esp.handle(m, self.now), self.now, wall=lambda: self.now)

    def run(self, seconds, dt=0.05):
        end = self.now + seconds
        while self.now < end - 1e-9:
            self.now = round(self.now + dt, 6)
            self.esp.step(self.now)
            for msg in self.esp.drain():
                self.ctl.on_message(msg, self.now)
            self.ctl.tick(self.now)

    def texts(self):
        return [e["text"] for e in self.ctl.events]


class SimulatedEsp32Safety(unittest.TestCase):
    def test_motors_zero_at_boot_and_commands_ignored_before_first_heartbeat(self):
        esp = SimulatedESP32(0.0)
        esp.handle(p.motor_cmd(0.5, 0.5), 0.1)
        self.assertEqual((esp.left, esp.right), (0.0, 0.0))

    def test_heartbeat_timeout_stops_motors(self):
        esp = SimulatedESP32(0.0)
        esp.handle(p.heartbeat(1), 0.0)
        esp.handle(p.motor_cmd(0.5, 0.5), 0.0)
        esp.step(1.0)
        self.assertEqual(esp.state, p.OK)  # exactly at the limit: still OK
        esp.step(1.05)
        self.assertEqual(esp.state, p.COMMLOST)
        self.assertEqual((esp.left, esp.right), (0.0, 0.0))

    def test_commlost_needs_fresh_heartbeat_and_reset(self):
        esp = SimulatedESP32(0.0)
        esp.handle(p.heartbeat(1), 0.0)
        esp.step(2.0)
        esp.handle(p.RESET_MSG, 2.0)  # heartbeat still stale -> stays stopped
        self.assertEqual(esp.state, p.COMMLOST)
        esp.handle(p.heartbeat(2), 2.1)
        esp.handle(p.motor_cmd(0.5, 0.5), 2.1)  # ignored while stopped
        self.assertEqual(esp.left, 0.0)
        esp.handle(p.RESET_MSG, 2.1)
        self.assertEqual(esp.state, p.OK)

    def test_estop_latches_until_reset(self):
        esp = SimulatedESP32(0.0)
        esp.handle(p.heartbeat(1), 0.0)
        esp.handle(p.motor_cmd(0.5, 0.5), 0.0)
        esp.handle(p.ESTOP_MSG, 0.1)
        esp.handle(p.motor_cmd(0.5, 0.5), 0.15)
        self.assertEqual((esp.state, esp.left), (p.ESTOP, 0.0))
        esp.handle(p.RESET_MSG, 0.2)
        self.assertEqual(esp.state, p.OK)

    def test_leak_stops_and_reset_only_when_dry(self):
        esp = SimulatedESP32(0.0)
        esp.handle(p.heartbeat(1), 0.0)
        esp.handle(p.motor_cmd(0.5, 0.5), 0.0)
        esp.leak = True
        esp.step(0.05)
        self.assertEqual((esp.state, esp.left), (p.LEAK, 0.0))
        esp.handle(p.RESET_MSG, 0.1)
        self.assertEqual(esp.state, p.LEAK)
        esp.leak = False
        esp.handle(p.RESET_MSG, 0.1)
        self.assertEqual(esp.state, p.OK)

    def test_telemetry_is_labelled_simulated(self):
        esp = SimulatedESP32(0.0)
        esp.step(0.1)
        tel = esp.drain()[-1]
        self.assertEqual(tel["src"], "SIM")
        self.assertEqual(set(["seq", "ms", "roll", "pitch", "p_hpa", "leak", "l", "r", "state"]) - set(tel), set())


class ControllerWithSimulator(unittest.TestCase):
    def test_full_mission_runs_to_done(self):
        b = Bench()
        b.run(0.5)
        self.assertEqual(b.ctl.start_mission(b.now), "Mission started.")
        b.run(1.0)
        self.assertGreater(b.esp.left, 0.0)  # motors driven during transit
        b.run(25.0)
        self.assertEqual(b.ctl.mission, "DONE")
        self.assertIsNotNone(b.ctl.inspection_report)
        self.assertEqual(b.esp.left, 0.0)

    def test_cut_link_makes_esp_stop_within_timeout(self):
        b = Bench()
        b.run(0.5)
        b.ctl.start_mission(b.now)
        b.run(1.0)
        b.ctl.cut_link(b.now)
        # The 1.0 s timeout counts from the LAST heartbeat, which was sent up to
        # 0.2 s before the cut: the stop comes 0.8-1.05 s after the cut.
        b.run(0.75)
        self.assertEqual(b.esp.state, p.OK)  # not yet
        b.run(0.35)
        self.assertEqual(b.esp.state, p.COMMLOST)
        self.assertEqual(b.esp.left, 0.0)
        self.assertEqual(b.ctl.mission, "ABORTED")
        self.assertTrue(any("after the link was cut" in t for t in b.texts()))

    def test_estop_aborts_and_restart_needs_reset(self):
        b = Bench()
        b.run(0.5)
        b.ctl.start_mission(b.now)
        b.run(1.0)
        b.ctl.estop(b.now)
        b.run(0.2)
        self.assertEqual((b.esp.state, b.esp.left, b.ctl.mission), (p.ESTOP, 0.0, "ABORTED"))
        self.assertIn("Cannot start", b.ctl.start_mission(b.now))
        b.ctl.reset(b.now)
        b.run(0.2)
        self.assertEqual(b.ctl.start_mission(b.now), "Mission started.")

    def test_tilt_warns_but_does_not_stop(self):
        b = Bench()
        b.run(0.5)
        b.ctl.start_mission(b.now)
        b.esp.tilt_deg = 40.0
        b.run(0.3)
        self.assertTrue(b.ctl.tilt_warning)
        self.assertEqual(b.ctl.mission, "TRANSIT")
        self.assertTrue(any(t.startswith("TILT warning") for t in b.texts()))

    def test_leak_aborts_mission(self):
        b = Bench()
        b.run(0.5)
        b.ctl.start_mission(b.now)
        b.esp.leak = True
        b.run(0.3)
        self.assertEqual((b.esp.state, b.ctl.mission), (p.LEAK, "ABORTED"))

    def test_sequence_gaps_are_counted(self):
        b = Bench()
        b.ctl.on_message({"t": "tel", "seq": 1, "state": "OK"}, 0.0)
        b.ctl.on_message({"t": "tel", "seq": 4, "state": "OK"}, 0.1)
        self.assertEqual((b.ctl.rx_count, b.ctl.seq_gaps), (2, 2))

    def test_missing_sensor_values_do_not_crash(self):
        b = Bench()
        b.ctl.on_message({"t": "tel", "seq": 1, "roll": None, "pitch": None, "p_hpa": None, "state": "OK"}, 0.0)
        self.assertFalse(b.ctl.tilt_warning)

    def test_bad_lines_are_rejected(self):
        self.assertIsNone(p.decode("garbage"))
        self.assertIsNone(p.decode('{"no_type":1}'))
        self.assertEqual(p.decode('{"t":"hb","seq":3}'), {"t": "hb", "seq": 3})


if __name__ == "__main__":
    unittest.main()
