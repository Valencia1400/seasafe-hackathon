// Shared types and the public functions of every module.
// Arduino merges all .ino files into one program; this header makes the interfaces explicit.
#pragma once
#include <Arduino.h>
#include "Config.h"

// ---------------- Logging ----------------
enum LogLevel : uint8_t { LOG_DEBUG = 0, LOG_INFO, LOG_WARNING, LOG_ERROR, LOG_CRITICAL };
void logInit();
void logMsg(LogLevel level, const char *tag, const char *fmt, ...) __attribute__((format(printf, 3, 4)));
void logSetLevel(LogLevel level);
LogLevel logGetLevel();
uint32_t logDroppedCount();
#define LOGD(tag, ...) logMsg(LOG_DEBUG, tag, __VA_ARGS__)
#define LOGI(tag, ...) logMsg(LOG_INFO, tag, __VA_ARGS__)
#define LOGW(tag, ...) logMsg(LOG_WARNING, tag, __VA_ARGS__)
#define LOGE(tag, ...) logMsg(LOG_ERROR, tag, __VA_ARGS__)
#define LOGC(tag, ...) logMsg(LOG_CRITICAL, tag, __VA_ARGS__)

// ---------------- Data shared between tasks (always copied under a lock) ----------------
struct ImuSample {
  bool ok;                 // false: sensor missing or reads failing
  uint32_t tMs;            // millis() of the sample
  float ax, ay, az;        // g
  float gx, gy, gz;        // deg/s, bias removed
  float roll, pitch;       // deg, gravity referenced (no drift)
  float yaw;               // deg, RELATIVE: integrated gyro, drifts (no magnetometer)
  float tempC;
  uint32_t errors;         // failed I2C reads since boot
};

struct GpsData {
  bool receiving;          // NMEA characters are arriving
  bool fix;                // valid position, not older than GPS_FIX_MAX_AGE_MS
  double lat, lon;         // degrees
  bool altValid;  float altM;
  bool speedValid; float speedKmh;
  bool courseValid; float courseDeg;
  uint32_t satellites;
  bool hdopValid; float hdop;
  uint32_t fixAgeMs;
  bool timeValid;
  uint16_t year; uint8_t month, day, hour, minute, second;   // UTC
  uint32_t chars, sentences, checksumFails;
};

enum BattState : uint8_t { BATT_DISABLED = 0, BATT_ABSENT, BATT_OK, BATT_LOW, BATT_CRITICAL };

struct SafetyStatus {
  bool armed;
  bool estop;              // latched emergency stop
  bool failsafe;           // watchdog stopped the motors
  float speed;             // 0.1 .. 1.0
  float vbat;
  BattState batt;
};

// ---------------- Module interfaces ----------------
// WiFiManager.ino
void wifiInit();
void wifiUpdate();
bool wifiIsConnected();
uint32_t wifiReconnectCount();
// CommHandler.ino
void commInit();
void commTask(void *arg);
bool commIsConnected();
uint32_t commReconnectCount();
// CommandHandler.ino
bool commandHandle(const char *json, size_t len, char *reply, size_t replyLen);
// MotorControl.ino
bool motorsInit();
void motorsSetTarget(float left, float right);
void motorsStopNow();
void motorsSafeState();
void motorsUpdate(float dtSeconds);
void motorsGet(float *left, float *right);
bool motorsTargetActive();
// ServoControl.ino
bool servoInit();
bool servoSetAngle(float deg);
void servoNeutral();
float servoGetAngle();
// IMUHandler.ino
bool imuInit();
void imuTask(void *arg);
void imuGet(ImuSample *out);
void imuZero();
void imuSleep();
// GPSHandler.ino
void gpsInit();
void gpsTask(void *arg);
void gpsGet(GpsData *out);
// Telemetry.ino
size_t telemetryBuild(char *buf, size_t size);
// SafetyHandler.ino
void safetyInit();
void safetyTask(void *arg);
void safetyUpdate(uint32_t nowMs);
bool safetyArm(bool arm, const char **whyNot);
bool safetyIsArmed();
bool safetyMotionAllowed(const char **whyNot);
void safetyEstop(const char *source);
bool safetyEstopActive();
void safetyEstopReset();
void safetyCommandSeen();
void safetyLinkLost();
void safetySetSpeed(float speed);
float safetySpeed();
void safetyGetStatus(SafetyStatus *out);
const char *safetyBattName(BattState s);
// OTAHandler.ino
void otaHandle();
// PowerHandler.ino
void powerLogWakeReason();
void powerRequestSleep(const char *reason);
void powerService();
const char *powerResetReason();
