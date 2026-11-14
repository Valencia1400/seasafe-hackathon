// Logger.ino - centralized, levelled, non-blocking logging.
// Callers only format the message and put it in a queue; a low-priority task prints it.
// If the queue is full the message is dropped and counted (CRITICAL messages push out the oldest instead).
struct LogEntry {
  uint32_t ms;
  uint8_t level;
  char tag[8];
  char msg[LOG_MSG_MAX];
};

static QueueHandle_t s_logQueue = nullptr;
static volatile uint8_t s_logLevel = LOG_DEFAULT_LEVEL;
static volatile uint32_t s_logDropped = 0;

static void logTaskFn(void *arg) {
  static const char *names[] = { "DEBUG", "INFO", "WARN", "ERROR", "CRIT" };
  LogEntry e;
  for (;;) {
    if (xQueueReceive(s_logQueue, &e, portMAX_DELAY) == pdTRUE) {
      Serial.printf("[%9lu] %-5s %-7s %s\n", (unsigned long)e.ms, names[e.level], e.tag, e.msg);
    }
  }
}

void logInit() {
  Serial.begin(SERIAL_BAUD);
  s_logQueue = xQueueCreate(LOG_QUEUE_LENGTH, sizeof(LogEntry));
  xTaskCreatePinnedToCore(logTaskFn, "logger", 4096, nullptr, 1, nullptr, 0);
}

void logMsg(LogLevel level, const char *tag, const char *fmt, ...) {
  if (level < s_logLevel || s_logQueue == nullptr) return;
  LogEntry e;
  e.ms = millis();
  e.level = level;
  strlcpy(e.tag, tag, sizeof(e.tag));
  va_list args;
  va_start(args, fmt);
  vsnprintf(e.msg, sizeof(e.msg), fmt, args);
  va_end(args);
  if (xQueueSend(s_logQueue, &e, 0) != pdTRUE) {
    if (level == LOG_CRITICAL) {            // safety messages must not be lost: discard the oldest entry
      LogEntry old;
      xQueueReceive(s_logQueue, &old, 0);
      xQueueSend(s_logQueue, &e, 0);
    }
    s_logDropped = s_logDropped + 1;
  }
}

void logSetLevel(LogLevel level) { s_logLevel = level; }
LogLevel logGetLevel() { return (LogLevel)s_logLevel; }
uint32_t logDroppedCount() { return s_logDropped; }
