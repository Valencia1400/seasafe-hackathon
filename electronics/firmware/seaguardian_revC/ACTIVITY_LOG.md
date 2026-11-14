# SeaGuardian – electronics activity log

Maintained by Claude (AI assistant) for the Electrical & Embedded Systems Lead. Newest session at the bottom.

## Session 1 – Fri 2026-11-13, 13:04 CET – circuit design (KiCad + Wokwi, with motor driver)

**Request:** design the circuit diagram, include a motor driver, deliver it in both KiCad and Wokwi.

| # | Activity | Result |
|---|---|---|
| 1 | Read the project file `USV Harbour Inspector – Electronics BOM.xlsx` (sheets `BOM`, `ESP32 pin map`). | Found a complete parts list and a 20-row GPIO map. Decision: follow it exactly instead of inventing a new pin map. |
| 2 | Chose the motor driver. | BTS7960 (IBT-2) module, one per motor, as specified in the BOM (L298N rejected there for voltage drop and heat). |
| 3 | Tried to install KiCad for validation. | First attempt failed (package index stale). After `apt-get update`, KiCad 7.0.11 installed; gives netlist/PDF export but no command-line ERC (that arrived in KiCad 8). |
| 4 | Wrote `tools/design.py`: one data structure holding every component, pin, net and position. | 42 components, 36 nets. KiCad output and all checks are generated from this single source so they cannot drift apart. |
| 5 | Wrote `tools/gen_kicad.py`: generates `seaguardian.kicad_sch`, the symbol library `SeaGuardian.kicad_sym`, `sym-lib-table` and `.kicad_pro`. | Custom module-level symbols (ESP32 DevKit, BTS7960 module, buck, UBEC, sensors) because the stock KiCad libraries have no symbols for breakout modules. Nets joined by labels. |
| 6 | Exported PDF and inspected the rendered sheet. | Found overlapping net labels (F1/SW1, R1/R2, R4/R5). Moved the parts apart, regenerated, re-inspected: clean. |
| 7 | Review of logic levels on the motor driver. | **Problem found:** BOM note says "BTS7960 inputs accept 3.3 V logic". True for the chip, but the module routes inputs through a 74HC244 buffer powered from VCC; at 5 V its guaranteed-HIGH level is about 3.5 V. **Correction:** module VCC wired to +3V3. Confirmed by web search that the module carries a 74HC244. |
| 8 | Added deep-sleep wake hardware. | Wake button SW2 on GPIO14 (RTC pin, free, not a strapping pin) with 10k pull-up R11. R3 (10k pull-down on MOTOR_EN) also keeps the drivers off while the ESP32 sleeps or reboots after OTA. |
| 9 | Added C4 100 nF on the battery-sense node. | High-impedance divider needs a reservoir for the ADC sample capacitor. |
| 10 | Left out INA226 and inspection light. | INA226 breakout shunt is too small for the motor current path; light has no pin in the BOM. Both are "Nice" priority. Documented, not silently dropped. |
| 11 | Wrote `tools/verify.py` and ran it. | (1) KiCad-exported netlist equals intended design: 36 nets, 140 pin connections. (2) All 20 DevKit GPIO rows of the BOM pin map found on the right component pins. Only addition beyond the BOM: GPIO14 WAKE_BTN. |
| 12 | Built the Wokwi project: `diagram.json` (22 parts, 61 wires). | Stand-ins where Wokwi has no part: MPU6050 for BNO055, HC-SR04 for JSN-SR04T, potentiometers for battery divider and leak probes, LEDs for motors. GPS, BME280, ESP32-CAM, iBUS not simulated. |
| 13 | Wrote a Wokwi custom chip (`bts7960.chip.json`, `bts7960.chip.c`) because Wokwi has no BTS7960. | Logic model: outputs follow RPWM/LPWM only while both enables are HIGH. Checked the API calls (`pin_init`, `pin_watch`, `pin_watch_config_t`) against the Wokwi chips-API documentation. |
| 14 | Checked Wokwi part names against documentation. | **Problem found:** I had used part type `board-ds18b20`; the documented type is `wokwi-ds18b20`. Corrected. |
| 15 | Wrote `wokwi/main.c`, an ESP-IDF v5 bring-up test (LEDC PWM for motors and servos, ADC, buzzer, LED, wake button). | Exercises every simulated connection. Not the mission firmware. |
| 16 | Extended `verify.py` to check `diagram.json` against the pin map; ran all checks. | 18 GPIO nets checked in Wokwi. All checks passed. |
| 17 | Wrote `README.md`, exported `SeaGuardian_schematic.pdf`, packaged everything. | Delivered as `SeaGuardian_circuit_revA.zip` plus the PDF. |

### Verified
- Schematic file loads and exports in KiCad 7.0.11; netlist matches the design; pin map matches the team BOM.
- Wokwi wiring matches the pin map (static check of the JSON).

### NOT verified (open items)
- The Wokwi simulation has not been run and `main.c` has not been compiled: no simulator or ESP-IDF toolchain in the environment used. First run in Wokwi is the test.
- Wokwi pin names for stock parts other than the DS18B20 are from memory of the documentation, not re-checked.
- KiCad ERC has not been run (needs the GUI or KiCad 8+).
- Nothing has been tested on hardware. Motor stall current is still unknown, so the 15 A fuse value is provisional.
- iBUS signal level of the RC receiver is unconfirmed; measure before connecting to GPIO36.

### Next steps
1. Run the Wokwi project; report any compile or wiring errors.
2. Mission firmware in ESP-IDF: Wi-Fi + MQTT telemetry, OTA with two app partitions and rollback, deep sleep with GPIO14 wake.

## Session 2 – Fri 2026-11-13, 13:31–13:40 CET – getting the Wokwi project running

| # | Activity | Result |
|---|---|---|
| 1 | User asked how to import the Wokwi files and whether a paid plan is needed. | Checked Wokwi pricing: free Community plan is enough (projects are public). Gave paste-in steps: create custom chip `bts7960` first, then `diagram.json`, then `main.c`. |
| 2 | **Problem reported by user (first real build):** linker error `multiple definition of 'app_main'` between `/core/core.a(main.cpp.o)` (Arduino ESP32 core 3.3.12) and `/sketch/main.c:75`. | **Cause:** the Wokwi project is being built with the Arduino ESP32 core, which already defines `app_main()` and calls `setup()`/`loop()`. Our `main.c` defines a second one. Not a fault in the circuit or the driver code. |
| 3 | **Correction offered (two options).** | (A) Quick: rename our entry point to `seaguardian_main()` and call it from `setup()` in `sketch.ino`; all other code stays pure ESP-IDF API (the Arduino core is built on ESP-IDF). (B) Clean: recreate the project from Wokwi's ESP32 "Advanced templates -> ESP-IDF" and paste the files again. |
| 4 | User reported no `sketch.ino` tab exists (13:39). | Gave two paths: (1) new project from the ESP-IDF template, (2) add `sketch.ino` by hand and rename the entry point in `main.c`. |
| 5 | **Second build error (13:48):** `multiple definition of 'app_main'` still present, plus `undefined reference to 'seaguardian_main'` from `sketch.ino`. | **Cause:** `sketch.ino` was added but `main.c` line 75 still says `app_main`; both errors are the same missing rename. **Correction:** change line 75 to `void seaguardian_main(void) {`. |
| 6 | **Build succeeded, simulation runs (14:00).** User pasted serial output: repeating `Motors: enable, ramp forward / ramp reverse / disabled`, `Servos: sweep`, `ADC raw: vbat=0 leak1=0 leak2=0`, `wake button=released`. | Confirms: `main.c` compiles against the Arduino-core ESP-IDF (core 3.3.12), LEDC/GPIO/ADC init does not crash, main loop cycles, GPIO14 reads HIGH with the button released (pull-up works). ADC = 0 is expected: the three Wokwi potentiometers start at their minimum position. |

### Lesson for the presentation
AI-written instructions assumed the project would build as native ESP-IDF; the first real build showed it was an Arduino-core build. Caught in minutes because the bring-up test was run before any hardware was wired.

### Still open (visual checks in the Wokwi diagram, serial text cannot prove these)
- Green M1/M2 FWD LEDs brighten during "ramp forward", red REV LEDs during "ramp reverse", all off when disabled (proves the custom BTS7960 chip and the enable line).
- Both servo horns sweep.
- Turning each potentiometer changes vbat / leak1 / leak2 (proves the three ADC nets).
- Pressing the WAKE button prints `PRESSED`.
- Buzzer beeps and STATUS LED toggles once per cycle.

## Session 3 – Fri 2026-11-13, 14:17–14:55 CET – rev B: power design, wiring diagram, ESP-IDF firmware, web control

**Request:** requirements document (attached text file): practical wiring visualisation, battery calculations for two LiPo cells,
modular ESP-IDF firmware with two-way web communication, website, validation plan with honest tested/untested status.

| # | Activity | Result |
|---|---|---|
| 1 | Read the requirements file. Asked four questions before building, because the answers change the design. | Answers: IMU = **MPU6050**; batteries = **two 3.7 V cells, ~1800 or 2200 mAh**; **no motor measurements**; **ESP32 hosts the web page**. |
| 2 | Design consequences worked out. | Two 1S cells → must be in **series (2S, 7.4 V)**. 6 V servo UBEC no longer has headroom → servo rail changed to **5 V from its own 5 A buck**. BNO055 → MPU6050 (no magnetometer, so yaw is relative). Battery thresholds made per-cell. MQTT broker dropped in favour of a WebSocket served by the ESP32. |
| 3 | Installed a real ESP-IDF toolchain to compile instead of guessing: cloned ESP-IDF v5.5.6, installed the xtensa compiler. | Problems: one submodule clone failed (HTTP 503) and was retried; the Python constraints file on dl.espressif.com is blocked here, so packages were installed straight from PyPI. Toolchain works. |
| 4 | Wrote the firmware: 11 C modules + `board.h` + embedded `index.html` (about 1,700 lines). | Modules: wifi_mgr, web_server, ota_update, command, motors, servos, imu, safety, telemetry, power_mgmt, app_main. Configuration through `idf.py menuconfig` (menu "SeaGuardian"). |
| 5 | First build. | Passed, 0 warnings, 882 kB (14 % of the 1 MB OTA slot free). |
| 6 | Enabled size optimisation for more OTA headroom and rebuilt from clean. | **Problem found:** build error in `imu.c` ("may be used uninitialized"), visible only at `-Os`. **Fixed.** Now 826 kB, 21 % free, 0 warnings. |
| 7 | Wrote `tools/power_budget.py` and ran it. | 2S 7.4 V. Idle 0.53 A, cruise 4.53 A, worst-case peak 21.2 A (provisional motor data: 2 A cruise, 8 A stall each). Runtime 19 min (1800 mAh) / 23 min (2200 mAh). Cells need about 5 C continuous, 15 C burst. |
| 8 | Wrote `tools/wiring_diagram.py`, rendered and inspected the diagram, twice. | First render had a ground wire drawn through the MPU6050 box, overlapping labels and a servo wire on a box edge; corrected and re-rendered. Output: `SeaGuardian_wiring_diagram.pdf/.png`. |
| 9 | Host unit tests for the command parser and servo limits (`test_host/`), compiling the real `command.c` and `servos.c` against stubs. | **46 passed, 0 failed** (malformed JSON, missing/extra fields, out-of-range values, infinity, unarmed motion, mixing, limits, servo ranges). |
| 10 | Booted the real firmware binary in Espressif's QEMU ESP32 emulator. | Motors, servos and the "IMU missing" path start correctly; it then stops at Wi-Fi start because the emulator has no radio (expected). |
| 11 | Added an emulator-only build variant (`sdkconfig.qemu`, `net_qemu_eth.c`): emulated Ethernet in place of Wi-Fi, so the web server, WebSocket, safety and OTA code can run. | **Problem found:** hang in the first ADC read: the emulator has no ADC. Test build now returns 0 for ADC reads. Consequence: battery/ADC code is NOT tested. |
| 12 | Wrote `test_qemu/test_integration.py`: a client that behaves like the browser (HTTP + WebSocket + OTA upload). First full run. | 17 checks passed, then **problem found:** the "OTA refused while armed" reply never reached the client (connection reset because the upload body was unread). **Fixed** by draining the body before replying. |
| 13 | Second run. | **Problem found:** a non-firmware file got HTTP 500 instead of 400. **Fixed.** **Problem found:** after a valid OTA the device entered a crash loop on reboot (crash in system start-up, before `app_main`); the bootloader rolled back to the factory image, which looped as well. The restart had been issued from inside an `esp_timer` callback. **Fixed** by running restart and sleep from a dedicated short task. |
| 14 | Third run. | **25 passed, 0 failed**: page served; telemetry complete at 10.0 Hz; unarmed drive refused; garbage rejected; slew limit (steps of 0.2 per 100 ms); failsafe stops motors 0.9–1.0 s after the last command; heartbeat clears failsafe; stop; link loss disarms; oversized frame handled; OTA refuse/reject/accept; reboot into `ota_0`; "new firmware confirmed, rollback cancelled"; sleep acknowledged. Deep-sleep entry reaches `esp_deep_sleep_start()`, where the emulator stops (no RTC model). |
| 15 | Rebuilt the real (Wi-Fi) firmware from the final sources; re-ran host tests. | Build OK, 0 warnings, 826 kB. 46/46. Prebuilt binaries copied to `firmware/prebuilt/`. |
| 16 | Updated the KiCad schematic to **rev B** (2S battery, MPU6050, 5 V servo buck) and re-ran `verify.py`. | Netlist matches design (36 nets, 140 connections); BOM pin map still satisfied. |
| 17 | Wrote `docs/ENGINEERING_REPORT.md` (architecture, connection list, calculations, missing data, protocol, status matrix, 15-step hardware validation procedure) and `README.md`. | Saved to the project as `claude/engineering-report-revB.md`. |

### Verified in this session
- Firmware compiles with ESP-IDF v5.5.6 for ESP32, zero warnings.
- Command validation: 46 host unit tests.
- Web server, WebSocket telemetry and commands, arming, slew limit, failsafe, link-loss disarm, stop, OTA (refuse, reject, accept, reboot, confirm): 25 end-to-end checks **in the emulator**.

### NOT verified (open items)
- **Nothing has run on real hardware.**
- Wi-Fi (access point, join, reconnect, fallback): compiled only; the emulator has no radio.
- MPU6050 readings and attitude filter: only the "sensor missing" path ran.
- ADC: battery voltage, low-voltage cut-off, leak inputs.
- Real PWM waveforms on the pins; real deep sleep and button wake.
- The control page has not been opened in a browser against the firmware (script syntax-checked; protocol exercised by a Python client instead).
- Whether the OTA-reboot crash of item 13 would also have happened on real hardware (the fix is in either way).
- All power figures rest on provisional motor data and on unknown cell ratings.

### Decisions that supersede rev A
- Battery: 3S → two 1S cells in series (2S). Servo supply: 6 V UBEC → 5 V buck (5 A). IMU: BNO055 → MPU6050. Link: MQTT broker → WebSocket on the ESP32.
- `claude/circuit-design-revA.md` is kept for history; where it disagrees with `claude/engineering-report-revB.md`, rev B applies.

### Blocking questions for the team
1. Cell type: C-rating / maximum continuous current, protected or not, and are the two cells identical?
2. Motor stall and running current at 7.4 V.

### Next steps
1. Flash `prebuilt/` (or build), run validation steps 1–5 of the report on the bench.
2. Report results, especially `Last reset`, IMU signs and the battery reading.

## Session 4 – Fri 2026-11-13, 15:00 CET – hand-over explanation

| # | Activity | Result |
|---|---|---|
| 1 | User asked for a full explanation in chat: every file and folder delivered, how to run the firmware on the ESP32, and the ESP32-to-website protocol for the teammate designing the website. | Explained the rev B package folder by folder, the two ways to get firmware onto the board (prebuilt binaries with esptool, or building with ESP-IDF v5.5.x), and the WebSocket/JSON protocol. No files changed. |
| 2 | Added two integration constraints for the website designer that the report did not spell out. | (a) A page served over `https://` cannot open the boat's `ws://` socket (browser mixed-content rule): serve the page over plain http, from a local file, or embed it in the firmware. (b) The `/ota` upload sends no CORS headers, so it works from the boat's own page (or curl), not from a page on another origin. |

## Session 5 – Fri 2026-11-13, 22:24–22:50 CET – rev C: Arduino firmware for L298N / SG90 / MPU6050 / NEO-6M

**Request:** new requirements document: Arduino framework (C++), multiple `.ino` files, L298N, SG90, MPU6050, NEO-6M,
Wi-Fi `Armin - iphone`, external website (not ours), emergency stop, watchdog, detailed logging.

| # | Activity | Result |
|---|---|---|
| 1 | Read the document. Found section 4 (the communication protocol) empty, and conflicts with the project brief (ESP-IDF, OTA, sleep) and with rev B (BTS7960, ESP32 as server). Asked three questions. | Answers: **the ESP32 connects out to the website's server**; **keep the rev B JSON format**; **include OTA and deep sleep**. The server address was not given, so it is a placeholder in `Config.h`. |
| 2 | Set up a real Arduino build: arduino-cli 1.3.1 + ESP32 core 3.3.12 + WebSockets 2.7.3, ArduinoJson 7.4.2, TinyGPSPlus 1.1.0. | Problems: Arduino's main package index is unreachable here, and the ESP32 core depends on a tool listed only there. Worked around with stub indexes, a local copy of the ESP32 index without that tool, and the Arduino prototype generator (ctags) built from source. A two-file test sketch using all three libraries compiled. |
| 3 | Design decisions. | L298N pins: ENA 25, IN1 26, IN2 27, ENB 33, IN3 32, IN4 13. Servo 18, I2C 21/22, GPS 16/17, wake 14. PWM 2 kHz 8-bit for the L298N. Servo by LEDC (no library). MPU6050 by direct registers (no library). Five tasks + `loop()`. All WebSocket calls in one task. Arming kept from rev B. Missing values sent as `null`. |
| 4 | Wrote the sketch: `Main.ino`, `Config.h`, `Types.h` and 12 module `.ino` files. | Added `CommHandler.ino`, `CommandHandler.ino`, `OTAHandler.ino`, `PowerHandler.ino` and `Types.h` to the file list proposed in the document. |
| 5 | **Problem found in review, before any test:** after a watchdog stop, a `speed` command would have re-applied the last `move` and restarted the motors. | **Fixed:** speed changes are re-applied only while a move is still running. A unit test now covers it. |
| 6 | First compile with `--warnings all`. | Passed. 5 warnings in project code (deprecated `++` on volatile counters, one unused variable). **Fixed**, 0 warnings. Size 1.20 MB = 91 % of the default partition; 61 % with "Minimal SPIFFS". |
| 7 | Compiled a second variant with every optional switch flipped (TLS on, battery monitor on, brake mode, idle sleep, OTA off). | Passed, 0 warnings. |
| 8 | PC unit tests (`test_host/`): the real `MotorControl.ino`, `ServoControl.ino`, `SafetyHandler.ino`, `CommandHandler.ino`, `Telemetry.ino` compiled against stub hardware with a simulated clock. | **79 passed, 0 failed.** Covers malformed input, arming, L298N pin states and duty for every direction, ramp, no shoot-through during reversal, speed commands, watchdog timing (running at 900 ms, stopped at 1100 ms), invalid commands not feeding the watchdog, emergency-stop latch and priority, link loss, servo pulse widths, telemetry JSON validity with missing sensors and with worst-case values (726 bytes in a 1100-byte buffer). |
| 9 | Mutation check: in a copy, removed the emergency-stop action and set the watchdog to 3 s. | 6 tests failed, as they should: the tests are able to detect a broken safety path. |
| 10 | Wrote `tools/test_server.py` (stands in for the website's server for bench tests) and tried it with a simulated ESP32. | Commands, heartbeat and telemetry display work. |
| 11 | Booted the compiled Arduino firmware in the QEMU ESP32 emulator. | First attempt failed in flash start-up (emulator does not support the board's default flash mode). With DIO mode: logger, motor PWM, servo PWM, GPS UART and safety all start; the missing-IMU path is handled; execution stops at Wi-Fi start (no radio in the emulator, expected). |
| 12 | Added task-watchdog supervision of the safety task (ESP32 resets if that task stalls). Re-ran compile, tests and emulator boot. | All pass. |
| 13 | Wrote `README.md`: architecture, files, pins, libraries, build/flash, logging, protocol, emergency stop and its limits, sensors, electrical notes, 15-step test procedure, troubleshooting, status table. | Saved to the project as `claude/arduino-firmware-revC.md`. |

### Verified
- Compiles with ESP32 Arduino core 3.3.12 (same core version your Wokwi build used), 0 warnings in project code, two configurations.
- Control and safety logic: 79 PC unit tests on the real source files; mutation check confirms they can fail.
- Start-up up to Wi-Fi in the emulator.

### NOT verified
- **Nothing has run on the real hardware.**
- Wi-Fi on the iPhone hotspot, the WebSocket client against any real server, OTA, deep sleep/wake: compiled only.
- MPU6050 and NEO-6M: no data has passed through the drivers (only the "sensor missing" start-up path ran).
- Real-time behaviour and stack usage of the tasks.
- The website's server address, and whether its server accepts the ESP32's connection: unknown.
- L298N suitability: it is limited to 2 A per channel; motor stall current is still unmeasured.

### Open questions for the team
1. WebSocket server address (host, port, path, `ws` or `wss`).
2. Exact hotspot name (the SSID must match character for character).
3. Battery and motor data (section 10 of the README).

### Note on revisions
- rev B (ESP-IDF, BTS7960, ESP32 hosts the page) and rev C (Arduino, L298N, ESP32 is a client) are alternatives for different hardware; the JSON command/telemetry format is shared.
