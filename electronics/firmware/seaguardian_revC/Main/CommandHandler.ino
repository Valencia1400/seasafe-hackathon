// CommandHandler.ino - parses one JSON command from the website, validates every field, then executes it.
// A command with ANY invalid field is rejected as a whole, and a rejected command does not feed the watchdog.
#define CMD_MAX_LEN 256

static char s_lastMove[10] = "";      // direction of the active "move" command ("" = none)

static bool cmdReject(char *reply, size_t n, const char *cmd, const char *msg) {
  snprintf(reply, n, "{\"type\":\"error\",\"cmd\":\"%s\",\"msg\":\"%s\"}", cmd, msg);
  LOGW("CMD", "REJECTED '%s': %s", cmd, msg);
  return false;
}

static bool cmdAck(char *reply, size_t n, const char *cmd) {
  snprintf(reply, n, "{\"type\":\"ack\",\"cmd\":\"%s\"}", cmd);
  LOGI("CMD", "accepted '%s'", cmd);
  return true;
}

// Reads a finite number in [lo, hi]. Missing, wrong type, NaN, infinity or out of range -> false.
static bool cmdNumber(JsonVariantConst v, float lo, float hi, float *out) {
  if (!v.is<float>()) return false;
  float f = v.as<float>();
  if (!isfinite(f) || f < lo || f > hi) return false;
  *out = f;
  return true;
}

static float cmdClamp1(float v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }

static bool cmdApplyMove(const char *dir) {
  float s = safetySpeed();
  if (!strcmp(dir, "forward"))        motorsSetTarget(s, s);
  else if (!strcmp(dir, "backward"))  motorsSetTarget(-s, -s);
  else if (!strcmp(dir, "left"))      motorsSetTarget(-s * MOTOR_TURN_RATIO, s * MOTOR_TURN_RATIO);
  else if (!strcmp(dir, "right"))     motorsSetTarget(s * MOTOR_TURN_RATIO, -s * MOTOR_TURN_RATIO);
  else return false;
  strlcpy(s_lastMove, dir, sizeof(s_lastMove));
  return true;
}

bool commandHandle(const char *json, size_t len, char *reply, size_t replyLen) {
  reply[0] = 0;
  if (len > CMD_MAX_LEN) return cmdReject(reply, replyLen, "?", "message too long");
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json, len);
  if (err || !doc.is<JsonObject>()) return cmdReject(reply, replyLen, "?", "not a JSON object");

  char name[16] = "?";
  JsonVariantConst jc = doc["cmd"];
  if (!jc.is<const char *>() || strlen(jc.as<const char *>()) >= sizeof(name))
    return cmdReject(reply, replyLen, name, "missing or invalid 'cmd'");
  strlcpy(name, jc.as<const char *>(), sizeof(name));
  for (char *p = name; *p; p++) {      // the name is echoed inside a JSON reply: allow only a-z and _
    if (!((*p >= 'a' && *p <= 'z') || *p == '_')) return cmdReject(reply, replyLen, "?", "invalid 'cmd'");
  }
  const char *why = "";

  // ---- Emergency stop first: it has priority over everything else ----
  if (!strcmp(name, "estop")) {
    safetyEstop("command from website");
    s_lastMove[0] = 0;
    return cmdAck(reply, replyLen, name);
  }
  if (!strcmp(name, "estop_reset")) {
    safetyEstopReset();
    safetyCommandSeen();
    return cmdAck(reply, replyLen, name);
  }
  if (!strcmp(name, "stop")) {
    motorsStopNow();
    s_lastMove[0] = 0;
    safetyCommandSeen();
    return cmdAck(reply, replyLen, name);
  }
  if (!strcmp(name, "ping")) {
    safetyCommandSeen();
    return true;
  }

  // ---- Movement ----
  if (!strcmp(name, "drive")) {
    float t, s;
    if (!cmdNumber(doc["throttle"], -1, 1, &t) || !cmdNumber(doc["steer"], -1, 1, &s))
      return cmdReject(reply, replyLen, name, "throttle and steer must be numbers in -1..1");
    if (!safetyMotionAllowed(&why)) return cmdReject(reply, replyLen, name, why);
    float k = safetySpeed();
    motorsSetTarget(cmdClamp1(t + s) * k, cmdClamp1(t - s) * k);
    s_lastMove[0] = 0;
    safetyCommandSeen();
    LOGD("CMD", "drive throttle %.2f steer %.2f", t, s);
    return true;
  }
  if (!strcmp(name, "motors")) {
    float l, r;
    if (!cmdNumber(doc["left"], -1, 1, &l) || !cmdNumber(doc["right"], -1, 1, &r))
      return cmdReject(reply, replyLen, name, "left and right must be numbers in -1..1");
    if (!safetyMotionAllowed(&why)) return cmdReject(reply, replyLen, name, why);
    motorsSetTarget(l, r);
    s_lastMove[0] = 0;
    safetyCommandSeen();
    LOGD("CMD", "motors left %.2f right %.2f", l, r);
    return true;
  }
  if (!strcmp(name, "move")) {
    JsonVariantConst d = doc["dir"];
    const char *dir = d.is<const char *>() ? d.as<const char *>() : "";
    if (strcmp(dir, "forward") && strcmp(dir, "backward") && strcmp(dir, "left") && strcmp(dir, "right"))
      return cmdReject(reply, replyLen, name, "'dir' must be forward, backward, left or right");
    if (!safetyMotionAllowed(&why)) return cmdReject(reply, replyLen, name, why);
    bool changed = strcmp(dir, s_lastMove) != 0;
    cmdApplyMove(dir);
    safetyCommandSeen();
    if (changed) LOGI("CMD", "move %s at speed %.0f %%", dir, safetySpeed() * 100);
    return true;
  }
  if (!strcmp(name, "arm")) {
    JsonVariantConst v = doc["value"];
    if (!v.is<bool>()) return cmdReject(reply, replyLen, name, "'value' must be true or false");
    if (!safetyArm(v.as<bool>(), &why)) return cmdReject(reply, replyLen, name, why);
    s_lastMove[0] = 0;
    return cmdAck(reply, replyLen, name);
  }

  // ---- Speed ----
  if (!strcmp(name, "speed") || !strcmp(name, "limit") || !strcmp(name, "speed_up") || !strcmp(name, "speed_down")) {
    float v = safetySpeed();
    if (!strcmp(name, "speed_up")) v += SPEED_STEP;
    else if (!strcmp(name, "speed_down")) v -= SPEED_STEP;
    else if (!cmdNumber(doc["value"], 0.1f, 1.0f, &v)) return cmdReject(reply, replyLen, name, "'value' must be 0.1..1");
    safetySetSpeed(v);
    // Re-apply to a move that is still running. Never restarts motors that were stopped (watchdog, stop, e-stop).
    if (s_lastMove[0] && motorsTargetActive() && safetyMotionAllowed(nullptr)) cmdApplyMove(s_lastMove);
    safetyCommandSeen();
    LOGI("CMD", "speed set to %.0f %%", safetySpeed() * 100);
    return cmdAck(reply, replyLen, name);
  }

  // ---- Servo ----
  if (!strcmp(name, "servo") || !strcmp(name, "servo_neutral")) {
    if (ESTOP_BLOCKS_SERVO && safetyEstopActive()) return cmdReject(reply, replyLen, name, "emergency stop active");
    if (!strcmp(name, "servo_neutral")) {
      servoNeutral();
      safetyCommandSeen();
      return cmdAck(reply, replyLen, name);
    }
    float id = 1, angle;
    if (!doc["id"].isNull() && (!cmdNumber(doc["id"], 1, 1, &id)))
      return cmdReject(reply, replyLen, name, "'id' must be 1 (only one servo is fitted)");
    if (!cmdNumber(doc["angle"], -1000, 1000, &angle)) return cmdReject(reply, replyLen, name, "'angle' must be a number");
    if (!servoSetAngle(angle)) return cmdReject(reply, replyLen, name, "'angle' outside the allowed range");
    safetyCommandSeen();
    return true;
  }

  // ---- Miscellaneous ----
  if (!strcmp(name, "imu_zero")) {
    imuZero();
    return cmdAck(reply, replyLen, name);
  }
  if (!strcmp(name, "sleep")) {
    if (safetyIsArmed()) return cmdReject(reply, replyLen, name, "disarm first");
    powerRequestSleep("command from website");
    return cmdAck(reply, replyLen, name);
  }
  if (!strcmp(name, "log_level")) {
    JsonVariantConst v = doc["value"];
    const char *s = v.is<const char *>() ? v.as<const char *>() : "";
    static const char *levels[] = { "debug", "info", "warning", "error", "critical" };
    for (int i = 0; i < 5; i++) {
      if (!strcmp(s, levels[i])) {
        logSetLevel((LogLevel)i);
        return cmdAck(reply, replyLen, name);
      }
    }
    return cmdReject(reply, replyLen, name, "'value' must be debug, info, warning, error or critical");
  }
  return cmdReject(reply, replyLen, name, "unknown command");
}
