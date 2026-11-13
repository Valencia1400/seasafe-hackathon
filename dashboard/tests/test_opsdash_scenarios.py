"""Scenario tests for the operator dashboard + simulated ESP32 (software simulation only).

These show that the SIMULATED logic behaves as documented. They are not
evidence that real hardware is safe.
Run from the dashboard folder:  python -m unittest discover -s tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from opsdash import mission as m  # noqa: E402
from opsdash.console import OperatorConsole  # noqa: E402


class Bench:
    def __init__(self):
        self.now = 0.0
        self.c = OperatorConsole(self.now, wall=lambda: self.now)
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
        lat0 = b.tel["gps"]["lat"]
        self.assertTrue(b.c.start(b.now)[0])
        b.run(3)
        self.assertEqual(b.state, m.RUNNING)
        self.assertTrue(b.tel["motor"]["running"])
        self.assertNotEqual(b.tel["gps"]["lat"], lat0)         # simulated position moves
        self.assertEqual(b.tel["src"], "SIM")
        self.assertTrue(b.c.stop(b.now)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.STOPPED)
        self.assertFalse(b.tel["motor"]["running"])

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
        self.assertTrue(b.c.esp.motor_run)
        b.c.scenario(b.now, "link_cut")
        b.run(0.8)
        self.assertTrue(b.c.esp.motor_run)           # 1.0 s timeout not reached yet
        b.run(0.8)
        self.assertFalse(b.c.esp.motor_run)          # controller stopped itself
        self.assertEqual(b.c.esp.fault, "COMMS_TIMEOUT")
        self.assertEqual(b.state, m.FAULT)           # dashboard reports the fault
        self.assertIn(m.COMMS_LOST, b.c.mission.fault_causes)
        self.assertFalse(b.c.reset(b.now, confirmed=True)[0])   # refused: link still down
        b.c.scenario(b.now, "link_restore")
        b.run(1)
        self.assertEqual(b.state, m.FAULT)           # restoring the link does NOT clear the fault
        self.assertFalse(b.tel["motor"]["running"])
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.READY)
        self.assertFalse(b.tel["motor"]["running"])  # reset did not restart the motor
        self.assertIsNone(b.tel["fault"])

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
        self.assertFalse(b.tel["motor"]["running"])
        self.assertEqual(b.tel["fault"], "ESTOP")
        self.assertFalse(b.c.start(b.now)[0])
        self.assertFalse(b.c.reset(b.now, confirmed=False)[0])
        b.run(2)
        self.assertEqual(b.state, m.FAULT)           # still latched, no auto-recovery
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(1)
        self.assertEqual(b.state, m.READY)
        self.assertFalse(b.tel["motor"]["running"])  # NOT restarted by reset
        self.assertTrue(b.c.start(b.now)[0])

    def test_estop_with_cut_link_is_flagged_and_controller_timeout_still_stops_motor(self):
        b = Bench()
        b.c.start(b.now)
        b.run(1)
        b.c.scenario(b.now, "link_cut")
        b.c.estop(b.now)
        self.assertTrue(any("could not reach" in t for t in b.texts()))
        b.run(1.3)
        self.assertFalse(b.c.esp.motor_run)


class Scenario5Steering(unittest.TestCase):
    def test_rudder_command_reaches_servo_and_is_clamped(self):
        b = Bench()
        b.c.set_rudder(b.now, 15)
        b.run(0.8)
        self.assertEqual(b.tel["rudder"]["command_deg"], 15)
        self.assertAlmostEqual(b.tel["rudder"]["angle_deg"], 15, delta=0.2)
        self.assertTrue(any("Rudder command changed to +15" in t for t in b.texts()))
        b.c.set_rudder(b.now, 99)
        b.run(1.5)
        self.assertEqual(b.tel["rudder"]["command_deg"], 30)

    def test_starboard_rudder_gives_positive_yaw_rate_when_moving(self):
        b = Bench()
        b.c.start(b.now)
        b.c.set_rudder(b.now, 20)
        b.run(2)
        self.assertGreater(b.tel["imu"]["yaw_rate_dps"], 5)
        b.c.set_rudder(b.now, -20)
        b.run(2)
        self.assertLess(b.tel["imu"]["yaw_rate_dps"], -5)

    def test_rudder_blocked_in_fault(self):
        b = Bench()
        b.c.estop(b.now)
        self.assertFalse(b.c.set_rudder(b.now, 10)[0])


class LeakAndRestart(unittest.TestCase):
    def test_leak_faults_and_reset_refused_until_dry(self):
        b = Bench()
        b.c.start(b.now)
        b.run(1)
        b.c.scenario(b.now, "leak_on")
        b.run(0.6)
        self.assertEqual(b.state, m.FAULT)
        self.assertIn(m.LEAK, b.c.mission.fault_causes)
        self.assertFalse(b.tel["motor"]["running"])
        self.assertFalse(b.c.reset(b.now, confirmed=True)[0])
        b.c.scenario(b.now, "leak_off")
        b.run(0.6)
        self.assertEqual(b.state, m.FAULT)           # dry again, still needs reset
        self.assertTrue(b.c.reset(b.now, confirmed=True)[0])
        b.run(0.6)
        self.assertEqual(b.state, m.READY)

    def test_restart_simulation_needs_confirmation_and_returns_to_clean_ready(self):
        b = Bench()
        b.c.estop(b.now)
        self.assertFalse(b.c.scenario(b.now, "restart")[0])
        self.assertEqual(b.state, m.FAULT)
        self.assertTrue(b.c.scenario(b.now, "restart", confirmed=True)[0])
        b.run(0.5)
        self.assertEqual(b.state, m.READY)
        self.assertTrue(b.c.start(b.now)[0])


if __name__ == "__main__":
    unittest.main()
