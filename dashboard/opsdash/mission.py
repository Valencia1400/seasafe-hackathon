"""Mission state machine for the SeaGuardian operator dashboard (SIMULATION).

Pure logic: no web server, no threads, no hardware. Time is passed in, so every
rule can be unit-tested.

States
    READY    nothing running, motor command STOPPED, operator may start
    RUNNING  simulated inspection mission active
    STOPPED  operator stopped the mission; must press Reset to get back to READY
    FAULT    E-STOP or a detected fault; motor command STOPPED

Valid transitions (everything else is rejected and logged):
    READY    --start-->  RUNNING
    RUNNING  --stop-->   STOPPED
    STOPPED  --reset-->  READY
    READY / RUNNING / STOPPED --estop--> FAULT
    FAULT    --reset (confirmed, causes cleared)--> READY

Safety rules enforced here:
- A fault is never cleared by anything except a deliberate, confirmed reset.
- Reset only ever goes to READY. It never starts the motor: the operator must
  press Start again.
- Reset is refused while a condition is still active (e.g. communication lost).

This is a software simulation. It does not prove physical safety: the real
motor safety must be enforced independently by the control ESP32.
"""
import time

READY, RUNNING, STOPPED, FAULT = "READY", "RUNNING", "STOPPED", "FAULT"

# Fault causes
ESTOP = "E-STOP"
COMMS_LOST = "COMMS LOST"
LEAK = "LEAK"


class MissionStateMachine:
    def __init__(self, clock=time.time):
        self._clock = clock
        self.state = READY
        self.latched_faults = set()   # causes that need a reset to clear
        self.active_conditions = set()  # causes whose underlying condition is still present
        self.events = []

    # -- event log ----------------------------------------------------------
    def log(self, text, level="info"):
        self.events.append({"time": self._clock(), "level": level, "text": text})
        del self.events[:-200]

    def _reject(self, text):
        self.log(f"Rejected: {text}", "warn")
        return False, text

    # -- derived outputs ----------------------------------------------------
    @property
    def motor_command(self):
        """Simulated DC motor command. Anything but RUNNING means STOPPED."""
        return "RUN (simulated)" if self.state == RUNNING else "STOPPED"

    @property
    def fault_causes(self):
        return sorted(self.latched_faults)

    # -- operator commands --------------------------------------------------
    def start(self):
        if self.state != READY:
            return self._reject(f"Start only allowed from READY (state is {self.state}).")
        self.state = RUNNING
        self.log("Mission started (simulated inspection)")
        return True, "Mission started."

    def stop(self):
        if self.state != RUNNING:
            return self._reject(f"Stop only allowed while RUNNING (state is {self.state}).")
        self.state = STOPPED
        self.log("Mission stopped by operator; motor command STOPPED")
        return True, "Mission stopped."

    def estop(self):
        # E-STOP is always accepted, in every state.
        self.latched_faults.add(ESTOP)
        if self.state != FAULT:
            self.state = FAULT
        self.log("EMERGENCY STOP activated; motor command STOPPED", "fault")
        return True, "Emergency stop active."

    def latch_fault(self, cause):
        """A fault reported by the controller. Stays until a deliberate reset."""
        self.latched_faults.add(cause)
        if self.state != FAULT:
            self.state = FAULT
            self.log(f"FAULT: {cause}; motor command STOPPED", "fault")

    def raise_fault(self, cause):
        """A fault whose cause is still present: reset is refused until it is cleared."""
        self.active_conditions.add(cause)
        self.latch_fault(cause)

    def set_condition(self, cause):
        """Mark a condition as present (blocks a fault reset) without changing the state."""
        self.active_conditions.add(cause)

    def condition_cleared(self, cause):
        """The underlying condition went away. This does NOT clear the fault."""
        self.active_conditions.discard(cause)

    def reset(self, confirmed=False):
        if self.state not in (STOPPED, FAULT):
            return self._reject(f"Reset only allowed from STOPPED or FAULT (state is {self.state}).")
        if self.state == FAULT:
            if not confirmed:
                return self._reject("Fault reset needs deliberate confirmation.")
            still = sorted(self.active_conditions)
            if still:
                return self._reject(f"Cannot reset: condition still active ({', '.join(still)}).")
            self.latched_faults.clear()
        self.state = READY
        self.log("Reset: back to READY. Motor stays STOPPED until Start is pressed.")
        return True, "Reset to READY."

    # -- snapshot for the web page -------------------------------------------
    def snapshot(self):
        return {
            "state": self.state,
            "motor_command": self.motor_command,
            "fault_causes": self.fault_causes,
            "allowed": {
                "start": self.state == READY,
                "stop": self.state == RUNNING,
                "estop": True,
                "reset": self.state in (STOPPED, FAULT),
            },
            "events": self.events[-60:],
        }
