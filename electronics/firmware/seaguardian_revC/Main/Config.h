// =====================================================================================
// SeaGuardian (Arduino) - every setting you may need to change lives in this file.
// =====================================================================================
#pragma once

#define FW_VERSION              "1.0.0-arduino"

// ---------------- Wi-Fi + server address ----------------
// WIFI_SSID, WIFI_PASSWORD and WS_HOST live in secrets.h (git-ignored, so the password is never pushed).
// Copy secrets.example.h to secrets.h and fill it in. WS_HOST is the LAN address of the laptop that runs the
// dashboard (it prints the address when it starts) - never a public internet address.
#include "secrets.h"
#define WIFI_HOSTNAME           "seaguardian"
#define WIFI_RETRY_INTERVAL_MS  15000              // time between connection attempts (a slow DHCP needs more than 5 s)

// ---------------- Dashboard server (the ESP32 connects OUT to it as a WebSocket client) ----------------
#define WS_PORT                 8000               // dashboard/run_operator.py --http-port
#define WS_PATH                 "/ws"
#define WS_USE_TLS              0                  // 1 = wss:// (certificate is NOT verified), 0 = ws://
#define WS_RECONNECT_MS         2000               // retry interval while the server is unreachable
#define WS_PING_INTERVAL_MS     5000               // protocol-level ping to detect a dead server
#define WS_PONG_TIMEOUT_MS      2000
#define WS_PING_FAILS_TO_DROP   2

// ---------------- Pins ----------------
// L298N (remove the ENA and ENB jumpers so the ESP32 can drive them with PWM)
#define PIN_L298N_ENA           25    // PWM, left motor speed
#define PIN_L298N_IN1           26    // left motor direction
#define PIN_L298N_IN2           27
#define PIN_L298N_ENB           33    // PWM, right motor speed
#define PIN_L298N_IN3           32    // right motor direction
#define PIN_L298N_IN4           13
#define PIN_SERVO               18    // SG90 signal (orange)
#define PIN_I2C_SDA             21    // MPU6050
#define PIN_I2C_SCL             22
#define PIN_GPS_RX              16    // ESP32 receives here  <- NEO-6M TX
#define PIN_GPS_TX              17    // ESP32 transmits here -> NEO-6M RX
#define PIN_STATUS_LED          2     // on-board LED
#define PIN_WAKE_BUTTON         14    // button to GND; wakes the ESP32 from deep sleep (RTC-capable pin)
#define PIN_VBAT_SENSE          34    // only used if ENABLE_BATTERY_MONITOR = 1

// ---------------- Motors ----------------
#define MOTOR_PWM_FREQ_HZ       2000  // L298N is a slow bipolar bridge: 1-5 kHz works well
#define MOTOR_PWM_RES_BITS      8     // duty 0..255
#define MOTOR_MAX_DUTY          255   // hard upper limit (lower it to limit motor voltage/current)
#define MOTOR_MIN_DUTY          0     // duty at which the motor just starts turning (0 = no compensation)
#define MOTOR_SLEW_PER_S        2.0f  // output may change by this much per second (0 -> full in 0.5 s). 0 = no ramp
#define MOTOR_LEFT_INVERT       0     // 1 = swap direction in software instead of swapping the motor wires
#define MOTOR_RIGHT_INVERT      0
#define MOTOR_TURN_RATIO        0.6f  // "move left/right": motors counter-rotate at speed x this ratio
#define SPEED_DEFAULT           0.5f  // speed used by "move" after start-up (0.1 .. 1.0)
#define SPEED_STEP              0.1f  // change per speed_up / speed_down
#define ESTOP_BRAKE             0     // emergency-stop state: 0 = coast (outputs off), 1 = short-brake the motors

// ---------------- Servo (SG90) ----------------
#define SERVO_MIN_US            500   // pulse width at 0 degrees   (provisional: tune on your servo)
#define SERVO_MAX_US            2400  // pulse width at 180 degrees (provisional)
#define SERVO_MIN_ANGLE         0     // commands below this are rejected
#define SERVO_MAX_ANGLE         180   // commands above this are rejected
#define SERVO_NEUTRAL_ANGLE     90

// ---------------- Safety ----------------
#define CMD_TIMEOUT_MS          1000  // watchdog: stop the motors if no valid command arrives for this long
#define ESTOP_BLOCKS_SERVO      1     // 1 = servo commands are also rejected while the emergency stop is active

// ---------------- IMU (MPU6050) ----------------
#define IMU_SAMPLE_HZ           100
#define IMU_FILTER_ALPHA        0.98f // complementary filter: weight of the gyro
#define IMU_CAL_SAMPLES         200   // gyro bias calibration at start-up (2 s at 100 Hz, keep the vehicle still)

// ---------------- GPS (NEO-6M) ----------------
#define GPS_BAUD                9600
#define GPS_FIX_MAX_AGE_MS      3000  // a position older than this is reported as "no fix"
#define GPS_SILENCE_WARN_MS     5000  // warn if no characters arrive for this long

// ---------------- Telemetry ----------------
#define TELEMETRY_INTERVAL_MS   100   // 10 Hz

// ---------------- Logging ----------------
#define SERIAL_BAUD             115200
#define LOG_DEFAULT_LEVEL       LOG_INFO   // LOG_DEBUG, LOG_INFO, LOG_WARNING, LOG_ERROR, LOG_CRITICAL
#define LOG_QUEUE_LENGTH        48         // messages buffered while the serial port is busy
#define LOG_MSG_MAX             160        // longer messages are truncated
#define HEALTH_LOG_INTERVAL_MS  10000      // heap / RSSI / uptime report
#define LOG_TELEMETRY_EVERY_N   50         // at DEBUG level, print every Nth outgoing telemetry frame

// ---------------- Optional features ----------------
#define ENABLE_OTA              1          // wireless upload from the Arduino IDE (Tools > Port > network port)
#define OTA_PASSWORD            "seaguardian"
#define IDLE_SLEEP_MINUTES      0          // deep sleep after this long disarmed AND disconnected (0 = never)
#define ENABLE_BATTERY_MONITOR  0          // 1 only if the 100k/22k divider is fitted on PIN_VBAT_SENSE
#define BATT_CELLS              2
#define BATT_DIVIDER_RATIO      5.545f     // (100k + 22k) / 22k
#define BATT_LOW_V_PER_CELL     3.50f
#define BATT_CRIT_V_PER_CELL    3.30f
