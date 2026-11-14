// Minimal stand-in for the Arduino/ESP32 environment, so the real .ino logic can be unit-tested on a PC.
#pragma once
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <map>
using std::isfinite;
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define RAD_TO_DEG 57.29578f
extern uint32_t g_nowMs;
extern std::map<int, int> g_pin;      // digital pin states
extern std::map<int, int> g_duty;     // PWM duty per pin
inline uint32_t millis() { return g_nowMs; }
inline void pinMode(int, int) {}
inline void digitalWrite(int pin, int v) { g_pin[pin] = v; }
inline bool ledcAttachChannel(int, int, int, int) { return true; }
inline void ledcWrite(int pin, int duty) { g_duty[pin] = duty; }
inline int analogReadMilliVolts(int) { return 0; }
typedef int portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) ((void)(x))
#define portEXIT_CRITICAL(x) ((void)(x))
typedef uint32_t TickType_t;
inline TickType_t xTaskGetTickCount() { return 0; }
inline void vTaskDelayUntil(TickType_t *, TickType_t) {}
#define pdMS_TO_TICKS(x) (x)
inline int esp_task_wdt_add(void *) { return 0; }
inline int esp_task_wdt_reset() { return 0; }
typedef void *SemaphoreHandle_t;
#define portMAX_DELAY 0
inline SemaphoreHandle_t xSemaphoreCreateRecursiveMutex() { return (SemaphoreHandle_t)1; }
inline int xSemaphoreTakeRecursive(SemaphoreHandle_t, int) { return 1; }
inline int xSemaphoreGiveRecursive(SemaphoreHandle_t) { return 1; }
