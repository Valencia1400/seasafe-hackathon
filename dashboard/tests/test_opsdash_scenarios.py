"""Scenario tests for the operator dashboard + simulated ESP32 (software simulation only).

These show that the SIMULATED logic behaves as documented. They are not
evidence that real hardware is safe.
Run from the dashboard folder:  python -m unittest discover -s tests -v
"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from opsdash import mission as m  # noqa: E402
from opsdash.config import Config  # noqa: E402
from opsdash.console import OperatorConsole  # noqa: E402


class Bench:
    def __init__(self, config=None):
        self.now = 0.0
        self.c = OperatorConsole(self.now, wall=lambda: self.now, config=config)
        self.run(0.5)  # let heartbeat + first telemetry flow

    def run(self, seconds, dt=0.05):
        end = self.now + seconds
        while self.now < end - 1e-9:
            self.now = round(self.now + dt, 6)
            self.c.tick(self.now)

    @property
    def tel(self):
        return self.c.telemetry

    @property
    def state(self):
        return self.c.mission.state

    def texts(self):
        return [e["text"] for e in self.c.mission.events]


class Scenario1NormalMission(unittest.TestCase):
    def test_start_telemetry_updates_and_stop(self):
        b = Bench()
        self.assertEqual(b.state, m.READY)
        lat0 = b.tel["lat"]
        self.assertTrue(b.c.start(b.now)[0])
        b.run(3)
        self.assertEqual(b.state, m.RUNNING)
        self.assertGreater(b.tel["thr"], 0)
        self.assertNotEqual(b.tel["lat"], lat0)         # simulated position moves
        self.assertEqual(b.tel["src"], "SIM")
        self.assertTrue(b.c.stop(b.now)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.STOPPED)
        self.assertEqual(b.tel["thr"], 0)

    def test_cannot_start_without_communication(self):
        b = Bench()
        b.c.scenario(b.now, "link_cut")
        b.run(1.5)
        self.assertFalse(b.c.start(b.now)[0])
        self.assertEqual(b.state, m.READY)


class Scenario2Tilt(unittest.TestCase):
    def test_tilt_event_shows_warning_then_clears(self):
        b = Bench()
        b.c.scenario(b.now, "tilt")
        seen = False
        for _ in range(60):
            b.run(0.05)
            seen = seen or b.c.tilt_warning
        self.assertTrue(seen)
        self.assertTrue(any(t.startswith("TILT WARNING") for t in b.texts()))
        b.run(5)
        self.assertFalse(b.c.tilt_warning)
        self.assertEqual(b.state, m.READY)  # a tilt warning is not a fault


class Scenario3CommsFailure(unittest.TestCase):
    def test_timeout_stops_motor_and_faults_until_deliberate_reset(self):
        b = Bench()
        b.c.start(b.now)
        b.run(2)
        self.assertGreater(b.c.esp.thr, 0)
        b.c.scenario(b.now, "link_cut")
        b.run(0.8)
        self.assertGreater(b.c.esp.thr, 0)           # 1.0 s timeout not reached yet
        b.run(0.8)
        self.assertEqual(b.c.esp.thr, 0)             # controller stopped itself
        self.assertEqual(b.c.esp.state, "COMMLOST")
        self.assertEqual(b.state, m.FAULT)           # dashboard reports the fault
        self.assertIn(m.COMMS_LOST, b.c.mission.fault_causes)
        self.assertFalse(b.c.reset(b.now, confirmed=True)[0])   # refused: link still down
        b.c.scenario(b.now, "link_restore")
        b.run(1)
        self.assertEqual(b.state, m.FAULT)           # restoring the link does NOT clear the fault
        self.assertEqual(b.tel["thr"], 0)
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.READY)
        self.assertEqual(b.tel["thr"], 0)            # reset did not restart the motor
        self.assertEqual(b.tel["state"], "OK")

    def test_link_cut_while_ready_blocks_start_without_fault(self):
        b = Bench()
        b.c.scenario(b.now, "link_cut")
        b.run(1.5)
        self.assertEqual(b.state, m.READY)
        self.assertFalse(b.c.comms_ok)


class Scenario4EmergencyStop(unittest.TestCase):
    def test_estop_stops_motor_and_needs_confirmed_reset_then_start(self):
        b = Bench()
        b.c.start(b.now)
        b.run(2)
        b.c.estop(b.now)
        b.run(0.5)
        self.assertEqual(b.state, m.FAULT)
        self.assertEqual(b.tel["thr"], 0)
        self.assertEqual(b.tel["state"], "ESTOP")
        self.assertFalse(b.c.start(b.now)[0])
        self.assertFalse(b.c.reset(b.now, confirmed=False)[0])
        b.run(2)
        self.assertEqual(b.state, m.FAULT)           # still latched, no auto-recovery
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(1)
        self.assertEqual(b.state, m.READY)
        self.assertEqual(b.tel["thr"], 0)            # NOT restarted by reset
        self.assertTrue(b.c.start(b.now)[0])

    def test_estop_with_cut_link_is_flagged_and_controller_timeout_still_stops_motor(self):
        b = Bench()
        b.c.start(b.now)
        b.run(1)
        b.c.scenario(b.now, "link_cut")
        b.c.estop(b.now)
        self.assertTrue(any("could not reach" in t for t in b.texts()))
        b.run(1.3)
        self.assertEqual(b.c.esp.thr, 0)


class Scenario5Steering(unittest.TestCase):
    def test_rudder_command_reaches_servo_and_is_clamped(self):
        b = Bench()
        b.c.set_rudder(b.now, 15)
        b.run(0.8)
        self.assertAlmostEqual(b.tel["rud"], 15, delta=0.2)
        self.assertTrue(any("Rudder command changed to +15" in t for t in b.texts()))
        b.c.set_rudder(b.now, 99)
        b.run(1.5)
        self.assertEqual(b.c.rud_cmd, 30)            # default PLACEHOLDER limit
        self.assertAlmostEqual(b.tel["rud"], 30, delta=0.2)

    def test_starboard_rudder_gives_positive_yaw_rate_when_moving(self):
        b = Bench()
        b.c.start(b.now)
        b.c.set_rudder(b.now, 20)
        b.run(2)
        self.assertGreater(b.c.imu()["yaw_rate"], 3)
        b.c.set_rudder(b.now, -20)
        b.run(2)
        self.assertLess(b.c.imu()["yaw_rate"], -3)

    def test_rudder_blocked_in_fault(self):
        b = Bench()
        b.c.estop(b.now)
        self.assertFalse(b.c.set_rudder(b.now, 10)[0])

    def test_rudder_centres_on_stop_when_configured(self):
        b = Bench()
        b.c.start(b.now)
        b.c.set_rudder(b.now, 20)
        b.run(1)
        b.c.estop(b.now)
        b.run(1)
        self.assertEqual(b.c.rud_cmd, 0)
        self.assertAlmostEqual(b.tel["rud"], 0, delta=0.2)

    def test_rudder_holds_on_stop_when_centering_disabled(self):
        b = Bench(Config(rudder_centre_on_stop=False))
        b.c.set_rudder(b.now, 20)
        b.run(1)
        b.c.estop(b.now)
        b.run(1)
        self.assertAlmostEqual(b.tel["rud"], 20, delta=0.2)


class LeakGpsAndRestart(unittest.TestCase):
    def test_leak_faults_and_reset_refused_until_dry(self):
        b = Bench()
        b.c.start(b.now)
        b.run(1)
        b.c.scenario(b.now, "leak_on")
        b.run(0.6)
        self.assertEqual(b.state, m.FAULT)
        self.assertIn(m.LEAK, b.c.mission.fault_causes)
        self.assertEqual(b.tel["thr"], 0)
        self.assertFalse(b.c.reset(b.now, confirmed=True)[0])
        b.c.scenario(b.now, "leak_off")
        b.run(0.6)
        self.assertEqual(b.state, m.FAULT)           # dry again, still needs reset
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(0.6)
        self.assertEqual(b.state, m.READY)

    def test_gps_fix_lost_reports_null_position_and_warns(self):
        b = Bench()
        b.c.scenario(b.now, "gps_off")
        b.run(0.6)
        self.assertEqual(b.tel["fix"], 0)
        self.assertIsNone(b.tel["lat"])
        self.assertIn("GPS: NO FIX", b.c.snapshot(b.now)["warnings"])
        n = len(b.c.track)
        b.run(1)
        self.assertEqual(len(b.c.track), n)          # no invented track points without a fix
        b.c.scenario(b.now, "gps_on")
        b.run(0.6)
        self.assertEqual(b.tel["fix"], 1)

    def test_restart_simulation_needs_confirmation_and_returns_to_clean_ready(self):
        b = Bench()
        b.c.estop(b.now)
        self.assertFalse(b.c.scenario(b.now, "restart")[0])
        self.assertEqual(b.state, m.FAULT)
        self.assertTrue(b.c.scenario(b.now, "restart", confirmed=True)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.READY)
        self.assertTrue(b.c.start(b.now)[0])


class ConfigurableLimitsAndImuMounting(unittest.TestCase):
    def test_rudder_limit_and_throttle_are_configurable(self):
        b = Bench(Config(rudder_limit_deg=20, throttle_run=0.25, throttle_max=0.3))
        b.c.start(b.now)
        b.c.set_rudder(b.now, 99)
        b.run(1.5)
        self.assertEqual(b.c.rud_cmd, 20)
        self.assertAlmostEqual(b.tel["rud"], 20, delta=0.2)
        self.assertAlmostEqual(b.tel["thr"], 0.25, delta=0.01)

    def test_controller_enforces_its_own_limits_even_if_laptop_asks_for_more(self):
        b = Bench(Config(rudder_limit_deg=20, throttle_run=0.3, throttle_max=0.3))
        b.c.esp.handle({"t": "cmd", "thr": 1.0, "rud": 80}, b.now)
        self.assertEqual((b.c.esp.thr, b.c.esp.rud_cmd), (0.3, 20))

    def test_imu_mounting_flips_signs_and_swaps_axes_without_touching_raw_data(self):
        b = Bench(Config(imu_yaw_sign=-1, imu_roll_sign=-1, imu_swap_roll_pitch=True))
        raw = b.tel
        vessel = b.c.imu()
        self.assertEqual(vessel["yaw_rate"], round(-raw["gz"], 1))
        self.assertEqual(vessel["roll"], round(-raw["pitch"], 1))   # swapped, then roll sign applied
        self.assertEqual(vessel["pitch"], round(raw["roll"], 1))

    def test_missing_imu_is_null_not_zero_and_gives_no_tilt_warning(self):
        b = Bench()
        b.c._on_telemetry({**b.tel, "roll": None, "pitch": None, "gz": None}, b.now)
        self.assertEqual(b.c.imu(), {"roll": None, "pitch": None, "yaw_rate": None})
        self.assertFalse(b.c.tilt_warning)

    def test_invalid_config_is_rejected(self):
        for bad in ({"rudder_limit_deg": 0}, {"rudder_limit_deg": 120}, {"throttle_run": 0.9, "throttle_max": 0.5},
                    {"imu_yaw_sign": 2}, {"tilt_warning_deg": -1}):
            with self.assertRaises(ValueError, msg=str(bad)):
                Config(**bad).validate()

    def test_config_file_overrides_and_unknown_keys_fail(self):
        with tempfile.TemporaryDirectory() as d:
            ok, bad = Path(d, "ok.json"), Path(d, "bad.json")
            ok.write_text(json.dumps({"rudder_limit_deg": 25, "imu_yaw_sign": -1}))
            bad.write_text(json.dumps({"rudder_limt_deg": 25}))   # typo must not be ignored silently
            cfg = Config.from_json(ok)
            self.assertEqual((cfg.rudder_limit_deg, cfg.imu_yaw_sign, cfg.throttle_run), (25, -1, 0.4))
            with self.assertRaises(ValueError):
                Config.from_json(bad)

    def test_camera_viewer_url_defaults_to_placeholder_and_is_validated(self):
        b = Bench()
        self.assertIsNone(b.c.snapshot(b.now)["camera"]["viewer_url"])  # no monitor: placeholder
        self.assertEqual(b.c.snapshot(b.now)["camera"]["status"], "NOT_CONFIGURED")
        self.assertEqual(Config(camera_viewer_url="http://127.0.0.1:8001/").to_dict()["camera_viewer_url"],
                         "http://127.0.0.1:8001")
        for bad in ("javascript:alert(1)", "127.0.0.1:8001", "file:///etc/passwd", 5):
            with self.assertRaises(ValueError, msg=str(bad)):
                Config(camera_viewer_url=bad).validate()

    def test_snapshot_lists_unconfirmed_values(self):
        b = Bench()
        cfg = b.c.snapshot(b.now)["config"]
        for key in ("rudder_limit_deg", "throttle_run", "imu_yaw_sign"):
            self.assertIn(key, cfg["unconfirmed"])


if __name__ == "__main__":
    unittest.main()
