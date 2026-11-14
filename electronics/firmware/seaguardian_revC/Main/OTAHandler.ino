// OTAHandler.ino - wireless firmware upload from the Arduino IDE (Tools > Port > "seaguardian at <ip>").
// The motors are stopped and disarmed for the duration of an update.
#if ENABLE_OTA
static bool s_otaStarted = false;

void otaHandle() {
  if (!s_otaStarted) {
    ArduinoOTA.setHostname(WIFI_HOSTNAME);
    ArduinoOTA.setPassword(OTA_PASSWORD);
    ArduinoOTA.onStart([]() {
      safetyLinkLost();        // stop + disarm
      LOGC("OTA", "firmware update started: motors stopped and disarmed");
    });
    ArduinoOTA.onProgress([](unsigned int done, unsigned int total) {
      static int lastTenth = -1;
      int tenth = (int)(done * 10ULL / total);
      if (tenth != lastTenth) { lastTenth = tenth; LOGI("OTA", "progress %d %%", tenth * 10); }
    });
    ArduinoOTA.onEnd([]() { LOGI("OTA", "update complete, restarting"); });
    ArduinoOTA.onError([](ota_error_t error) {
      LOGE("OTA", "update FAILED, error %u (%s). The previous firmware keeps running", (unsigned)error,
           error == OTA_AUTH_ERROR ? "wrong password" : error == OTA_BEGIN_ERROR ? "not enough space: check partition scheme"
           : error == OTA_CONNECT_ERROR ? "connection" : error == OTA_RECEIVE_ERROR ? "receive" : "end");
    });
    ArduinoOTA.begin();
    s_otaStarted = true;
    LOGI("OTA", "wireless upload enabled: host '%s', port 3232", WIFI_HOSTNAME);
  }
  ArduinoOTA.handle();
}
#else
void otaHandle() {}
#endif
