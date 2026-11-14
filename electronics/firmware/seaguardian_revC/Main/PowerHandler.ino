// PowerHandler.ino - deep sleep (wake with the button on PIN_WAKE_BUTTON) and reset/wake diagnostics.
static volatile bool s_sleepRequested = false;
static char s_sleepReason[40] = "";

const char *powerResetReason() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:   return "power_on";
    case ESP_RST_SW:        return "software";
    case ESP_RST_PANIC:     return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT:       return "watchdog";
    case ESP_RST_DEEPSLEEP: return "deep_sleep_wake";
    case ESP_RST_BROWNOUT:  return "brownout";       // supply voltage dipped: power wiring / capacitors
    default:                return "other";
  }
}

void powerLogWakeReason() {
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    LOGI("POWER", "woken from deep sleep by the wake button (GPIO%d)", PIN_WAKE_BUTTON);
    rtc_gpio_deinit((gpio_num_t)PIN_WAKE_BUTTON);
  }
  if (esp_reset_reason() == ESP_RST_BROWNOUT) LOGC("POWER", "previous reset was a BROWN-OUT: the 5 V supply dipped (motor/servo current)");
  if (esp_reset_reason() == ESP_RST_PANIC) LOGE("POWER", "previous reset was a firmware crash");
}

// Only records the request; the sleep itself is carried out from loop() so the acknowledgement can still be sent.
void powerRequestSleep(const char *reason) {
  strlcpy(s_sleepReason, reason, sizeof(s_sleepReason));
  s_sleepRequested = true;
}

void powerService() {
  if (!s_sleepRequested) return;
  LOGC("POWER", "entering deep sleep (%s). Press the button on GPIO%d to wake", s_sleepReason, PIN_WAKE_BUTTON);
  safetyLinkLost();                       // stop + disarm
  motorsSafeState();
  servoNeutral();
  delay(600);                             // let the reply and the log line go out
  imuSleep();
  WiFi.disconnect(true);
  digitalWrite(PIN_STATUS_LED, LOW);
  rtc_gpio_init((gpio_num_t)PIN_WAKE_BUTTON);
  rtc_gpio_set_direction((gpio_num_t)PIN_WAKE_BUTTON, RTC_GPIO_MODE_INPUT_ONLY);
  rtc_gpio_pullup_en((gpio_num_t)PIN_WAKE_BUTTON);
  rtc_gpio_pulldown_dis((gpio_num_t)PIN_WAKE_BUTTON);
  esp_sleep_enable_ext0_wakeup((gpio_num_t)PIN_WAKE_BUTTON, 0);
  esp_deep_sleep_start();
}
