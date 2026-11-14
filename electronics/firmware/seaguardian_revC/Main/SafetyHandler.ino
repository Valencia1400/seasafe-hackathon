// SafetyHandler.ino - arming, latched emergency stop, command watchdog, link-loss handling, battery, status LED.
// This task has the highest application priority and never waits on the network or on a sensor.
#define SAFETY_PERIOD_MS 20

static portMUX_TYPE s_safetyLock = portMUX_INITIALIZER_UNLOCKED;
static volatile bool s_armed = false;
static volatile bool s_estop = false;
static volatile bool s_failsafe = false;
static volatile float s_speed = SPEED_DEFAULT;
static volatile uint32_t s_lastCmdMs = 0;
static float s_vbat = 0;
static BattState s_batt = BATT_DISABLED;
static uint32_t s_idleSince = 0;

const char *safetyBattName(BattState s) {
  static const char *names[] = { "disabled", "absent", "ok", "low", "critical" };
  return names[s];
}

bool safetyIsArmed() { return s_armed; }
bool safetyEstopActive() { return s_estop; }
float safetySpeed() { return s_speed; }

void safetySetSpeed(float speed) {
  if (speed < 0.1f) speed = 0.1f;
  if (speed > 1.0f) speed = 1.0f;
  s_speed = speed;
}

// Heartbeat: every VALID command calls this. It also ends a watchdog failsafe; by then the motor
// targets are zero, so nothing moves until a new movement command arrives.
void safetyCommandSeen() {
  s_lastCmdMs = millis();
  if (s_failsafe) {
    s_failsafe = false;
    LOGI("SAFETY", "commands are arriving again, watchdog failsafe cleared (motors remain stopped)");
  }
}

bool safetyMotionAllowed(const char **whyNot) {
  if (s_estop) { if (whyNot) *whyNot = "emergency stop active"; return false; }
  if (!s_armed) { if (whyNot) *whyNot = "not armed"; return false; }
  return true;
}

bool safetyArm(bool arm, const char **whyNot) {
  if (arm && s_estop) { if (whyNot) *whyNot = "emergency stop active"; return false; }
  if (arm && s_batt == BATT_CRITICAL) { if (whyNot) *whyNot = "battery critical"; return false; }
  motorsStopNow();
  s_armed = arm;
  s_failsafe = false;
  s_lastCmdMs = millis();
  LOGI("SAFETY", "%s", arm ? "ARMED: movement commands are now accepted" : "disarmed");
  return true;
}

// Latched emergency stop. Has priority over everything: callable from any task, and re-enforced every safety cycle.
void safetyEstop(const char *source) {
  bool wasActive = s_estop;
  s_estop = true;
  s_armed = false;
  motorsSafeState();
  if (!wasActive) LOGC("SAFETY", "EMERGENCY STOP activated (%s). Motors disabled until 'estop_reset'", source);
}

void safetyEstopReset() {
  if (s_estop) LOGC("SAFETY", "emergency stop RELEASED. Still disarmed: send 'arm' to move again");
  s_estop = false;
  s_failsafe = false;
  motorsStopNow();
}

// Called when the WebSocket or Wi-Fi link drops.
void safetyLinkLost() {
  if (s_armed) LOGC("SAFETY", "link to the website LOST while armed: motors stopped and disarmed");
  motorsStopNow();
  s_armed = false;
}

void safetyGetStatus(SafetyStatus *out) {
  portENTER_CRITICAL(&s_safetyLock);
  out->armed = s_armed;
  out->estop = s_estop;
  out->failsafe = s_failsafe;
  out->speed = s_speed;
  out->vbat = s_vbat;
  out->batt = s_batt;
  portEXIT_CRITICAL(&s_safetyLock);
}

#if ENABLE_BATTERY_MONITOR
static uint32_t s_battCritSince = 0;

static void safetyBattery(uint32_t nowMs) {
  float v = analogReadMilliVolts(PIN_VBAT_SENSE) / 1000.0f * BATT_DIVIDER_RATIO;
  float vf = (s_vbat <= 0) ? v : s_vbat + 0.1f * (v - s_vbat);
  const float lowV = BATT_LOW_V_PER_CELL * BATT_CELLS, critV = BATT_CRIT_V_PER_CELL * BATT_CELLS;
  BattState st = s_batt;
  if (vf < 2.5f) { st = BATT_ABSENT; s_battCritSince = 0; }
  else if (vf <= critV) {
    if (!s_battCritSince) s_battCritSince = nowMs;
    if (nowMs - s_battCritSince > 3000) st = BATT_CRITICAL; else if (st != BATT_CRITICAL) st = BATT_LOW;
  } else {
    s_battCritSince = 0;
    if (st == BATT_CRITICAL) { if (vf > critV + 0.2f) st = BATT_LOW; }
    else if (vf <= lowV) st = BATT_LOW;
    else if (st != BATT_LOW || vf > lowV + 0.2f) st = BATT_OK;
  }
  if (st == BATT_CRITICAL && s_batt != BATT_CRITICAL) {
    LOGC("SAFETY", "battery CRITICAL (%.2f V): motors cut", vf);
    motorsStopNow();
    s_armed = false;
  }
  portENTER_CRITICAL(&s_safetyLock);
  s_vbat = vf;
  s_batt = st;
  portEXIT_CRITICAL(&s_safetyLock);
}
#endif

// One safety cycle. Kept separate from the task so that it can be unit-tested with a simulated clock.
void safetyUpdate(uint32_t nowMs) {
  // 1. Emergency stop: keep forcing the safe state, whatever any other task may have requested.
  if (s_estop) {
    s_armed = false;
    motorsSafeState();      // writes the pins again every cycle, not only the targets
  }
  // 2. Communication watchdog.
  if (s_armed && !s_failsafe && (uint32_t)(nowMs - s_lastCmdMs) > CMD_TIMEOUT_MS) {
    motorsStopNow();
    s_failsafe = true;
    LOGC("SAFETY", "WATCHDOG: no valid command for %d ms, motors stopped", CMD_TIMEOUT_MS);
  }
  // 3. Motor ramp (the only place where motor outputs are advanced).
  if (!s_estop) motorsUpdate(SAFETY_PERIOD_MS / 1000.0f);
#if ENABLE_BATTERY_MONITOR
  safetyBattery(nowMs);
#endif
  // 4. Status LED: solid = armed, fast blink = emergency stop, slow blink = server connected, off = no server.
  bool led = s_armed ? true : s_estop ? ((nowMs / 100) % 2) : commIsConnected() ? ((nowMs / 500) % 2) : false;
  digitalWrite(PIN_STATUS_LED, led ? HIGH : LOW);
  // 5. Optional idle deep sleep.
  if (s_armed || commIsConnected()) s_idleSince = nowMs;
  if (IDLE_SLEEP_MINUTES > 0 && (uint32_t)(nowMs - s_idleSince) > (uint32_t)IDLE_SLEEP_MINUTES * 60000UL) {
    s_idleSince = nowMs;
    powerRequestSleep("idle timeout");
  }
}

void safetyInit() {
  pinMode(PIN_STATUS_LED, OUTPUT);
  s_lastCmdMs = millis();
  s_idleSince = millis();
#if ENABLE_BATTERY_MONITOR
  s_batt = BATT_ABSENT;
#endif
  LOGI("SAFETY", "ready: watchdog %d ms, emergency stop = %s, battery monitor %s", CMD_TIMEOUT_MS,
       ESTOP_BRAKE ? "brake" : "coast", ENABLE_BATTERY_MONITOR ? "on" : "off");
}

void safetyTask(void *arg) {
  // Hardware-timer supervision of this task: if it ever stops running for several seconds, the ESP32
  // resets, and a reset puts the motor driver back into its safe state (see motorsInit).
  esp_task_wdt_add(nullptr);
  TickType_t last = xTaskGetTickCount();
  for (;;) {
    esp_task_wdt_reset();
    safetyUpdate(millis());
    vTaskDelayUntil(&last, pdMS_TO_TICKS(SAFETY_PERIOD_MS));
  }
}
