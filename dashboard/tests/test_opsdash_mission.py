"""Tests for the operator dashboard mission state machine (simulation logic only).

Run from the dashboard folder:  python -m unittest discover -s tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from opsdash.mission import (COMMS_LOST, ESTOP, FAULT, READY, RUNNING, STOPPED,  # noqa: E402
                             MissionStateMachine)


class MissionStateMachineTests(unittest.TestCase):
    def setUp(self):
        self.m = MissionStateMachine(clock=lambda: 0.0)

    def test_starts_ready_with_motor_stopped(self):
        self.assertEqual(self.m.state, READY)
        self.assertEqual(self.m.motor_command, "STOPPED")

    def test_normal_mission_start_stop_reset(self):
        self.assertTrue(self.m.start()[0])
        self.assertEqual(self.m.state, RUNNING)
        self.assertNotEqual(self.m.motor_command, "STOPPED")
        self.assertTrue(self.m.stop()[0])
        self.assertEqual((self.m.state, self.m.motor_command), (STOPPED, "STOPPED"))
        self.assertFalse(self.m.start()[0])  # cannot restart straight from STOPPED
        self.assertTrue(self.m.reset()[0])
        self.assertEqual(self.m.state, READY)

    def test_invalid_commands_are_rejected_and_logged(self):
        self.assertFalse(self.m.stop()[0])    # nothing running
        self.assertFalse(self.m.reset()[0])   # nothing to reset
        self.m.start()
        self.assertFalse(self.m.start()[0])   # already running
        self.assertEqual(self.m.state, RUNNING)
        self.assertTrue(any(e["text"].startswith("Rejected") for e in self.m.events))

    def test_estop_works_from_every_state_and_stops_motor(self):
        for setup in (lambda: None, self.m.start, lambda: (self.m.start(), self.m.stop())):
            m = self.m = MissionStateMachine(clock=lambda: 0.0)
            setup()
            m.estop()
            self.assertEqual((m.state, m.motor_command), (FAULT, "STOPPED"))
            self.assertIn(ESTOP, m.fault_causes)

    def test_fault_cannot_be_cleared_by_start_stop_or_unconfirmed_reset(self):
        self.m.start()
        self.m.estop()
        self.assertFalse(self.m.start()[0])
        self.assertFalse(self.m.stop()[0])
        self.assertFalse(self.m.reset()[0])
        self.assertFalse(self.m.reset(confirmed=False)[0])
        self.assertEqual(self.m.state, FAULT)

    def test_confirmed_reset_goes_to_ready_and_never_restarts_motor(self):
        self.m.start()
        self.m.estop()
        self.assertTrue(self.m.reset(confirmed=True)[0])
        self.assertEqual((self.m.state, self.m.motor_command), (READY, "STOPPED"))
        self.assertEqual(self.m.fault_causes, [])

    def test_reset_refused_while_condition_still_active(self):
        self.m.start()
        self.m.raise_fault(COMMS_LOST)
        self.assertEqual(self.m.state, FAULT)
        self.assertFalse(self.m.reset(confirmed=True)[0])
        self.m.condition_cleared(COMMS_LOST)
        self.assertEqual(self.m.state, FAULT)  # condition gone does NOT auto-clear the fault
        self.assertTrue(self.m.reset(confirmed=True)[0])
        self.assertEqual(self.m.state, READY)


if __name__ == "__main__":
    unittest.main()
