// SeaGuardian ESP32 firmware: sensors + SAFETY + motor output.
// Protocol and safety rules: docs/architecture.md (must match dashboard/seaguardian/sim_esp32.py).
//
// NOT YET COMPILED OR RUN ON HARDWARE. Person 2: check the pin table, compile, then
// run the bench tests T-R8 and T-R9 before trusting any of the safety paths.
//
// Board: any ESP32 dev board, Arduino framework (ESP32 core 2.x or 3.x). No extra libraries.
// Sensors (optional - the firmware runs without them and reports null values):
//   IMU:      MPU-6050 (or compatible) on I2C, address 0x68
//   Pressure: BMP280 on I2C, address 0x76 or 0x77 (atmospheric pressure in hPa)
//   Leak:     digital leak-sensor output, or a button/wire as a labelled test input
//
// Safety rules:
//   - Motors are 0 at boot; motor commands are ignored until the first heartbeat.
//   - After the first heartbeat: no heartbeat for 1000 ms -> COMMLOST.
//   - "estop" message or the physical E-STOP button -> ESTOP.  Leak input -> LEAK.
//   - In every state except OK the motor outputs are 0 and commands are ignored.
//   - Only a "reset" message returns to OK, and only when the cause is gone.

#include <Arduino.h>
#include <Wire.h>
#include <math.h>

// ---------------- pin table (Person 2: change to match the wiring) ----------------
const int PIN_SDA = 21;
const int PIN_SCL = 22;
const int PIN_MOTOR_L = 25;      // PWM to motor driver (or LED + resistor on the bench)
const int PIN_MOTOR_R = 26;
const int PIN_LEAK = 27;         // HIGH = wet when LEAK_ACTIVE_HIGH is true
const int PIN_ESTOP_BTN = 33;    // button to GND, internal pull-up; pressed = LOW
const int PIN_STATUS_LED = 2;    // on = OK, blinking = safety stop
const bool LEAK_ACTIVE_HIGH = true;

// ---------------- timing ----------------
const uint32_t HEARTBEAT_TIMEOUT_MS = 1000;
const uint32_t TELEMETRY_PERIOD_MS = 100;   // 10 Hz
const uint32_t PWM_FREQ = 20000;
const uint8_t PWM_BITS = 10;
const int PWM_MAX = (1 << PWM_BITS) - 1;

bool leakWet();  // defined below

enum State { ST_OK, ST_ESTOP, ST_COMMLOST, ST_LEAK };
const char *stateName(State s) {
  switch (s) {
    case ST_OK: return "OK";
    case ST_ESTOP: return "ESTOP";
    case ST_COMMLOST: return "COMMLOST";
    default: return "LEAK";
  }
}

State state = ST_OK;
float motorL = 0, motorR = 0;
bool hbSeen = false;
uint32_t lastHbMs = 0;
uint32_t lastTelMs = 0;
uint32_t seq = 0;
char lineBuf[160];
size_t lineLen = 0;

bool imuOk = false, baroOk = false;
uint8_t baroAddr = 0x76;
float roll = 0, pitch = 0, pressureHpa = 0;

// ---------------- motor output ----------------
void pwmAttach(int pin, int channel) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  (void)channel;
  ledcAttach(pin, PWM_FREQ, PWM_BITS);
#else
  ledcSetup(channel, PWM_FREQ, PWM_BITS);
  ledcAttachPin(pin, channel);
#endif
}

void pwmWrite(int pin, int channel, int duty) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  (void)channel;
  ledcWrite(pin, duty);
#else
  (void)pin;
  ledcWrite(channel, duty);
#endif
}

// Bench version: forward only (negative demand -> 0). Add a direction pin per motor
// if the motor driver needs reverse.
void applyMotors() {
  if (state != ST_OK) { motorL = 0; motorR = 0; }
  pwmWrite(PIN_MOTOR_L, 0, (int)(constrain(motorL, 0.0f, 1.0f) * PWM_MAX));
  pwmWrite(PIN_MOTOR_R, 1, (int)(constrain(motorR, 0.0f, 1.0f) * PWM_MAX));
}

void sendEvent(State s) {
  Serial.printf("{\"t\":\"evt\",\"ms\":%lu,\"evt\":\"%s\"}\n", (unsigned long)millis(), stateName(s));
}

void enterState(State s) {
  if (s == state) return;
  state = s;
  applyMotors();          // motors to 0 immediately on any stop
  sendEvent(s);
}

// ---------------- sensors (raw I2C, no libraries) ----------------
bool i2cWrite8(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

bool i2cRead(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t n) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)addr, (int)n) != n) return false;
  for (uint8_t i = 0; i < n; i++) buf[i] = Wire.read();
  return true;
}

// MPU-6050: wake up, then read the accelerometer to get roll and pitch.
bool imuBegin() { return i2cWrite8(0x68, 0x6B, 0x00); }

bool imuRead() {
  uint8_t b[6];
  if (!i2cRead(0x68, 0x3B, b, 6)) return false;
  float ax = (int16_t)(b[0] << 8 | b[1]);
  float ay = (int16_t)(b[2] << 8 | b[3]);
  float az = (int16_t)(b[4] << 8 | b[5]);
  roll = atan2f(ay, az) * 180.0f / PI;
  pitch = atan2f(-ax, sqrtf(ay * ay + az * az)) * 180.0f / PI;
  return true;
}

// BMP280: Bosch datasheet compensation, pressure in Pa -> hPa.
uint16_t digT1, digP1;
int16_t digT2, digT3, digP2, digP3, digP4, digP5, digP6, digP7, digP8, digP9;

bool baroBegin() {
  uint8_t id = 0;
  for (uint8_t addr : {0x76, 0x77}) {
    if (i2cRead(addr, 0xD0, &id, 1) && id == 0x58) { baroAddr = addr; break; }
  }
  if (id != 0x58) return false;
  uint8_t c[24];
  if (!i2cRead(baroAddr, 0x88, c, 24)) return false;
  auto u16 = [&](int i) { return (uint16_t)(c[i] | c[i + 1] << 8); };
  auto s16 = [&](int i) { return (int16_t)(c[i] | c[i + 1] << 8); };
  digT1 = u16(0); digT2 = s16(2); digT3 = s16(4);
  digP1 = u16(6); digP2 = s16(8); digP3 = s16(10); digP4 = s16(12); digP5 = s16(14);
  digP6 = s16(16); digP7 = s16(18); digP8 = s16(20); digP9 = s16(22);
  i2cWrite8(baroAddr, 0xF5, 0xA0);  // standby 1000 ms, filter off
  return i2cWrite8(baroAddr, 0xF4, 0x27);  // temp x1, pressure x1, normal mode
}

bool baroRead() {
  uint8_t d[6];
  if (!i2cRead(baroAddr, 0xF7, d, 6)) return false;
  int32_t adcP = ((int32_t)d[0] << 12) | ((int32_t)d[1] << 4) | (d[2] >> 4);
  int32_t adcT = ((int32_t)d[3] << 12) | ((int32_t)d[4] << 4) | (d[5] >> 4);
  int32_t v1 = ((((adcT >> 3) - ((int32_t)digT1 << 1))) * ((int32_t)digT2)) >> 11;
  int32_t v2 = (((((adcT >> 4) - ((int32_t)digT1)) * ((adcT >> 4) - ((int32_t)digT1))) >> 12) * ((int32_t)digT3)) >> 14;
  int32_t tFine = v1 + v2;
  int64_t p1 = ((int64_t)tFine) - 128000;
  int64_t p2 = p1 * p1 * (int64_t)digP6;
  p2 = p2 + ((p1 * (int64_t)digP5) << 17);
  p2 = p2 + (((int64_t)digP4) << 35);
  p1 = ((p1 * p1 * (int64_t)digP3) >> 8) + ((p1 * (int64_t)digP2) << 12);
  p1 = (((((int64_t)1) << 47) + p1)) * ((int64_t)digP1) >> 33;
  if (p1 == 0) return false;
  int64_t p = 1048576 - adcP;
  p = (((p << 31) - p2) * 3125) / p1;
  p1 = (((int64_t)digP9) * (p >> 13) * (p >> 13)) >> 25;
  p2 = (((int64_t)digP8) * p) >> 19;
  p = ((p + p1 + p2) >> 8) + (((int64_t)digP7) << 4);
  pressureHpa = (float)p / 256.0f / 100.0f;
  return true;
}

// ---------------- messages from the Pi ----------------
float numberAfter(const char *line, const char *key, float fallback) {
  const char *k = strstr(line, key);
  return k ? strtof(k + strlen(key), nullptr) : fallback;
}

void handleLine(const char *line) {
  if (strstr(line, "\"t\":\"hb\"")) {
    hbSeen = true;
    lastHbMs = millis();
  } else if (strstr(line, "\"t\":\"cmd\"")) {
    if (state == ST_OK && hbSeen) {
      motorL = constrain(numberAfter(line, "\"l\":", 0), -1.0f, 1.0f);
      motorR = constrain(numberAfter(line, "\"r\":", 0), -1.0f, 1.0f);
      applyMotors();
    }
  } else if (strstr(line, "\"t\":\"estop\"")) {
    enterState(ST_ESTOP);
  } else if (strstr(line, "\"t\":\"reset\"")) {
    bool hbFresh = hbSeen && (millis() - lastHbMs <= HEARTBEAT_TIMEOUT_MS);
    bool buttonReleased = digitalRead(PIN_ESTOP_BTN) == HIGH;
    bool causeGone = (state == ST_ESTOP && buttonReleased) ||
                     (state == ST_COMMLOST && hbFresh) ||
                     (state == ST_LEAK && !leakWet());
    if (state != ST_OK && causeGone) enterState(ST_OK);
  }
}

bool leakWet() {
  bool level = digitalRead(PIN_LEAK) == HIGH;
  return LEAK_ACTIVE_HIGH ? level : !level;
}

void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      lineBuf[lineLen] = '\0';
      handleLine(lineBuf);
      lineLen = 0;
    } else if (c != '\r') {
      if (lineLen < sizeof(lineBuf) - 1) lineBuf[lineLen++] = c;
      else lineLen = 0;  // line too long: drop it
    }
  }
}

// ---------------- telemetry ----------------
void printValue(bool ok, float v) {
  if (ok) Serial.print(v, 1); else Serial.print("null");
}

void sendTelemetry() {
  seq++;
  Serial.printf("{\"t\":\"tel\",\"seq\":%lu,\"ms\":%lu,\"roll\":", (unsigned long)seq, (unsigned long)millis());
  printValue(imuOk, roll);
  Serial.print(",\"pitch\":");
  printValue(imuOk, pitch);
  Serial.print(",\"p_hpa\":");
  printValue(baroOk, pressureHpa);
  Serial.printf(",\"leak\":%d,\"l\":%.2f,\"r\":%.2f,\"state\":\"%s\"}\n",
                leakWet() ? 1 : 0, motorL, motorR, stateName(state));
}

// ---------------- setup / loop ----------------
void setup() {
  pwmAttach(PIN_MOTOR_L, 0);
  pwmAttach(PIN_MOTOR_R, 1);
  applyMotors();  // motors 0 before anything else
  pinMode(PIN_LEAK, LEAK_ACTIVE_HIGH ? INPUT_PULLDOWN : INPUT_PULLUP);
  pinMode(PIN_ESTOP_BTN, INPUT_PULLUP);
  pinMode(PIN_STATUS_LED, OUTPUT);
  Serial.begin(115200);
  Wire.begin(PIN_SDA, PIN_SCL);
  imuOk = imuBegin();
  baroOk = baroBegin();
}

void loop() {
  uint32_t now = millis();
  readSerial();

  // Safety checks every loop, independent of the Pi.
  if (state == ST_OK) {
    if (digitalRead(PIN_ESTOP_BTN) == LOW) enterState(ST_ESTOP);
    else if (leakWet()) enterState(ST_LEAK);
    else if (hbSeen && now - lastHbMs > HEARTBEAT_TIMEOUT_MS) enterState(ST_COMMLOST);
  }
  applyMotors();
  digitalWrite(PIN_STATUS_LED, state == ST_OK ? HIGH : ((now / 250) % 2 ? HIGH : LOW));

  if (now - lastTelMs >= TELEMETRY_PERIOD_MS) {
    lastTelMs = now;
    if (imuOk) imuOk = imuRead();
    if (baroOk) baroOk = baroRead();
    sendTelemetry();
  }
}
