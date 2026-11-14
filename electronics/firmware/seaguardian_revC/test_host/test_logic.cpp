// Host unit tests. The REAL firmware files MotorControl.ino, ServoControl.ino, SafetyHandler.ino and
// CommandHandler.ino are compiled unchanged; only the hardware and the other modules are replaced by stubs.
#include <ArduinoJson.h>
#include "Types.h"

uint32_t g_nowMs = 1000;
std::map<int, int> g_pin, g_duty;
static int g_critical = 0, g_sleepReq = 0, g_imuZero = 0;
static bool g_serverUp = true;
static LogLevel g_level = LOG_INFO;
void logMsg(LogLevel level, const char *, const char *, ...) { if (level == LOG_CRITICAL) g_critical++; }
void logSetLevel(LogLevel l) { g_level = l; }
LogLevel logGetLevel() { return g_level; }
bool commIsConnected() { return g_serverUp; }
void imuZero() { g_imuZero++; }
void powerRequestSleep(const char *) { g_sleepReq++; }

// --- stand-ins needed by Telemetry.ino ---
static ImuSample g_imu = {};
static GpsData g_gpsData = {};
void imuGet(ImuSample *o) { *o = g_imu; }
void gpsGet(GpsData *o) { *o = g_gpsData; }
uint32_t wifiReconnectCount() { return 2; }
uint32_t commReconnectCount() { return 3; }
const char *powerResetReason() { return "power_on"; }
struct IpStub { struct S { const char *c_str() const { return "172.20.10.5"; } }; S toString() const { return S(); } };
struct WiFiStub { int RSSI() { return -61; } IpStub localIP() { return IpStub(); } } WiFi;
struct EspStub { uint32_t getFreeHeap() { return 201234; } } ESP;

#include "../Main/MotorControl.ino"
#include "../Main/ServoControl.ino"
#include "../Main/SafetyHandler.ino"
#include "../Main/CommandHandler.ino"
#include "../Main/Telemetry.ino"

static int pass = 0, fail = 0;
static char reply[200];
#define CHECK(cond, what) do { if (cond) pass++; else { fail++; printf("  FAIL: %s   (reply: %s)\n", what, reply); } } while (0)

static bool run(const char *json) {
  bool ok = commandHandle(json, strlen(json), reply, sizeof(reply));
  if (reply[0]) {                                   // every reply must itself be valid JSON
    JsonDocument d;
    if (deserializeJson(d, reply) || !d.is<JsonObject>()) { fail++; printf("  FAIL: reply is not JSON: %s\n", reply); }
  }
  return ok;
}
// Advance the clock, running the safety task's cycle every 20 ms. Optionally keep the watchdog fed.
static bool g_bothHigh = false;
static void advance(uint32_t ms, bool feed = false) {
  for (uint32_t t = 0; t < ms; t += 20) {
    g_nowMs += 20;
    if (feed) run("{\"cmd\":\"ping\"}");
    safetyUpdate(g_nowMs);
    if ((g_pin[PIN_L298N_IN1] && g_pin[PIN_L298N_IN2]) || (g_pin[PIN_L298N_IN3] && g_pin[PIN_L298N_IN4])) g_bothHigh = true;
  }
}
static bool leftIs(int in1, int in2, int duty) { return g_pin[PIN_L298N_IN1] == in1 && g_pin[PIN_L298N_IN2] == in2 && g_duty[PIN_L298N_ENA] == duty; }
static bool rightIs(int in3, int in4, int duty) { return g_pin[PIN_L298N_IN3] == in3 && g_pin[PIN_L298N_IN4] == in4 && g_duty[PIN_L298N_ENB] == duty; }
static bool allOff() { return leftIs(0, 0, 0) && rightIs(0, 0, 0); }
static bool has(const char *s) { return strstr(reply, s) != nullptr; }

int main() {
  motorsInit(); servoInit(); safetyInit();
  CHECK(allOff(), "after init: both bridge channels off");

  puts("-- malformed input");
  CHECK(!run("hello"), "plain text rejected");
  CHECK(!run(""), "empty message rejected");
  CHECK(!run("[1,2]"), "JSON array rejected");
  CHECK(!run("{\"cmd\":\"drive\",\"throttle\":0.5"), "truncated JSON rejected");
  CHECK(!run("{\"throttle\":1}"), "missing cmd rejected");
  CHECK(!run("{\"cmd\":42}"), "numeric cmd rejected");
  CHECK(!run("{\"cmd\":\"self_destruct\"}"), "unknown command rejected");
  CHECK(!run("{\"cmd\":\"a\\\"b\"}") && has("\"cmd\":\"?\""), "cmd containing a quote is not echoed");
  { char big[400]; memset(big, ' ', sizeof(big)); memcpy(big, "{\"cmd\":\"ping\"", 13); big[398] = '}'; big[399] = 0;
    CHECK(!run(big) && has("too long"), "over-long message rejected"); }

  puts("-- arming gate");
  CHECK(!run("{\"cmd\":\"move\",\"dir\":\"forward\"}") && has("not armed"), "move refused while disarmed");
  CHECK(!run("{\"cmd\":\"drive\",\"throttle\":1,\"steer\":0}") && has("not armed"), "drive refused while disarmed");
  CHECK(!run("{\"cmd\":\"motors\",\"left\":1,\"right\":1}"), "motors refused while disarmed");
  advance(200); CHECK(allOff(), "nothing moves while disarmed");
  CHECK(!run("{\"cmd\":\"arm\",\"value\":\"yes\"}"), "arm needs a boolean");
  CHECK(run("{\"cmd\":\"arm\",\"value\":true}") && safetyIsArmed(), "arm accepted");

  puts("-- L298N direction and PWM");
  run("{\"cmd\":\"move\",\"dir\":\"forward\"}");
  advance(20, true);  CHECK(g_duty[PIN_L298N_ENA] > 0 && g_duty[PIN_L298N_ENA] < 30, "ramp: first step is small (no jump to full power)");
  advance(600, true); CHECK(leftIs(1, 0, 128) && rightIs(1, 0, 128), "forward at default speed 50 %: IN1=H IN2=L, IN3=H IN4=L, duty 128");
  CHECK(run("{\"cmd\":\"speed_up\"}") && fabsf(safetySpeed() - 0.6f) < 1e-4f, "speed_up raises speed to 60 %");
  advance(300, true); CHECK(leftIs(1, 0, 153) && rightIs(1, 0, 153), "new speed applied to the running move: duty 153");
  run("{\"cmd\":\"move\",\"dir\":\"backward\"}");
  advance(1500, true); CHECK(leftIs(0, 1, 153) && rightIs(0, 1, 153), "backward: IN1=L IN2=H, IN3=L IN4=H");
  CHECK(!g_bothHigh, "during the reversal the two inputs of a channel were never HIGH together");
  run("{\"cmd\":\"move\",\"dir\":\"left\"}");
  advance(1500, true); CHECK(leftIs(0, 1, 92) && rightIs(1, 0, 92), "turn left: left motor reverse, right motor forward, duty 92 (60 % x 0.6)");
  run("{\"cmd\":\"move\",\"dir\":\"right\"}");
  advance(1500, true); CHECK(leftIs(1, 0, 92) && rightIs(0, 1, 92), "turn right: left forward, right reverse");
  CHECK(!run("{\"cmd\":\"move\",\"dir\":\"up\"}"), "unknown direction rejected");
  CHECK(run("{\"cmd\":\"speed\",\"value\":1}") && run("{\"cmd\":\"speed_down\"}") && fabsf(safetySpeed() - 0.9f) < 1e-4f, "set speed, then speed_down");
  CHECK(!run("{\"cmd\":\"speed\",\"value\":0}") && !run("{\"cmd\":\"speed\",\"value\":1.5}"), "speed outside 0.1..1 rejected");
  for (int i = 0; i < 12; i++) run("{\"cmd\":\"speed_up\"}");
  CHECK(fabsf(safetySpeed() - 1.0f) < 1e-4f, "speed_up saturates at 100 %");
  run("{\"cmd\":\"motors\",\"left\":1,\"right\":-0.5}");
  advance(1500, true); CHECK(leftIs(1, 0, 255) && rightIs(0, 1, 128), "individual motor control: left 100 % forward, right 50 % reverse");
  CHECK(!run("{\"cmd\":\"motors\",\"left\":2,\"right\":0}") && leftIs(1, 0, 255), "out-of-range motor value rejected, outputs unchanged");
  CHECK(!run("{\"cmd\":\"drive\",\"throttle\":\"fast\",\"steer\":0}"), "string throttle rejected");
  CHECK(!run("{\"cmd\":\"drive\",\"throttle\":1e999,\"steer\":0}"), "infinite throttle rejected");
  run("{\"cmd\":\"speed\",\"value\":0.5}");
  run("{\"cmd\":\"drive\",\"throttle\":1,\"steer\":0}");
  advance(1500, true); CHECK(leftIs(1, 0, 128) && rightIs(1, 0, 128), "drive is scaled by the speed setting");
  CHECK(run("{\"cmd\":\"stop\"}") && allOff(), "stop: outputs off immediately, without ramp");

  puts("-- communication watchdog");
  run("{\"cmd\":\"move\",\"dir\":\"forward\"}");
  advance(600, true);
  advance(900);  CHECK(g_duty[PIN_L298N_ENA] > 0, "900 ms without commands: still running");
  advance(200);  { SafetyStatus st; safetyGetStatus(&st); CHECK(allOff() && st.failsafe, "1100 ms without commands: WATCHDOG stopped the motors"); }
  run("{\"cmd\":\"speed_up\"}"); advance(300, true);
  CHECK(allOff(), "a speed command after the watchdog does NOT restart the motors");
  { SafetyStatus st; safetyGetStatus(&st); CHECK(!st.failsafe, "valid commands clear the failsafe flag"); }
  run("{\"cmd\":\"move\",\"dir\":\"forward\"}"); advance(300, true); CHECK(g_duty[PIN_L298N_ENA] > 0, "a new move command resumes");
  for (int i = 0; i < 60; i++) { g_nowMs += 20; run("{\"cmd\":\"move\",\"dir\":\"sideways\"}"); safetyUpdate(g_nowMs); }
  CHECK(allOff(), "INVALID commands do not feed the watchdog");

  puts("-- emergency stop");
  run("{\"cmd\":\"move\",\"dir\":\"forward\"}"); advance(600, true);
  int crit0 = g_critical;
  CHECK(run("{\"cmd\":\"estop\"}") && allOff() && !safetyIsArmed() && safetyEstopActive(), "estop: motors off at once, disarmed, flag latched");
  CHECK(g_critical > crit0, "estop is logged as CRITICAL");
  CHECK(!run("{\"cmd\":\"move\",\"dir\":\"forward\"}") && has("emergency stop active"), "move rejected during estop");
  CHECK(!run("{\"cmd\":\"drive\",\"throttle\":1,\"steer\":0}") && !run("{\"cmd\":\"motors\",\"left\":1,\"right\":1}"), "drive and motors rejected during estop");
  CHECK(!run("{\"cmd\":\"arm\",\"value\":true}") && has("emergency stop active"), "arm rejected during estop");
  CHECK(!run("{\"cmd\":\"servo\",\"angle\":45}"), "servo rejected during estop");
  motorsSetTarget(1, 1);            // simulate another task trying to move
  advance(500, true); CHECK(allOff(), "safety task keeps the motors off even if a target is set behind its back");
  CHECK(run("{\"cmd\":\"estop\"}") && safetyEstopActive(), "repeated estop is accepted and stays latched");
  CHECK(run("{\"cmd\":\"estop_reset\"}") && !safetyEstopActive() && !safetyIsArmed(), "estop_reset releases the latch but does not arm");
  advance(300, true); CHECK(allOff(), "nothing moves after the reset until armed again");
  CHECK(run("{\"cmd\":\"arm\",\"value\":true}") && run("{\"cmd\":\"move\",\"dir\":\"forward\"}"), "arm + move accepted after reset");
  advance(600, true); CHECK(g_duty[PIN_L298N_ENA] > 0, "motors run again");
  safetyEstop("test"); CHECK(allOff(), "estop from firmware (not from a command) also stops at once");
  safetyEstopReset();

  puts("-- link loss");
  run("{\"cmd\":\"arm\",\"value\":true}"); run("{\"cmd\":\"move\",\"dir\":\"forward\"}"); advance(600, true);
  safetyLinkLost(); CHECK(allOff() && !safetyIsArmed(), "link lost: motors off and disarmed");

  puts("-- servo");
  CHECK(run("{\"cmd\":\"servo\",\"angle\":90}") && g_duty[PIN_SERVO] == 1188, "90 deg -> 1450 us pulse (duty 1188 of 16384)");
  CHECK(run("{\"cmd\":\"servo\",\"id\":1,\"angle\":0}") && g_duty[PIN_SERVO] == 410, "0 deg -> 500 us");
  CHECK(run("{\"cmd\":\"servo\",\"angle\":180}") && g_duty[PIN_SERVO] == 1966, "180 deg -> 2400 us");
  CHECK(!run("{\"cmd\":\"servo\",\"angle\":181}") && g_duty[PIN_SERVO] == 1966, "181 deg rejected, servo unchanged");
  CHECK(!run("{\"cmd\":\"servo\",\"angle\":-1}"), "-1 deg rejected");
  CHECK(!run("{\"cmd\":\"servo\",\"angle\":\"left\"}") && !run("{\"cmd\":\"servo\"}"), "non-numeric / missing angle rejected");
  CHECK(!run("{\"cmd\":\"servo\",\"id\":2,\"angle\":90}"), "servo id 2 rejected (only one servo)");
  CHECK(run("{\"cmd\":\"servo_neutral\"}") && g_duty[PIN_SERVO] == 1188 && servoGetAngle() == 90, "servo_neutral returns to 90 deg");

  puts("-- misc");
  run("{\"cmd\":\"arm\",\"value\":true}");
  CHECK(!run("{\"cmd\":\"sleep\"}") && g_sleepReq == 0, "sleep refused while armed");
  run("{\"cmd\":\"arm\",\"value\":false}");
  CHECK(run("{\"cmd\":\"sleep\"}") && g_sleepReq == 1, "sleep accepted when disarmed");
  CHECK(run("{\"cmd\":\"imu_zero\"}") && g_imuZero == 1, "imu_zero accepted");
  CHECK(run("{\"cmd\":\"log_level\",\"value\":\"debug\"}") && g_level == LOG_DEBUG, "log level changed at run time");
  CHECK(!run("{\"cmd\":\"log_level\",\"value\":\"loud\"}"), "unknown log level rejected");
  { int before = g_critical; run("{\"cmd\":\"ping\"}"); CHECK(reply[0] == 0 && g_critical == before, "ping is silent"); }

  puts("-- telemetry JSON");
  {
    static char buf[1100];
    JsonDocument d;
    size_t n = telemetryBuild(buf, sizeof(buf));               // no IMU, no GPS
    bool okJson = n > 0 && n == strlen(buf) && !deserializeJson(d, buf);
    CHECK(okJson, "telemetry without sensors is valid JSON");
    CHECK(d["type"] == "telemetry" && d["imu"]["ok"] == false && d["imu"]["roll"].isNull() && d["imu"]["ax"].isNull(), "missing IMU -> ok=false and null values, not zeros");
    CHECK(d["gps"]["fix"] == false && d["gps"]["lat"].isNull() && d["gps"]["alt_m"].isNull() && d["gps"]["utc"].isNull(), "no GPS fix -> fix=false and null position");
    CHECK(d["batt"]["state"] == "disabled" && d["batt"]["v"].isNull() && d["servos"].size() == 1, "battery monitor off -> null voltage; one servo");
    printf("     frame without sensors: %u bytes\n", (unsigned)n);
    g_imu.ok = true; g_imu.tMs = 123456; g_imu.ax = 0.012f; g_imu.ay = -0.004f; g_imu.az = 1.003f; g_imu.gx = -250.55f; g_imu.gy = 0.5f; g_imu.gz = 499.99f;
    g_imu.roll = -179.9f; g_imu.pitch = 89.9f; g_imu.yaw = -180.0f; g_imu.tempC = 24.1f; g_imu.errors = 4000000000u;
    g_gpsData.receiving = true; g_gpsData.fix = true; g_gpsData.lat = -33.868820; g_gpsData.lon = 151.209290; g_gpsData.altValid = true; g_gpsData.altM = 8848.9f;
    g_gpsData.speedValid = true; g_gpsData.speedKmh = 123.4f; g_gpsData.courseValid = true; g_gpsData.courseDeg = 359.9f; g_gpsData.hdopValid = true; g_gpsData.hdop = 99.9f;
    g_gpsData.satellites = 12; g_gpsData.fixAgeMs = 250; g_gpsData.timeValid = true; g_gpsData.year = 2026; g_gpsData.month = 11; g_gpsData.day = 14;
    g_gpsData.hour = 9; g_gpsData.minute = 5; g_gpsData.second = 7;
    g_nowMs = 4000000000u;
    n = telemetryBuild(buf, sizeof(buf));
    okJson = n > 0 && !deserializeJson(d, buf);
    CHECK(okJson, "telemetry with worst-case long values is valid JSON");
    CHECK(fabs(d["gps"]["lat"].as<double>() + 33.868820) < 1e-6 && fabs(d["gps"]["lon"].as<double>() - 151.209290) < 1e-6, "latitude/longitude keep 6 decimals (about 0.1 m)");
    CHECK(d["gps"]["utc"] == "2026-11-14T09:05:07Z" && d["gps"]["sats"] == 12, "GPS time formatted as ISO 8601 UTC");
    CHECK(fabsf(d["imu"]["roll"].as<float>() + 179.9f) < 0.01f && d["imu"]["yaw_relative"] == true, "IMU values present, yaw flagged as relative");
    CHECK(d["sys"]["estop"] == false && d["sys"]["fw"] == FW_VERSION && d["sys"]["rssi"] == -61, "system block present");
    printf("     worst-case frame: %u bytes (buffer %u)\n", (unsigned)n, (unsigned)sizeof(buf));
    CHECK(n < 900, "worst-case frame leaves margin in the 1100-byte buffer");
    char tiny[100];
    CHECK(telemetryBuild(tiny, sizeof(tiny)) == 0, "a buffer that is too small yields no frame instead of a truncated one");
  }

  printf("\n%d passed, %d failed\n", pass, fail);
  return fail ? 1 : 0;
}
