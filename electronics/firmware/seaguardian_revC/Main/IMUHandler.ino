// IMUHandler.ino - MPU6050 over I2C (direct register access, no extra library) + complementary filter.
//   Ranges: accelerometer +/-4 g (8192 LSB/g), gyroscope +/-500 deg/s (65.5 LSB per deg/s).
//   Digital low-pass filter 44 Hz, sample rate IMU_SAMPLE_HZ.
//   Roll/pitch: gyro integration corrected by gravity. Yaw: gyro integration only -> relative, drifts.
#define MPU_REG_SMPLRT_DIV   0x19
#define MPU_REG_CONFIG       0x1A
#define MPU_REG_GYRO_CONFIG  0x1B
#define MPU_REG_ACCEL_CONFIG 0x1C
#define MPU_REG_ACCEL_XOUT_H 0x3B
#define MPU_REG_PWR_MGMT_1   0x6B
#define MPU_REG_WHO_AM_I     0x75
#define MPU_ACCEL_LSB_PER_G  8192.0f
#define MPU_GYRO_LSB_PER_DPS 65.5f

static uint8_t s_imuAddr = 0;
static SemaphoreHandle_t s_imuMutex = nullptr;
static ImuSample s_imuSample = {};
static float s_imuBias[3] = { 0, 0, 0 };
static volatile bool s_imuZeroRequest = true;      // calibrate once at start-up

static bool imuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(s_imuAddr);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

static bool imuRead(uint8_t reg, uint8_t *data, size_t len) {
  Wire.beginTransmission(s_imuAddr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)s_imuAddr, (int)len) != (int)len) return false;
  for (size_t i = 0; i < len; i++) data[i] = Wire.read();
  return true;
}

static bool imuConfigure() {
  if (!imuWrite(MPU_REG_PWR_MGMT_1, 0x01)) return false;     // wake up, clock = gyro X PLL
  delay(50);
  return imuWrite(MPU_REG_CONFIG, 0x03)                       // DLPF 44 Hz: rejects motor vibration
      && imuWrite(MPU_REG_SMPLRT_DIV, (uint8_t)(1000 / IMU_SAMPLE_HZ - 1))
      && imuWrite(MPU_REG_GYRO_CONFIG, 0x08)                  // +/-500 deg/s
      && imuWrite(MPU_REG_ACCEL_CONFIG, 0x08);                // +/-4 g
}

static bool imuProbe(bool logMissing) {
  for (uint8_t addr = 0x68; addr <= 0x69 && !s_imuAddr; addr++) {   // 0x68 (AD0 low) or 0x69 (AD0 high)
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) s_imuAddr = addr;
  }
  if (!s_imuAddr) {
    if (logMissing) LOGE("IMU", "MPU6050 not found at 0x68/0x69: check SDA=GPIO%d, SCL=GPIO%d, VCC and GND", PIN_I2C_SDA, PIN_I2C_SCL);
    return false;
  }
  uint8_t who = 0;
  imuRead(MPU_REG_WHO_AM_I, &who, 1);
  if (who != 0x68) LOGW("IMU", "WHO_AM_I = 0x%02X (genuine MPU6050 = 0x68): clone or different MPU, continuing", who);
  if (!imuConfigure()) {
    LOGE("IMU", "MPU6050 found at 0x%02X but configuration failed (I2C write error)", s_imuAddr);
    s_imuAddr = 0;
    return false;
  }
  LOGI("IMU", "MPU6050 ready at 0x%02X: +/-4 g, +/-500 deg/s, %d Hz. Keep still for %d s (gyro calibration)", s_imuAddr,
       IMU_SAMPLE_HZ, IMU_CAL_SAMPLES / IMU_SAMPLE_HZ);
  return true;
}

bool imuInit() {
  s_imuMutex = xSemaphoreCreateMutex();
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);
  Wire.setTimeOut(50);
  return imuProbe(true);
}

void imuTask(void *arg) {
  float roll = 0, pitch = 0, yaw = 0;
  float calSum[3] = { 0, 0, 0 }, calMin[3] = { 0, 0, 0 }, calMax[3] = { 0, 0, 0 };
  int calN = 0, failStreak = 0;
  bool haveAttitude = false;
  uint32_t tPrevUs = micros(), lastDebugMs = 0;
  while (!s_imuAddr) {                 // not connected at boot: keep looking, so a loose wire needs no restart
    vTaskDelay(pdMS_TO_TICKS(2000));
    imuProbe(false);
  }
  TickType_t last = xTaskGetTickCount();

  for (;;) {
    vTaskDelayUntil(&last, pdMS_TO_TICKS(1000 / IMU_SAMPLE_HZ));
    uint8_t b[14];
    bool ok = imuRead(MPU_REG_ACCEL_XOUT_H, b, sizeof(b));
    uint32_t nowUs = micros();

    if (!ok) {
      xSemaphoreTake(s_imuMutex, portMAX_DELAY);
      s_imuSample.errors++;
      if (++failStreak >= 5) s_imuSample.ok = false;
      xSemaphoreGive(s_imuMutex);
      if (failStreak % (2 * IMU_SAMPLE_HZ) == 5) {     // at the 5th failure, then every 2 s
        LOGE("IMU", "I2C read failed %d times in a row: re-initialising the sensor", failStreak);
        imuConfigure();
      }
      tPrevUs = nowUs;
      continue;
    }
    if (failStreak >= 5) LOGI("IMU", "sensor is responding again");
    failStreak = 0;

    float a[3], g[3];
    for (int i = 0; i < 3; i++) {
      a[i] = (int16_t)((b[2 * i] << 8) | b[2 * i + 1]) / MPU_ACCEL_LSB_PER_G;
      g[i] = (int16_t)((b[8 + 2 * i] << 8) | b[9 + 2 * i]) / MPU_GYRO_LSB_PER_DPS;
    }
    float tempC = (int16_t)((b[6] << 8) | b[7]) / 340.0f + 36.53f;

    if (s_imuZeroRequest) {                            // gyro bias = average rate while standing still
      for (int i = 0; i < 3; i++) {
        calSum[i] += g[i];
        if (calN == 0 || g[i] < calMin[i]) calMin[i] = g[i];
        if (calN == 0 || g[i] > calMax[i]) calMax[i] = g[i];
      }
      if (++calN >= IMU_CAL_SAMPLES) {
        float spread = 0;
        for (int i = 0; i < 3; i++) {
          s_imuBias[i] = calSum[i] / calN;
          if (calMax[i] - calMin[i] > spread) spread = calMax[i] - calMin[i];
          calSum[i] = 0;
        }
        calN = 0;
        yaw = 0;
        s_imuZeroRequest = false;
        LOGI("IMU", "calibration done: gyro bias %.2f %.2f %.2f deg/s", s_imuBias[0], s_imuBias[1], s_imuBias[2]);
        if (spread > 3.0f) LOGW("IMU", "the sensor moved during calibration (spread %.1f deg/s): send 'imu_zero' while still", spread);
      }
    }
    for (int i = 0; i < 3; i++) g[i] -= s_imuBias[i];

    float dt = (uint32_t)(nowUs - tPrevUs) / 1e6f;
    tPrevUs = nowUs;
    if (dt <= 0 || dt > 0.1f) dt = 1.0f / IMU_SAMPLE_HZ;

    float rollAcc = atan2f(a[1], a[2]) * RAD_TO_DEG;
    float pitchAcc = atan2f(-a[0], sqrtf(a[1] * a[1] + a[2] * a[2])) * RAD_TO_DEG;
    if (!haveAttitude) {
      roll = rollAcc; pitch = pitchAcc; haveAttitude = true;
    } else {
      roll = IMU_FILTER_ALPHA * (roll + g[0] * dt) + (1 - IMU_FILTER_ALPHA) * rollAcc;
      pitch = IMU_FILTER_ALPHA * (pitch + g[1] * dt) + (1 - IMU_FILTER_ALPHA) * pitchAcc;
    }
    yaw += g[2] * dt;
    if (yaw > 180) yaw -= 360;
    if (yaw < -180) yaw += 360;

    xSemaphoreTake(s_imuMutex, portMAX_DELAY);
    s_imuSample.ok = true;
    s_imuSample.tMs = millis();
    s_imuSample.ax = a[0]; s_imuSample.ay = a[1]; s_imuSample.az = a[2];
    s_imuSample.gx = g[0]; s_imuSample.gy = g[1]; s_imuSample.gz = g[2];
    s_imuSample.roll = roll; s_imuSample.pitch = pitch; s_imuSample.yaw = yaw;
    s_imuSample.tempC = tempC;
    xSemaphoreGive(s_imuMutex);

    if (logGetLevel() == LOG_DEBUG && millis() - lastDebugMs >= 1000) {
      lastDebugMs = millis();
      LOGD("IMU", "a %.2f %.2f %.2f g | g %.1f %.1f %.1f dps | roll %.1f pitch %.1f yaw %.1f", a[0], a[1], a[2], g[0], g[1], g[2],
           roll, pitch, yaw);
    }
  }
}

void imuGet(ImuSample *out) {
  if (!s_imuMutex) { memset(out, 0, sizeof(*out)); return; }
  xSemaphoreTake(s_imuMutex, portMAX_DELAY);
  *out = s_imuSample;
  xSemaphoreGive(s_imuMutex);
}

void imuZero() {
  s_imuZeroRequest = true;
  LOGI("IMU", "re-calibration requested: keep the vehicle still for %d s", IMU_CAL_SAMPLES / IMU_SAMPLE_HZ);
}

void imuSleep() {
  if (s_imuAddr) imuWrite(MPU_REG_PWR_MGMT_1, 0x40);
}
