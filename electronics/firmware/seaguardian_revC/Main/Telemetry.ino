// Telemetry.ino - builds the telemetry JSON. Values that are not available are sent as null, never as fake numbers.
// Units: acceleration g, rotation deg/s, angles deg, altitude m, speed km/h, times ms since boot unless stated.
static uint32_t s_telemetrySeq = 0;

// Appends formatted text; returns false once the buffer is full.
static bool telAppend(char *buf, size_t size, size_t *pos, const char *fmt, ...) {
  if (*pos >= size) return false;
  va_list args;
  va_start(args, fmt);
  int n = vsnprintf(buf + *pos, size - *pos, fmt, args);
  va_end(args);
  if (n < 0 || (size_t)n >= size - *pos) { *pos = size; return false; }
  *pos += n;
  return true;
}

// Writes  "key":value  or  "key":null
static void telNumber(char *buf, size_t size, size_t *pos, const char *key, bool valid, double value, int decimals) {
  if (valid && isfinite(value)) telAppend(buf, size, pos, "\"%s\":%.*f", key, decimals, value);
  else telAppend(buf, size, pos, "\"%s\":null", key);
}

size_t telemetryBuild(char *buf, size_t size) {
  ImuSample imu;
  GpsData gps;
  SafetyStatus st;
  float ml, mr;
  imuGet(&imu);
  gpsGet(&gps);
  safetyGetStatus(&st);
  motorsGet(&ml, &mr);
  size_t p = 0;

  telAppend(buf, size, &p, "{\"type\":\"telemetry\",\"seq\":%lu,\"t_ms\":%lu,", (unsigned long)s_telemetrySeq++, (unsigned long)millis());
  telAppend(buf, size, &p, "\"imu\":{\"ok\":%s,\"t_ms\":%lu,", imu.ok ? "true" : "false", (unsigned long)imu.tMs);
  telNumber(buf, size, &p, "ax", imu.ok, imu.ax, 3);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "ay", imu.ok, imu.ay, 3);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "az", imu.ok, imu.az, 3);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "gx", imu.ok, imu.gx, 2);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "gy", imu.ok, imu.gy, 2);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "gz", imu.ok, imu.gz, 2);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "roll", imu.ok, imu.roll, 1);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "pitch", imu.ok, imu.pitch, 1); telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "yaw", imu.ok, imu.yaw, 1);     telAppend(buf, size, &p, ",");
  telAppend(buf, size, &p, "\"yaw_relative\":true,");
  telNumber(buf, size, &p, "temp", imu.ok, imu.tempC, 1);
  telAppend(buf, size, &p, ",\"errors\":%lu},", (unsigned long)imu.errors);

  telAppend(buf, size, &p, "\"gps\":{\"receiving\":%s,\"fix\":%s,", gps.receiving ? "true" : "false", gps.fix ? "true" : "false");
  telNumber(buf, size, &p, "lat", gps.fix, gps.lat, 6);              telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "lon", gps.fix, gps.lon, 6);              telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "alt_m", gps.altValid, gps.altM, 1);      telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "speed_kmh", gps.speedValid, gps.speedKmh, 1);  telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "course", gps.courseValid, gps.courseDeg, 1);   telAppend(buf, size, &p, ",");
  telNumber(buf, size, &p, "hdop", gps.hdopValid, gps.hdop, 1);
  telAppend(buf, size, &p, ",\"sats\":%lu,\"age_ms\":%lu,", (unsigned long)gps.satellites, (unsigned long)gps.fixAgeMs);
  if (gps.timeValid) telAppend(buf, size, &p, "\"utc\":\"%04u-%02u-%02uT%02u:%02u:%02uZ\"},", gps.year, gps.month, gps.day, gps.hour, gps.minute, gps.second);
  else telAppend(buf, size, &p, "\"utc\":null},");

  telAppend(buf, size, &p, "\"motors\":{\"armed\":%s,\"left\":%.2f,\"right\":%.2f,\"limit\":%.2f},", st.armed ? "true" : "false", ml, mr, st.speed);
  telAppend(buf, size, &p, "\"servos\":[%.0f],", servoGetAngle());
  telAppend(buf, size, &p, "\"batt\":{");
  telNumber(buf, size, &p, "v", st.batt != BATT_DISABLED, st.vbat, 2);
  telAppend(buf, size, &p, ",\"state\":\"%s\"},", safetyBattName(st.batt));
  bool ok = telAppend(buf, size, &p,
      "\"sys\":{\"estop\":%s,\"failsafe\":%s,\"wifi\":true,\"rssi\":%d,\"ip\":\"%s\",\"reconnects\":%lu,\"server_reconnects\":%lu,"
      "\"heap\":%lu,\"uptime_s\":%lu,\"reset\":\"%s\",\"fw\":\"%s\"}}",
      st.estop ? "true" : "false", st.failsafe ? "true" : "false", (int)WiFi.RSSI(), WiFi.localIP().toString().c_str(),
      (unsigned long)wifiReconnectCount(), (unsigned long)commReconnectCount(), (unsigned long)ESP.getFreeHeap(),
      (unsigned long)(millis() / 1000), powerResetReason(), FW_VERSION);
  if (!ok) {
    LOGE("TELEM", "telemetry frame does not fit in %u bytes, not sent", (unsigned)size);
    return 0;
  }
  return p;
}
