# SeaGuardian – ESP32 firmware, Arduino framework (rev C)

Date: 2026-11-13. Firmware `1.0.0-arduino`. Hardware: ESP32 DevKit, L298N, SG90, MPU6050, NEO-6M.
The ESP32 connects **out** to the website's WebSocket server, receives JSON commands and sends JSON telemetry.

**Status in one line:** the firmware compiles and its control logic is unit-tested on a PC; it has **not** run on your
hardware, and Wi-Fi, the WebSocket link, the IMU and the GPS have not been exercised at all (section 13).

Labels: **[DS]** datasheet value quoted from memory, not re-read today; **[PROV]** provisional, to be replaced by a measurement.

---

## 0. Changes after the team review (14 Nov)

| # | Problem found | Fix |
|---|---|---|
| 1 | `WS_HOST` was a public internet address. The ESP32 has to reach the laptop on the same Wi-Fi | `WS_HOST` is now the laptop's LAN address, set in `Main/secrets.h` (the dashboard prints it at start-up) |
| 2 | Wi-Fi password was written in `Config.h`, which would be pushed to git | Wi-Fi name, password and `WS_HOST` moved to `Main/secrets.h` (git-ignored); `secrets.example.h` is the template |
| 3 | Race between the comm task and the safety task: a stop or emergency stop could be overwritten by a ramp step that was already computed, and during a latched emergency stop the pins were never written again (only the targets), so the motors could stay on | Every write to the L298N pins is now under one mutex, and the safety task re-writes the safe state every 20 ms while the emergency stop is latched |
| 4 | An MPU6050 that was not connected at boot was never looked for again | The IMU task keeps probing every 2 s, so a loose wire needs no restart |
| 5 | Wi-Fi retry every 5 s restarted a connection attempt that was still waiting for DHCP | Retry interval 15 s |
| 6 | `test_host/run_tests.sh` failed in `sh` (apostrophe inside `${...}`) | Fixed |

Not changed, but know about it: the OTA password is in `Config.h` and the WebSocket has no login, so on a shared Wi-Fi anyone could reflash or connect. Fine on a hotspot; think twice on a guest network.

## 1. Before you flash

1. Copy `Main/secrets.example.h` to `Main/secrets.h` and set `WIFI_SSID`, `WIFI_PASSWORD` (2.4 GHz only) and `WS_HOST`.
2. `WS_HOST` is the address the dashboard prints when started with `python run_operator.py --host 0.0.0.0`
   (`dashboard/README.md`). `WS_PORT` 8000 and `WS_PATH` `/ws` in `Config.h` already match the dashboard.
3. The network must allow devices to talk to each other. Some guest networks block that; a phone hotspot does not.

## 2. Architecture

```
            Wi-Fi "Armin - iphone"
 Website server  <────── WebSocket (ESP32 is the client) ──────>  ESP32
 (not part of this         commands  ───────────────────────►   CommHandler ─► CommandHandler ─► MotorControl ─► L298N ─► motors
  firmware)                telemetry ◄───────────────────────   Telemetry ◄─┬─ IMUHandler (MPU6050)      └─► ServoControl ─► SG90
                                                                            ├─ GPSHandler (NEO-6M)
                                                                            └─ SafetyHandler (e-stop, watchdog, arming)
```

| Task | Priority | Rate | Does | Why separate |
|---|---|---|---|---|
| `safety` | 4 (highest) | 50 Hz | Emergency stop, command watchdog, motor ramp, status LED | Must never wait on the network or a sensor |
| `imu` | 3 | 100 Hz | Reads the MPU6050, runs the attitude filter | Fixed timing for the filter |
| `gps` | 2 | 50 Hz | Feeds received bytes to TinyGPSPlus | Never blocks: only reads what has already arrived |
| `comm` | 2 | ~200 Hz | Wi-Fi supervision, WebSocket, telemetry, OTA | The WebSocket library may block for seconds while reconnecting |
| `logger` | 1 | – | Prints queued log messages | Printing must not delay any other task |
| `loop()` | 1 | 20 Hz | Health report, deep-sleep requests | – |

Shared data: IMU and GPS results are copied under a mutex; motor targets under a short critical section.
All WebSocket calls stay inside the `comm` task because the library is not thread-safe.

## 3. Files (open `Main/Main.ino`; the others appear as tabs)

| File | Responsibility |
|---|---|
| `Main.ino` | Start-up order, task creation, health report |
| `Config.h` | **Every setting**: Wi-Fi, server address, pins, PWM, limits, timeouts, log level |
| `Types.h` | Shared data structures and the list of every module's functions |
| `Logger.ino` | Levelled, time-stamped, non-blocking logging |
| `WiFiManager.ino` | Connect, monitor, reconnect, log |
| `CommHandler.ino` | WebSocket client: connect to the website, receive commands, send telemetry |
| `CommandHandler.ino` | Parse, validate and execute each JSON command |
| `MotorControl.ino` | L298N: direction pins, PWM on ENA/ENB, ramp, safe state |
| `ServoControl.ino` | SG90: 50 Hz PWM, angle limits, neutral |
| `IMUHandler.ino` | MPU6050: init, calibration, readings, roll/pitch/yaw |
| `GPSHandler.ino` | NEO-6M: NMEA parsing, fix status, fault detection |
| `Telemetry.ino` | Builds the telemetry JSON |
| `SafetyHandler.ino` | Arming, latched emergency stop, watchdog, link loss, battery (optional) |
| `OTAHandler.ino` | Wireless upload from the Arduino IDE |
| `PowerHandler.ino` | Deep sleep, wake button, reset-reason reporting |

Two files were added to your proposed list: `CommHandler.ino` / `CommandHandler.ino` (your list had no home for the
website link and command parsing) and `Types.h` (Arduino merges all `.ino` files, so shared types must live in a header).
Outside the sketch: `test_host/` (PC unit tests) and `tools/test_server.py` (stands in for the website during bench tests).

## 4. Pin assignment

| GPIO | Connects to | Notes |
|---|---|---|
| 25 | L298N **ENA** | PWM, left motor speed. **Remove the ENA jumper** on the module |
| 26 / 27 | L298N **IN1 / IN2** | Left motor direction |
| 33 | L298N **ENB** | PWM, right motor speed. **Remove the ENB jumper** |
| 32 / 13 | L298N **IN3 / IN4** | Right motor direction |
| 18 | SG90 signal (orange) | 50 Hz PWM |
| 21 / 22 | MPU6050 SDA / SCL | I2C, 400 kHz |
| 16 | NEO-6M **TX** | ESP32 receives (UART2 RX) |
| 17 | NEO-6M **RX** | ESP32 transmits (UART2 TX) |
| 14 | Wake button to GND | Wakes from deep sleep; uses the internal pull-up |
| 2 | On-board LED | Solid = armed, fast blink = emergency stop, slow blink = server connected |
| 34 | Battery divider (optional) | Only with `ENABLE_BATTERY_MONITOR 1` |
| GND | L298N GND, servo GND, MPU6050 GND, GPS GND, battery − | **One common ground** |

Why these pins: none is a boot-strapping pin (0, 2, 5, 12, 15 are avoided for outputs that must stay quiet at reset,
except the LED on 2), none is input-only (34–39) except the analog input, and 16/17 are the default UART2 pins.

## 5. Libraries and board package

| Install (Arduino IDE) | Name to search | Tested version |
|---|---|---|
| Boards Manager | **esp32** by Espressif Systems | 3.3.12 (needs 3.x: the PWM functions changed from 2.x) |
| Library Manager | **WebSockets** by Markus Sattler | 2.7.2 |
| Library Manager | **ArduinoJson** by Benoit Blanchon | 7.4.2 (needs 7.x) |
| Library Manager | **TinyGPSPlus** by Mikal Hart | 1.0.3 |

Steps: *File → Preferences → Additional boards manager URLs* →
`https://espressif.github.io/arduino-esp32/package_esp32_index.json`; then *Tools → Board → Boards Manager* → install "esp32";
then *Tools → Manage Libraries* → install the three libraries. `WiFi`, `Wire` and `ArduinoOTA` come with the board package.

The servo and the MPU6050 use no extra library: the servo is a plain 50 Hz PWM from the ESP32's LEDC peripheral, and the
MPU6050 is read through its registers directly (fewer dependencies, and the same register code was already written for rev B).

## 6. Build, flash, monitor

1. Keep the folder name `Main` (Arduino requires folder name = main file name). Open `Main/Main.ino`.
2. *Tools → Board* → **ESP32 Dev Module**. *Tools → Partition Scheme* → **Minimal SPIFFS (1.9MB APP with OTA)**.
   The sketch is 1.20 MB: 91 % of the default scheme, 61 % of this one.
3. Edit `Config.h` (section 1). Select the COM port. Click Upload. If it stalls at "Connecting…", hold the BOOT button.
4. *Tools → Serial Monitor*, **115200 baud**.

A healthy start looks like this. The first eight lines are taken from an emulator run of this firmware, except that the
emulator has no IMU, so there the IMU line read "not found"; the Wi-Fi and COMM lines are what the code prints and have not been observed yet:

```
[      455] INFO  MAIN    ==== SeaGuardian firmware 1.0.0-arduino ====
[      456] INFO  MAIN    last reset: power_on, free heap 259532 bytes
[      461] INFO  MOTOR   L298N ready: ENA=25 IN1=26 IN2=27 | ENB=33 IN3=32 IN4=13 | 2000 Hz, 8-bit, duty limit 255
[      462] INFO  SERVO   SG90 ready on GPIO18: neutral 90 deg, allowed 0..180 deg, pulse 500..2400 us
[      466] INFO  IMU     MPU6050 ready at 0x68: +/-4 g, +/-500 deg/s, 100 Hz. Keep still for 2 s (gyro calibration)
[      468] INFO  GPS     NEO-6M UART ready: 9600 baud, ESP32 RX=GPIO16 (from GPS TX), TX=GPIO17 (to GPS RX)
[      468] INFO  SAFETY  ready: watchdog 1000 ms, emergency stop = coast, battery monitor off
[      468] INFO  MAIN    init summary: motors=OK servo=OK imu=OK
            INFO  WIFI    connection attempt 1 to 'Armin - iphone'
            INFO  WIFI    connected: IP 172.20.10.x, gateway 172.20.10.1, RSSI -45 dBm
            INFO  COMM    connected to website server ws://<host>:<port><path>
```

**Log levels:** `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRIT`. Default is `INFO` (`LOG_DEFAULT_LEVEL` in `Config.h`). At `DEBUG`
you also get IMU readings once a second, every PWM change, every drive command and every 50th telemetry frame.
The level can be changed while running: `{"cmd":"log_level","value":"debug"}`. Messages go through a 48-entry queue;
if it overflows, messages are dropped and counted (`log drops` in the health line) instead of slowing the motors.
The firmware does not need the Serial Monitor to be connected.

**Wireless upload (OTA)** after the first USB upload: *Tools → Port* → network port `seaguardian at <ip>`, password
`seaguardian` (`OTA_PASSWORD`). The motors are stopped and disarmed during an update. If the network port does not
appear on the iPhone hotspot, upload by USB.

**Deep sleep:** `{"cmd":"sleep"}` (only when disarmed). Wake with the button on GPIO14. `IDLE_SLEEP_MINUTES` can add an
automatic sleep; it is off by default so the board does not fall asleep while you are still setting up the server.

## 7. Communication protocol

- The ESP32 opens `ws://WS_HOST:WS_PORT/WS_PATH` (or `wss://`). It reconnects every 2 s if the server is unreachable.
- Text frames, one JSON object each. Commands are limited to 256 bytes.
- On connect the ESP32 sends `{"type":"hello","device":"seaguardian","fw":"1.0.0-arduino","reset":"power_on"}`.
- Then telemetry every 100 ms (`TELEMETRY_INTERVAL_MS`).
- The message format is the rev B format given to the website developer, extended with GPS and emergency stop.

**What the website's server must do:** accept the ESP32's WebSocket connection, forward the browser's commands to it as
JSON text, and pass its telemetry on to the browser.

### 7.1 Rules for the website

1. **Arm first.** Movement is rejected until `{"cmd":"arm","value":true}`.
2. **Keep talking.** While armed, send a command at least every 1000 ms (`CMD_TIMEOUT_MS`); 5–10 times a second is
   recommended. `{"cmd":"ping"}` counts. Otherwise the watchdog stops the motors.
3. **Emergency stop is latched.** After `estop`, everything except `estop_reset`, `stop` and `ping` is rejected. After
   `estop_reset` the vehicle is still disarmed: send `arm` again.

### 7.2 Commands (website → ESP32)

| Purpose | Message | Limits |
|---|---|---|
| Arm / disarm | `{"cmd":"arm","value":true}` | boolean |
| Forward / backward / left / right | `{"cmd":"move","dir":"forward"}` | `forward`, `backward`, `left`, `right`; runs at the current speed until another command |
| Set speed | `{"cmd":"speed","value":0.7}` | 0.1–1.0 (`limit` is accepted as an alias) |
| Faster / slower | `{"cmd":"speed_up"}` / `{"cmd":"speed_down"}` | steps of 0.1 |
| Joystick drive | `{"cmd":"drive","throttle":0.6,"steer":-0.2}` | each −1…1; scaled by the speed setting |
| Each motor directly | `{"cmd":"motors","left":0.5,"right":-0.5}` | each −1…1 |
| Stop | `{"cmd":"stop"}` | always accepted; immediate |
| **Emergency stop** | `{"cmd":"estop"}` | always accepted; latched |
| Release emergency stop | `{"cmd":"estop_reset"}` | – |
| Servo angle | `{"cmd":"servo","angle":120}` | 0–180 (`SERVO_MIN_ANGLE`…`SERVO_MAX_ANGLE`) |
| Servo to neutral | `{"cmd":"servo_neutral"}` | 90° |
| Heartbeat | `{"cmd":"ping"}` | – |
| Re-calibrate IMU | `{"cmd":"imu_zero"}` | vehicle must be still |
| Deep sleep | `{"cmd":"sleep"}` | only when disarmed |
| Log level | `{"cmd":"log_level","value":"debug"}` | debug, info, warning, error, critical |

`move left/right` turns on the spot: the motors counter-rotate at speed × 0.6 (`MOTOR_TURN_RATIO`).

### 7.3 Replies (ESP32 → website)

- `{"type":"ack","cmd":"arm"}`
- `{"type":"error","cmd":"move","msg":"emergency stop active"}`

Errors are always sent. `drive`, `motors`, `move`, `servo` and `ping` are not acknowledged; their effect is in the telemetry.

### 7.4 Telemetry (ESP32 → website)

```json
{"type":"telemetry","seq":1532,"t_ms":153270,
 "imu":{"ok":true,"t_ms":153268,"ax":0.012,"ay":-0.004,"az":1.003,"gx":0.10,"gy":-0.05,"gz":0.02,
        "roll":-0.2,"pitch":0.7,"yaw":12.4,"yaw_relative":true,"temp":24.1,"errors":0},
 "gps":{"receiving":true,"fix":true,"lat":60.169857,"lon":24.938379,"alt_m":12.4,"speed_kmh":0.3,
        "course":181.0,"hdop":1.2,"sats":8,"age_ms":240,"utc":"2026-11-14T09:05:07Z"},
 "motors":{"armed":true,"left":0.50,"right":0.50,"limit":0.50},
 "servos":[90],
 "batt":{"v":null,"state":"disabled"},
 "sys":{"estop":false,"failsafe":false,"wifi":true,"rssi":-52,"ip":"172.20.10.5","reconnects":0,
        "server_reconnects":0,"heap":201234,"uptime_s":153,"reset":"power_on","fw":"1.0.0-arduino"}}
```

| Field | Unit / meaning |
|---|---|
| `t_ms`, `imu.t_ms` | milliseconds since the ESP32 started (time of the frame / of the IMU sample) |
| `imu.ax ay az` | g |
| `imu.gx gy gz` | degrees per second, bias removed |
| `imu.roll pitch` | degrees, gravity-referenced |
| `imu.yaw` | degrees, **relative and drifting** (no magnetometer); `yaw_relative` is always `true` |
| `gps.receiving` | NMEA data is arriving from the module |
| `gps.fix` | a valid position less than 3 s old |
| `gps.lat lon` | decimal degrees; `alt_m` metres; `speed_kmh`; `course` degrees; `sats` satellites in use |
| `gps.utc` | GPS date and time, ISO 8601 |
| `motors.left right` | commanded output −1…1 after the ramp; `limit` is the speed setting |
| `sys.estop` | emergency stop latched |
| `sys.failsafe` | watchdog stopped the motors |
| `sys.reset` | cause of the last restart (`brownout` = power problem) |

**A value that is not available is `null`**, never a made-up number: all IMU values when `imu.ok` is false, the position when
there is no fix, `utc` before the GPS knows the time. The website must handle `null`.

## 8. Emergency stop and watchdog

| Event | What the firmware does |
|---|---|
| `estop` received | Motors off in the same instant (not ramped), L298N in its safe state, flag latched, disarmed, logged as CRITICAL |
| While latched | `arm`, `move`, `drive`, `motors`, `servo` rejected; the safety task re-forces "off" every 20 ms |
| `estop_reset` | Latch released; still disarmed |
| No valid command for 1000 ms while armed | Motors stopped, `failsafe=true`; the next valid command clears the flag but does not restart the motors |
| WebSocket or Wi-Fi lost | Motors stopped and disarmed immediately |
| Safety task itself stalls for seconds | The ESP32's task watchdog resets the chip; after a reset the motors are off |
| Motor PWM cannot be set up at boot | Emergency stop is latched from the start |

Safe state (`ESTOP_BRAKE` in `Config.h`): `0` = coast (ENA/ENB low, the vehicle rolls or drifts to a stop),
`1` = short-brake (stops faster, stresses the L298N).

**Limits of a software emergency stop.** It only works while the ESP32 is running correct firmware, the L298N is
intact and (for the command) the link is up. It cannot remove power. It does not protect against a shorted driver
transistor, a frozen GPIO, or a wiring fault. Recommended hardware measures:

1. A **physical kill switch** (or arming plug) in the battery's positive lead, reachable by hand.
2. A **fuse** at the battery.
3. **10 kΩ pull-down resistors on ENA and ENB**, so the motors stay off while the ESP32 boots, resets or is being flashed
   (with the jumpers removed these inputs otherwise float).
4. Optionally a relay or MOSFET in the motor supply, held on by a signal that drops when the ESP32 resets.

## 9. Sensors

**MPU6050.** Start-up: detect at 0x68/0x69, wake the chip, low-pass filter 44 Hz, 100 Hz sampling, ±4 g, ±500 °/s.
Then 200 samples (2 s) are averaged as gyro bias: **the vehicle must be still**; if it moved, a warning is logged and
`imu_zero` repeats the calibration. Roll and pitch come from a complementary filter (98 % integrated gyro, 2 % gravity
direction). Assumed mounting: board flat, component side up, X forward. Repeated I2C failures set `imu.ok=false`, are
logged with a count, and trigger a re-initialisation every 2 s.

**NEO-6M.** UART2 at 9600 baud [PROV: the usual factory setting; verify]. Handled cases:

| Situation | Behaviour |
|---|---|
| No fix yet (cold start can take minutes, needs open sky) | `fix=false`, position `null`, satellites reported |
| Fix lost | `fix=false` after 3 s, WARNING logged |
| Corrupted NMEA sentence | Discarded by checksum, counted, WARNING logged |
| Module silent (unplugged, wrong pin, wrong baud) | `receiving=false`, ERROR logged every 5 s naming the pin and baud rate |

## 10. Electrical and power

| Item | Fact | Consequence |
|---|---|---|
| L298N current | 2 A continuous per channel [DS] | **If your motors' stall current is above 2 A the L298N will overheat or fail.** It has thermal shutdown but no current limit |
| L298N voltage drop | about 1.8 V at 1 A, more at higher current [DS] | On a 7.4 V pack the motors see roughly 5–5.5 V |
| L298N logic levels | HIGH from 2.3 V [DS] | 3.3 V GPIO is sufficient; no level shifter |
| L298N on-board 5 V regulator | needs about 7 V or more on the motor supply [PROV] | On a 2S pack it is marginal: **do not power the ESP32 from it** |
| PWM | 2 kHz, 8-bit | Suits the slow bipolar L298N; audible whine is normal |
| SG90 | 4.8–6 V, stall about 0.7 A [DS] | Needs its own 5 V supply path and a 470–1000 µF capacitor at the servo; **never the ESP32 3.3 V pin** |
| ESP32 GPIO | 3.3 V, **not 5 V tolerant** | – |
| MPU6050 (GY-521) | pull-ups to its own 3.3 V regulator | Safe on the ESP32; power it from 3V3 |
| NEO-6M (GY-NEO6MV2) | VCC 3.3–5 V, TX is 3.3 V logic | Safe on GPIO16 |
| Motor noise | Brushed motors radiate into I2C and GPS | 100 nF across each motor, short twisted motor leads, sensors away from the motors |

**Supply layout (recommended, provisional until the missing data arrives):**
battery → kill switch → fuse → L298N motor supply; battery → 5 V buck converter → ESP32 `VIN`, GPS, servo
(better: a second buck for the servo). One common ground, joined at the battery negative.

**Two LiPo batteries.** With two 3.7 V cells (what you described earlier) the assessment from rev B stands: in **series**
(7.4 V) for the motors, with 5 V made by buck converters; parallel (3.7 V) is too low for the L298N, which loses about 2 V.
Using one battery per subsystem only works if the logic battery feeds a boost or the 5 V is not needed. This is **not final**.

**Missing data needed to finish the power design:**

| # | Needed |
|---|---|
| 1 | Battery: voltage per pack, capacity, **C-rating / maximum discharge current**, protected or not, identical or not |
| 2 | Motors: rated voltage, running current, **stall current**, and how many per L298N channel |
| 3 | Which 5 V regulator(s) you have and their current rating |
| 4 | Whether the L298N module's ENA/ENB jumpers and 5 V regulator jumper are fitted |

## 11. Hardware test procedure (in order; stop at the first failure)

| Step | Test | Pass |
|---|---|---|
| 1 | ESP32 on USB only, nothing wired. Flash, open the Serial Monitor | Start-up lines as in section 6; `IMU … not found` and `GPS no data` errors are expected here |
| 2 | Wi-Fi | `WIFI connected: IP …`. Reason 201 = name wrong or hotspot not visible; reason 15/202 = password |
| 3 | Server link. On a laptop on the same hotspot: `pip install websockets`, `python tools/test_server.py`, put the laptop's IP in `WS_HOST` | Laptop shows `ESP32 connected` and a telemetry line every second |
| 4 | Wire the MPU6050. Reboot, keep it still | `MPU6050 ready`, `calibration done`; flat on the table `az ≈ 1.0`; tilting changes roll/pitch |
| 5 | Wire the GPS, antenna with sky view | `GPS … searching`, later `FIX acquired`. Indoors a fix may never come: `receiving=true` is the pass criterion |
| 6 | Servo on its 5 V supply, common ground. In the test server: `servo 45`, `servo 135`, `neutral` | Servo follows; `servo 200` is rejected; the ESP32 does not reset |
| 7 | L298N wired, **motors disconnected**, multimeter on OUT1/OUT2. `arm`, `f`, then `b` | Voltage appears, and reverses sign for `b` |
| 8 | Watchdog. `arm`, `f`, then `hb off` | Output drops to 0 V within about 1 s; log shows `WATCHDOG` |
| 9 | Emergency stop. `hb on`, `arm`, `f`, `estop`, then `f` | 0 V at once; `f` rejected; LED blinks fast. `reset`, `arm`, `f` works again |
| 10 | Link loss. `arm`, `f`, then close the test server | 0 V immediately; log shows `link … LOST while armed` |
| 11 | Motors connected, wheels/propellers free, current-limited supply or fuse fitted | Both directions; `f` moves forward (else set `MOTOR_LEFT_INVERT` / `MOTOR_RIGHT_INVERT`); L298N heatsink stays touchable |
| 12 | Brown-out check: full speed steps with the servo moving | `sys.reset` stays unchanged, `uptime_s` keeps counting |
| 13 | Deep sleep: `disarm`, `sleep`, then the wake button | Disconnects; after the button it reconnects with `reset: deep_sleep_wake` |
| 14 | OTA upload from the Arduino IDE | New version string in the `hello` message |
| 15 | Replace the test server with the real website | Same behaviour |

## 12. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| `WIFI attempt failed, reason 201` forever | SSID mismatch, 5 GHz-only hotspot | Exact name incl. apostrophe; *Maximize Compatibility* on |
| Wi-Fi connects, `COMM … not reachable` | Wrong `WS_HOST`/port/path, server not running, firewall, `ws` vs `wss` | Ping the host from another device on the hotspot; try `tools/test_server.py` |
| Server connects then drops every few seconds | Server does not answer WebSocket pings | Most servers do automatically; else raise `WS_PING_INTERVAL_MS` |
| Commands rejected with `not armed` | Website did not send `arm` | Section 7.1 |
| Motors run for a second then stop, `WATCHDOG` in the log | Website sends a command once instead of repeatedly | Send `ping` or the command 5–10 times a second |
| One motor turns the wrong way | Motor leads swapped | `MOTOR_LEFT_INVERT` / `MOTOR_RIGHT_INVERT` |
| Motors do not turn, driver gets hot | ENA/ENB jumpers still fitted, or motor current too high for the L298N | Remove jumpers; measure current |
| Motors hum but do not start at low speed | Voltage too low to overcome friction | Set `MOTOR_MIN_DUTY` (try 80) |
| ESP32 restarts when motors or servo move; `last reset: brownout` | 5 V rail dips | Separate supply for servo, bigger capacitor, thicker wires, common ground |
| `IMU … not found` | SDA/SCL swapped, no power | Wiring; 3V3 and GND at the module |
| IMU `errors` keeps counting | Motor noise on I2C, long wires | Shorter wires, 100 nF on motors |
| Roll/pitch sign wrong | Module mounted differently | Tell me the orientation; it is a sign change in `IMUHandler.ino` |
| `GPS no data from the module` | TX/RX swapped or wrong baud | GPS **TX** must go to GPIO16; module LED blinking = it has a fix |
| GPS `receiving` but never `fix` | Indoors | Go outside; first fix can take several minutes |
| Compile error about `ledcAttachChannel` | ESP32 board package 2.x | Update to 3.x in Boards Manager |
| "Sketch too big" | Small partition scheme | *Tools → Partition Scheme → Minimal SPIFFS* |
| Servo jitters or hits its end stop | Pulse range does not match this servo | Adjust `SERVO_MIN_US` / `SERVO_MAX_US`, narrow the angle limits |

## 13. What is implemented, assessed, simulated, tested

| Item | Implemented | Assessed (review / calculation) | Simulated | Physically tested |
|---|---|---|---|---|
| Compiles in the Arduino toolchain (ESP32 core 3.3.12, the libraries above), 0 warnings in project code | yes | – | – | **compiled: yes** |
| Start-up sequence, logger, motor and servo PWM setup, GPS UART setup, IMU-missing path | yes | yes | **emulator: yes** (firmware binary booted in QEMU up to Wi-Fi start) | no |
| Command validation, L298N direction/PWM logic, ramp, emergency stop latch, watchdog, link-loss, servo pulse widths, telemetry JSON | yes | yes | **PC unit tests: 79 pass** against the real source files, with stubbed hardware | no |
| Wi-Fi connect / reconnect on the iPhone hotspot | yes | yes | no (the emulator has no radio) | **no** |
| WebSocket client against a real server | yes | yes | no; only the test server was tried, with a simulated ESP32 | **no** |
| MPU6050 readings, calibration, filter | yes | register map and scale factors [DS] | no | **no** |
| NEO-6M parsing and fault handling | yes | yes | no | **no** |
| OTA upload | yes | yes | no | **no** |
| Deep sleep and wake | yes | yes | no | **no** |
| FreeRTOS timing under load, stack sizes | yes | stack sizes chosen with margin, not measured | no | **no** |
| Power design | – | provisional only; data missing (section 10) | – | **no** |

Problems found and fixed while verifying:

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | Review before testing | After a watchdog stop, a `speed` command would have restarted the last `move` | Speed changes are only re-applied to a move that is still running; covered by a test |
| 2 | Compiler (`-Wall`) | Deprecated `++` on shared counters; unused variable when the battery monitor is off | Corrected; 0 warnings |
| 3 | Mutation check | Wanted proof the tests can fail | Disabled the emergency-stop action and lengthened the watchdog in a copy: 6 tests failed as they should |
| 4 | Emulator | First emulator boot failed in flash start-up | Emulator limitation with the board's default flash mode; boots with DIO mode. Not relevant to real hardware |

## 14. Differences from the ESP-IDF firmware (rev B)

| | rev B (ESP-IDF) | rev C (this, Arduino) |
|---|---|---|
| Role | ESP32 hosts the web page and a WebSocket server | ESP32 is a WebSocket **client** of the website's server |
| Wi-Fi | Own access point, or join a network | Joins `Armin - iphone` only |
| Motor driver | 2× BTS7960 | L298N |
| Servos | 2 | 1 (SG90) |
| GPS | not in firmware | NEO-6M |
| Emergency stop | `stop` + disarm | latched `estop` / `estop_reset` |
| OTA | upload in the browser | from the Arduino IDE |
