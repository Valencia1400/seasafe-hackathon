// MotorControl.ino - two DC motor channels on an L298N.
//   Speed:     PWM on ENA / ENB (remove the jumpers on the module).
//   Direction: IN1/IN2 (left channel), IN3/IN4 (right channel).
// Outputs are ramped towards the target, so a reversal always passes through zero.
#define MOTOR_CH_LEFT   0     // LEDC channels 0 and 1 share one timer (same frequency, which is what we want)
#define MOTOR_CH_RIGHT  1

static const uint8_t s_motorEnPin[2]  = { PIN_L298N_ENA, PIN_L298N_ENB };
static const uint8_t s_motorInA[2]    = { PIN_L298N_IN1, PIN_L298N_IN3 };
static const uint8_t s_motorInB[2]    = { PIN_L298N_IN2, PIN_L298N_IN4 };
static const bool    s_motorInvert[2] = { MOTOR_LEFT_INVERT, MOTOR_RIGHT_INVERT };
static portMUX_TYPE s_motorLock = portMUX_INITIALIZER_UNLOCKED;
static float s_motorTarget[2] = { 0, 0 };
static float s_motorActual[2] = { 0, 0 };
static int   s_motorLastDuty[2] = { -1, -1 };
static bool  s_motorRunning = false;
// Every write to the driver pins happens under this mutex. Without it, a stop from the comm task could be
// overwritten by a ramp step the safety task had already computed, leaving the motors running after a stop.
static SemaphoreHandle_t s_motorOutMutex = nullptr;
static void motorOutLock()   { if (s_motorOutMutex) xSemaphoreTakeRecursive(s_motorOutMutex, portMAX_DELAY); }
static void motorOutUnlock() { if (s_motorOutMutex) xSemaphoreGiveRecursive(s_motorOutMutex); }

static float motorClamp(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

// Writes one channel: v in -1..+1. v == 0 -> coast (bridge outputs off).
static void motorApply(int m, float v) {
  if (s_motorInvert[m]) v = -v;
  int duty = 0;
  if (v != 0.0f) duty = MOTOR_MIN_DUTY + (int)(fabsf(v) * (MOTOR_MAX_DUTY - MOTOR_MIN_DUTY) + 0.5f);
  if (duty == 0) {
    ledcWrite(s_motorEnPin[m], 0);
    digitalWrite(s_motorInA[m], LOW);
    digitalWrite(s_motorInB[m], LOW);
  } else {
    digitalWrite(s_motorInA[m], v > 0 ? HIGH : LOW);
    digitalWrite(s_motorInB[m], v > 0 ? LOW : HIGH);
    ledcWrite(s_motorEnPin[m], duty);
  }
  if (duty != s_motorLastDuty[m]) {
    s_motorLastDuty[m] = duty;
    LOGD("MOTOR", "%s: %s duty %d/%d", m == 0 ? "left" : "right", duty == 0 ? "off" : (v > 0 ? "forward" : "reverse"),
         duty, MOTOR_MAX_DUTY);
  }
}

bool motorsInit() {
  if (!s_motorOutMutex) s_motorOutMutex = xSemaphoreCreateRecursiveMutex();
  bool ok = true;
  for (int m = 0; m < 2; m++) {
    pinMode(s_motorInA[m], OUTPUT);
    pinMode(s_motorInB[m], OUTPUT);
    digitalWrite(s_motorInA[m], LOW);
    digitalWrite(s_motorInB[m], LOW);
    ok = ledcAttachChannel(s_motorEnPin[m], MOTOR_PWM_FREQ_HZ, MOTOR_PWM_RES_BITS, m == 0 ? MOTOR_CH_LEFT : MOTOR_CH_RIGHT) && ok;
    ledcWrite(s_motorEnPin[m], 0);
  }
  if (ok) {
    LOGI("MOTOR", "L298N ready: ENA=%d IN1=%d IN2=%d | ENB=%d IN3=%d IN4=%d | %d Hz, %d-bit, duty limit %d", PIN_L298N_ENA,
         PIN_L298N_IN1, PIN_L298N_IN2, PIN_L298N_ENB, PIN_L298N_IN3, PIN_L298N_IN4, MOTOR_PWM_FREQ_HZ, MOTOR_PWM_RES_BITS, MOTOR_MAX_DUTY);
  } else {
    LOGE("MOTOR", "PWM setup FAILED (frequency/resolution not achievable or pin in use)");
  }
  return ok;
}

void motorsSetTarget(float left, float right) {
  portENTER_CRITICAL(&s_motorLock);
  s_motorTarget[0] = motorClamp(left, -1.0f, 1.0f);
  s_motorTarget[1] = motorClamp(right, -1.0f, 1.0f);
  portEXIT_CRITICAL(&s_motorLock);
}

// Immediate stop: bypasses the ramp. Outputs coast.
void motorsStopNow() {
  motorOutLock();
  portENTER_CRITICAL(&s_motorLock);
  s_motorTarget[0] = s_motorTarget[1] = 0;
  s_motorActual[0] = s_motorActual[1] = 0;
  portEXIT_CRITICAL(&s_motorLock);
  motorApply(0, 0);
  motorApply(1, 0);
  if (s_motorRunning) {
    s_motorRunning = false;
    LOGI("MOTOR", "motors stopped");
  }
  motorOutUnlock();
}

// Emergency-stop state of the L298N (see ESTOP_BRAKE in Config.h).
void motorsSafeState() {
  motorOutLock();
  motorsStopNow();
#if ESTOP_BRAKE
  for (int m = 0; m < 2; m++) {          // both inputs HIGH + enable HIGH = motor terminals shorted (brake)
    digitalWrite(s_motorInA[m], HIGH);
    digitalWrite(s_motorInB[m], HIGH);
    ledcWrite(s_motorEnPin[m], MOTOR_MAX_DUTY);
    s_motorLastDuty[m] = -1;
  }
#endif
  motorOutUnlock();
}

// Called at a fixed rate by the safety task: moves the outputs towards the targets.
void motorsUpdate(float dtSeconds) {
  float out[2];
  float step = (MOTOR_SLEW_PER_S > 0) ? MOTOR_SLEW_PER_S * dtSeconds : 2.0f;
  motorOutLock();
  portENTER_CRITICAL(&s_motorLock);
  for (int m = 0; m < 2; m++) {
    s_motorActual[m] += motorClamp(s_motorTarget[m] - s_motorActual[m], -step, step);
    out[m] = s_motorActual[m];
  }
  portEXIT_CRITICAL(&s_motorLock);
  bool running = (out[0] != 0.0f || out[1] != 0.0f);
  if (running || s_motorRunning) {       // nothing to write while already idle (keeps a brake state intact)
    motorApply(0, out[0]);
    motorApply(1, out[1]);
  }
  if (running && !s_motorRunning) LOGI("MOTOR", "motors started");
  if (!running && s_motorRunning) LOGI("MOTOR", "motors stopped");
  s_motorRunning = running;
  motorOutUnlock();
}

// True while a non-zero output is being requested.
bool motorsTargetActive() {
  portENTER_CRITICAL(&s_motorLock);
  bool active = (s_motorTarget[0] != 0.0f || s_motorTarget[1] != 0.0f);
  portEXIT_CRITICAL(&s_motorLock);
  return active;
}

void motorsGet(float *left, float *right) {
  portENTER_CRITICAL(&s_motorLock);
  *left = s_motorActual[0];
  *right = s_motorActual[1];
  portEXIT_CRITICAL(&s_motorLock);
}
