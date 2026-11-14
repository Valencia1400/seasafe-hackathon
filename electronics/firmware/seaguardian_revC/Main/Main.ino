// =====================================================================================
// SeaGuardian - ESP32 firmware (Arduino framework)
// Main.ino: start-up sequence and task creation. All settings are in Config.h.
//
// Tasks (FreeRTOS):
//   safety  prio 4  50 Hz   watchdog, emergency stop, motor ramp      (never waits on network or sensors)
//   imu     prio 3  100 Hz  MPU6050 + attitude filter
//   gps     prio 2  50 Hz   NEO-6M NMEA parsing
//   comm    prio 2  ~200 Hz Wi-Fi supervision, WebSocket client, telemetry, OTA
//   logger  prio 1          prints queued log messages
//   loop()  prio 1          health report, deep-sleep requests
// =====================================================================================
#include <WiFi.h>
#include <Wire.h>
#include <WebSocketsClient.h>   // "WebSockets" by Markus Sattler
#include <ArduinoJson.h>        // "ArduinoJson" by Benoit Blanchon (v7)
#include <TinyGPSPlus.h>        // "TinyGPSPlus" by Mikal Hart
#include <ArduinoOTA.h>
#include <esp_sleep.h>
#include <driver/rtc_io.h>
#include <esp_task_wdt.h>
#include "Config.h"
#include "Types.h"

void setup() {
  logInit();
  LOGI("MAIN", "==== SeaGuardian firmware %s ====", FW_VERSION);
  LOGI("MAIN", "last reset: %s, free heap %u bytes", powerResetReason(), (unsigned)ESP.getFreeHeap());
  powerLogWakeReason();

  // Motors first, so the driver is in its safe state before anything else can go wrong.
  bool motorsOk = motorsInit();
  bool servoOk = servoInit();
  bool imuOk = imuInit();
  gpsInit();
  safetyInit();
  if (!motorsOk) {
    safetyEstop("motor PWM setup failed");     // never drive with a half-configured motor stage
  }
  LOGI("MAIN", "init summary: motors=%s servo=%s imu=%s", motorsOk ? "OK" : "FAILED", servoOk ? "OK" : "FAILED",
       imuOk ? "OK" : "NOT FOUND");

  wifiInit();
  commInit();

  xTaskCreatePinnedToCore(safetyTask, "safety", 4096, nullptr, 4, nullptr, 1);
  xTaskCreatePinnedToCore(imuTask, "imu", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(gpsTask, "gps", 4096, nullptr, 2, nullptr, 1);
  xTaskCreatePinnedToCore(commTask, "comm", 8192, nullptr, 2, nullptr, 0);
  LOGI("MAIN", "start-up complete, tasks running");
}

void loop() {
  static uint32_t lastHealth = 0;
  uint32_t now = millis();
  if (now - lastHealth >= HEALTH_LOG_INTERVAL_MS) {
    lastHealth = now;
    SafetyStatus st;
    safetyGetStatus(&st);
    LOGI("HEALTH", "uptime %lu s, heap %u (min %u), wifi %s rssi %d dBm, server %s, armed %d, estop %d, log drops %lu",
         (unsigned long)(now / 1000), (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMinFreeHeap(),
         wifiIsConnected() ? "up" : "DOWN", wifiIsConnected() ? (int)WiFi.RSSI() : 0,
         commIsConnected() ? "connected" : "NOT connected", st.armed, st.estop, (unsigned long)logDroppedCount());
  }
  powerService();     // carries out a pending deep-sleep request
  delay(50);
}
