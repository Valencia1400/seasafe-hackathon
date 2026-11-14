// CommHandler.ino - WebSocket CLIENT: the ESP32 dials out to the website's server and keeps the link alive.
// All WebSocket calls happen in this one task (the library is not thread-safe).
static WebSocketsClient s_ws;
static volatile bool s_wsConnected = false;
static volatile uint32_t s_wsReconnects = 0;
static uint32_t s_wsLastWarnMs = 0;
static uint32_t s_telemetrySent = 0;
static char s_txBuf[1100];

static void commOnEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      s_wsConnected = true;
      LOGI("COMM", "connected to website server %s://%s:%d%s", WS_USE_TLS ? "wss" : "ws", WS_HOST, WS_PORT, WS_PATH);
      char hello[160];
      snprintf(hello, sizeof(hello), "{\"type\":\"hello\",\"device\":\"seaguardian\",\"fw\":\"%s\",\"reset\":\"%s\"}", FW_VERSION,
               powerResetReason());
      s_ws.sendTXT(hello);
      break;
    }
    case WStype_DISCONNECTED:
      if (s_wsConnected) {
        s_wsConnected = false;
        s_wsReconnects = s_wsReconnects + 1;
        LOGW("COMM", "website server connection LOST");
        safetyLinkLost();
      }
      break;
    case WStype_TEXT: {
      char reply[200];
      commandHandle((const char *)payload, length, reply, sizeof(reply));
      if (reply[0]) s_ws.sendTXT(reply);
      break;
    }
    case WStype_BIN:
      LOGW("COMM", "binary frame ignored (%u bytes): commands must be JSON text", (unsigned)length);
      break;
    case WStype_ERROR:
      LOGE("COMM", "WebSocket error (%u bytes of detail)", (unsigned)length);
      break;
    default:
      break;      // ping / pong / fragments are handled inside the library
  }
}

void commInit() {
#if WS_USE_TLS
  s_ws.beginSSL(WS_HOST, WS_PORT, WS_PATH, "", "");
#else
  s_ws.begin(WS_HOST, WS_PORT, WS_PATH, "");
#endif
  s_ws.onEvent(commOnEvent);
  s_ws.setReconnectInterval(WS_RECONNECT_MS);
  s_ws.enableHeartbeat(WS_PING_INTERVAL_MS, WS_PONG_TIMEOUT_MS, WS_PING_FAILS_TO_DROP);
  LOGI("COMM", "WebSocket client configured for %s://%s:%d%s, telemetry every %d ms", WS_USE_TLS ? "wss" : "ws", WS_HOST,
       WS_PORT, WS_PATH, TELEMETRY_INTERVAL_MS);
}

void commTask(void *arg) {
  uint32_t lastTelemetry = 0;
  for (;;) {
    uint32_t now = millis();
    wifiUpdate();
    if (wifiIsConnected()) {
      s_ws.loop();                 // may block for a few seconds while the server is unreachable: that is why
      otaHandle();                 // motor safety runs in its own task
      now = millis();
      if (s_wsConnected && now - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
        lastTelemetry = now;
        size_t n = telemetryBuild(s_txBuf, sizeof(s_txBuf));
        if (n > 0) {
          if (!s_ws.sendTXT(s_txBuf, n)) LOGW("COMM", "telemetry frame could not be sent");
          else if (++s_telemetrySent % LOG_TELEMETRY_EVERY_N == 0) LOGD("COMM", "telemetry #%lu: %s", (unsigned long)s_telemetrySent, s_txBuf);
        }
      }
      if (!s_wsConnected && now - s_wsLastWarnMs >= 10000) {
        s_wsLastWarnMs = now;
        LOGW("COMM", "website server %s:%d not reachable yet, retrying every %d ms", WS_HOST, WS_PORT, WS_RECONNECT_MS);
      }
    } else if (s_wsConnected) {    // Wi-Fi dropped underneath the socket
      s_wsConnected = false;
      s_wsReconnects = s_wsReconnects + 1;
      s_ws.disconnect();
      LOGW("COMM", "Wi-Fi down: website link closed");
      safetyLinkLost();
    }
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

bool commIsConnected() { return s_wsConnected; }
uint32_t commReconnectCount() { return s_wsReconnects; }
