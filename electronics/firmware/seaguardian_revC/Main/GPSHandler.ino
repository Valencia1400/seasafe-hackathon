// GPSHandler.ino - u-blox NEO-6M on UART2, parsed with TinyGPSPlus. Never blocks: it only reads bytes already received.
static TinyGPSPlus s_gps;
static SemaphoreHandle_t s_gpsMutex = nullptr;
static GpsData s_gpsData = {};

void gpsInit() {
  s_gpsMutex = xSemaphoreCreateMutex();
  Serial2.setRxBufferSize(1024);
  Serial2.begin(GPS_BAUD, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  LOGI("GPS", "NEO-6M UART ready: %d baud, ESP32 RX=GPIO%d (from GPS TX), TX=GPIO%d (to GPS RX)", GPS_BAUD, PIN_GPS_RX, PIN_GPS_TX);
}

void gpsTask(void *arg) {
  uint32_t lastCharMs = millis(), lastWarnMs = 0, lastChars = 0, lastFails = 0, lastStatusMs = 0, lastSats = 0;
  bool hadFix = false, silent = false;
  for (;;) {
    while (Serial2.available() > 0) s_gps.encode((char)Serial2.read());
    uint32_t now = millis();
    uint32_t chars = s_gps.charsProcessed();
    if (chars != lastChars) {
      lastChars = chars;
      lastCharMs = now;
      if (silent) { silent = false; LOGI("GPS", "NMEA data is arriving again"); }
    }
    bool receiving = (now - lastCharMs) < GPS_SILENCE_WARN_MS;
    if (!receiving && now - lastWarnMs >= GPS_SILENCE_WARN_MS) {
      lastWarnMs = now;
      silent = true;
      LOGE("GPS", "no data from the module for %lu s: check power, GPS TX -> GPIO%d, and baud rate %d",
           (unsigned long)((now - lastCharMs) / 1000), PIN_GPS_RX, GPS_BAUD);
    }
    uint32_t fails = s_gps.failedChecksum();
    if (fails != lastFails) {
      LOGW("GPS", "%lu corrupted NMEA sentence(s) discarded (total %lu): electrical noise or wrong baud rate",
           (unsigned long)(fails - lastFails), (unsigned long)fails);
      lastFails = fails;
    }

    GpsData d = {};
    d.receiving = receiving;
    d.fix = receiving && s_gps.location.isValid() && s_gps.location.age() < GPS_FIX_MAX_AGE_MS;
    d.lat = s_gps.location.lat();
    d.lon = s_gps.location.lng();
    d.fixAgeMs = s_gps.location.isValid() ? s_gps.location.age() : 0;
    d.altValid = d.fix && s_gps.altitude.isValid();       d.altM = s_gps.altitude.meters();
    d.speedValid = d.fix && s_gps.speed.isValid();        d.speedKmh = s_gps.speed.kmph();
    d.courseValid = d.fix && s_gps.course.isValid();      d.courseDeg = s_gps.course.deg();
    d.satellites = s_gps.satellites.isValid() ? s_gps.satellites.value() : 0;
    d.hdopValid = s_gps.hdop.isValid();                   d.hdop = s_gps.hdop.hdop();
    d.timeValid = receiving && s_gps.date.isValid() && s_gps.time.isValid() && s_gps.date.year() >= 2024;
    d.year = s_gps.date.year(); d.month = s_gps.date.month(); d.day = s_gps.date.day();
    d.hour = s_gps.time.hour(); d.minute = s_gps.time.minute(); d.second = s_gps.time.second();
    d.chars = chars; d.sentences = s_gps.sentencesWithFix(); d.checksumFails = fails;
    xSemaphoreTake(s_gpsMutex, portMAX_DELAY);
    s_gpsData = d;
    xSemaphoreGive(s_gpsMutex);

    if (d.fix && !hadFix) LOGI("GPS", "FIX acquired: %.6f, %.6f, %lu satellites", d.lat, d.lon, (unsigned long)d.satellites);
    if (!d.fix && hadFix) LOGW("GPS", "fix LOST (last position %lu ms old)", (unsigned long)d.fixAgeMs);
    hadFix = d.fix;
    if (now - lastStatusMs >= 30000 || (d.satellites != lastSats && logGetLevel() == LOG_DEBUG)) {
      lastStatusMs = now;
      lastSats = d.satellites;
      LOGI("GPS", "%s, %lu satellites, %lu characters, %lu checksum errors", d.fix ? "fix valid" : (receiving ? "searching (no fix yet)" : "no data"),
           (unsigned long)d.satellites, (unsigned long)chars, (unsigned long)fails);
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void gpsGet(GpsData *out) {
  if (!s_gpsMutex) { memset(out, 0, sizeof(*out)); return; }
  xSemaphoreTake(s_gpsMutex, portMAX_DELAY);
  *out = s_gpsData;
  xSemaphoreGive(s_gpsMutex);
}
