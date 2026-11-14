// WiFiManager.ino - connects to the configured network and keeps reconnecting, without ever restarting the ESP32.
static volatile bool s_wifiUp = false;
static volatile uint32_t s_wifiReconnects = 0;
static uint32_t s_wifiAttempts = 0;
static uint32_t s_wifiLastAttemptMs = 0;

static void wifiAttempt() {
  s_wifiAttempts++;
  s_wifiLastAttemptMs = millis();
  LOGI("WIFI", "connection attempt %lu to '%s'", (unsigned long)s_wifiAttempts, WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

static void wifiOnEvent(arduino_event_id_t event, arduino_event_info_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      LOGI("WIFI", "associated with access point, waiting for an IP address");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      s_wifiUp = true;
      LOGI("WIFI", "connected: IP %s, gateway %s, RSSI %d dBm", WiFi.localIP().toString().c_str(),
           WiFi.gatewayIP().toString().c_str(), (int)WiFi.RSSI());
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED: {
      int reason = info.wifi_sta_disconnected.reason;
      const char *hint = reason == 201 ? " (network not found: check SSID, hotspot on, 2.4 GHz)"
                       : (reason == 15 || reason == 202 || reason == 2) ? " (authentication failed: check password)" : "";
      if (s_wifiUp) {
        s_wifiReconnects = s_wifiReconnects + 1;
        LOGW("WIFI", "connection LOST, reason %d%s", reason, hint);
      } else {
        LOGW("WIFI", "attempt failed, reason %d%s", reason, hint);
      }
      s_wifiUp = false;
      break;
    }
    default:
      break;
  }
}

void wifiInit() {
  WiFi.persistent(false);          // do not wear the flash with credentials
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(WIFI_HOSTNAME);
  WiFi.setAutoReconnect(false);    // reconnection is handled (and logged) here
  WiFi.setSleep(false);            // modem sleep off: lowest latency for control commands
  WiFi.onEvent(wifiOnEvent);
  wifiAttempt();
}

// Called regularly from the comm task. Never blocks.
void wifiUpdate() {
  if (!s_wifiUp && millis() - s_wifiLastAttemptMs >= WIFI_RETRY_INTERVAL_MS) wifiAttempt();
}

bool wifiIsConnected() { return s_wifiUp; }
uint32_t wifiReconnectCount() { return s_wifiReconnects; }
