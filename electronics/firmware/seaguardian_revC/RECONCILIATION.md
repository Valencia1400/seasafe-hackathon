# Firmware reconciliation: electronics package (revD) vs GitHub

Date: 14 November 2026. From: Heritage (Electrical & Embedded Systems Lead), prepared with Claude.
Compared: `SeaGuardian_revD.zip` `arduino/` against GitHub `electronics/firmware/seaguardian_revC/` and `dashboard/` at commit `a86eb17`. GitHub `main` was still at `a86eb17` when checked (14 Nov, 17:30).

**Summary.** For the firmware source, GitHub is the current version and nothing in it should be replaced by the package. The package's `Main/` was the original 13 Nov code plus three setting changes; it lacks the GitHub fixes. The proposed change set (`reconciliation.patch`) is small: it keeps every GitHub fix and adds the battery documentation, corrected README text, a wiring reference and the activity log.

Evidence words used below: **source review** (read and compared the code), **compiled** (arduino-cli, ESP32 core 3.3.12, all warnings on, 0 warnings in project code), **host test** (79 PC unit tests, single-threaded, stubbed hardware), **physical** (seen on a real board, with who and when).

## Response table

| Item | Current source | Final decision | Files / changes | Verification evidence | Still unverified |
|---|---|---|---|---|---|
| 1. Emergency-stop code | GitHub | Keep GitHub's fix unchanged: recursive motor-output mutex around every pin write, and `motorsSafeState()` every 20 ms while latched. The package README claimed the 20 ms re-write but its code only set the targets to zero; that claim was wrong for the package code and is correct for GitHub's | None to the code. README section 8 now describes it exactly | Source review: the race is real (the safety task computed a ramp step, left the critical section, then wrote pins; a stop from the comm task in between was overwritten). The mutex closes it; lock order is always mutex then spinlock, so no deadlock. Compiled. Host tests 79/79 | Concurrent behaviour on the real board. Host tests are single-threaded and cannot show it. Needs a bench test: repeated `estop` during a ramp with a meter or LED on the L298N output |
| 2. WebSocket port and host | GitHub | `ws://<laptop LAN address>:8000/ws`, plain WebSocket, no TLS. Port 5000 in the package was a bench setting for `test_server.py` and is dropped | None. `test_server.py` keeps GitHub's default 8080 so it cannot be confused with the dashboard | Source review: the dashboard is a standard-library WebSocket server that answers pings; it ignores the `arduino` sub-protocol header the ESP32 library sends, which the library accepts. Physical: team test 14 Nov (item 10) | The merged build against the dashboard on the demo network |
| 3. Credentials location | GitHub | `secrets.h` (git-ignored) holds Wi-Fi name, password and `WS_HOST`; `secrets.example.h` is the template | None. README section 1 is GitHub's | Source review; compiled with `secrets.example.h` copied to `secrets.h` | – |
| 4. Battery cell count | Package for the value, GitHub for the structure | `BATT_CELLS 3`, marked as assumed. `ENABLE_BATTERY_MONITOR` stays 0: the firmware does not measure or protect the battery | `Main/Config.h`: value and comments | Compiled. The value has no effect while monitoring is off. If monitoring is ever enabled, 3 is the safe side: too high refuses to arm, too low never cuts off | The pack itself (item 5). The ADC path has never run on hardware |
| 5. Actual battery wiring | Neither | Series (3S) is an assumption until Heritage confirms it on the bench. All documents now say "assumed" and all runtimes "estimated" | README section 10; new `electronics/POWER_BUDGET_3S.md` rev E | Calculation only | Series or parallel; cell ratings; identical cells; regulator fitted |
| 6. IMU recovery | GitHub | Keep: the IMU task always starts and probes every 2 s when the sensor is missing | None | Source review: correct, and it clears the address when configuration fails so the probe repeats. Compiled | Unplug and re-plug on the real board |
| 7. Network and motor tuning | GitHub | Keep 15 s Wi-Fi retry, slew 1.0/s, pong timeout 3 s, 4 failures. The package values (5 s, 2.0/s, 2 s, 2) were design defaults, never tested on hardware. `CMD_TIMEOUT_MS 1000` is unchanged and independent: motors stop 1 s after the last valid command whatever the WebSocket heartbeat does | None | Source review. GitHub's comments say the slower ramp and longer retry came from behaviour seen on the board; I have no record of that test (see questions) | Which of these were tested on the assembled hardware, and by whom |
| 8. Rudder limits | Neither | Until the linkage travel is measured: the dashboard's 90 ± 6 degrees is the working limit and the firmware's 0–180 is only a sanity check. After measuring, set `SERVO_MIN_ANGLE` / `SERVO_MAX_ANGLE` to the measured travel so the firmware is the hard limit | README test step 6 changed from 45/135 to 84/96. No code change yet. If the firmware limits change, host tests at `test_logic.cpp` lines 152–155 must change with them | Source review | Safe mechanical travel of the installed linkage |
| 9. Steering behaviour | GitHub code, documentation corrected | As implemented: `move left/right` counter-rotates the two motor channels; `drive.steer` mixes them; the rudder moves only on `servo` commands. Nothing links rudder and motors. With one propulsion motor (decision D-007) use `servo` for steering and `move forward/backward` for propulsion, as the dashboard does | README section 7.2 rewritten. No code change. Optional later: reject `move left/right` when one motor is configured | Source review of `CommandHandler.ino` and `boatlink.py` | How many motors are fitted. D-007 says one; the firmware and pin table describe two |
| 10. Physical WebSocket test | Both reports are true; they are different tests | See "Item 10" below | README section 13 | – | The merged build has not been flashed or tested by anyone |
| 11. Historical drawings | Neither | Rev B drawings are not added to GitHub. New text reference `electronics/wiring/WIRING_revC.md` is the current wiring | New file | Pin numbers checked against `Config.h` | No drawing of the current wiring exists. Power wiring untested |
| 12. Emergency-stop documentation | GitHub code, documentation corrected | Keep the implementation; document it exactly. Rejected while latched: `arm` (true), `move`, `drive`, `motors`, `servo`, `servo_neutral`. Still accepted: `estop`, `estop_reset`, `stop`, `ping`, `disarm`, speed settings, `imu_zero`, `log_level`, `sleep` | README sections 7.1 and 8 | Source review; host tests cover the rejected commands | – |

## Item 10: the two tests

| | Test A | Test B |
|---|---|---|
| Result | Did not connect | Connected, live attitude on the dashboard |
| When | 13 Nov 23:48 to 14 Nov 00:50 | 14 Nov, recorded in commit `703dfe1` (12:23) and `dashboard/README.md` |
| Operator | Heritage | Not recorded in the repository (commit author: Armin) |
| Board | Heritage's ESP32 DevKit with MPU6050 and NEO-6M | "Real ESP32 DevKit + MPU6050"; which physical board is not recorded |
| Firmware | Original package `1.0.0-arduino` (13 Nov, without the GitHub fixes), Arduino core 3.3.7 | GitHub `seaguardian_revC` at that time |
| Server | `tools/test_server.py` on Heritage's Windows laptop, ports 8080 and 5000 | `dashboard/run_operator.py`, port 8000 |
| Network | Home Wi-Fi | Not recorded |
| Assessment | Wi-Fi, ping and the server were all up; inbound connections to the laptop were most likely blocked by Windows Firewall. Never confirmed | Shows the firmware's WebSocket client works against the dashboard |

Test B is the relevant one for the integrated system. Neither test used the merged build proposed here.

## Which firmware is on the control ESP32 now

Not known from here; Heritage must confirm. Both the original package and the GitHub version report `1.0.0-arduino`, so the version string cannot tell them apart. The proposed build reports `1.1.0-arduino` in the boot banner and in the `hello` message, so after flashing it the question answers itself.

## Power-budget corrections (all accepted)

| Review point | Response |
|---|---|
| L298N is not a current limiter | Correct. Claim removed. Peak battery current is stated as unknown until the motor stall current is measured |
| Motor, battery rating, regulator, fuse unconfirmed | Listed as open in `POWER_BUDGET_3S.md` section 6. Fuse stays "provisional" |
| Camera ESP32 missing | Added as an optional load (0.20 A at 5 V, provisional) |
| PWM duty values are not protection | Stated explicitly |
| GPS | README now says: reception seen once, then lost; stable reception and a fix are not demonstrated |
| Additional error found while checking the datasheet | Rev D gave the L298 drop near 2 A as about 2.8 V. The datasheet gives 3.7 V typical and 4.9 V maximum, so heat at 2 A is 7.4–9.8 W per channel. Corrected |

One further conflict found: `electronics/README.md` says "no loose LiPo cells", and the proposed pack is three loose LiPo cells. This needs a team decision.

## Proposed change set (`reconciliation.patch`, against `a86eb17`)

| File | Change |
|---|---|
| `electronics/firmware/seaguardian_revC/Main/Config.h` | `BATT_CELLS 3`; `MOTOR_MAX_DUTY 110` (5 V motors on 3S); version `1.1.0-arduino`. Nothing else |
| `electronics/firmware/seaguardian_revC/test_host/run_tests.sh` | Passes `-DMOTOR_MAX_DUTY=255` so the tests keep their expected duty values |
| `electronics/firmware/seaguardian_revC/README.md` | Status, steering, emergency-stop list, battery paragraph, servo test step, tested table |
| `electronics/firmware/seaguardian_revC/ACTIVITY_LOG.md` | Sessions 6–10 added; evidence index separating rev B emulator results from rev C hardware results |
| `electronics/firmware/seaguardian_revC/tools/power_budget_3s.py` | New |
| `electronics/firmware/seaguardian_revC/RECONCILIATION.md` | This document |
| `electronics/POWER_BUDGET_3S.md` | New (rev E) |
| `electronics/wiring/WIRING_revC.md` | New |

No `.ino` file is changed. Verification of the patched tree: compiled, 1,200,470 bytes (61 % of the Minimal SPIFFS slot); host tests 79 passed, 0 failed.

> **Repository status (added when this document was committed, 14 Nov):** only this document and the updated `ACTIVITY_LOG.md` are in the repository so far. The other files in the table above (`Config.h`, `run_tests.sh`, README text, `power_budget_3s.py`, `POWER_BUDGET_3S.md`, `WIRING_revC.md`) come from `reconciliation.patch`, which has not been applied here. Until it is, `Config.h` on GitHub still has the earlier values.

## Answers from Heritage (14 Nov, 17:41) and what they change

This section is newer than the response table. Where rows 4, 5, 8 and 9 say "assumed" or "not confirmed", the answers here replace them.

| Question | Answer | Effect |
|---|---|---|
| Cells in series? | Yes, three in series | Items 4 and 5: `BATT_CELLS 3` is confirmed. Cell ratings and "identical" still open |
| Motors | Two, rated 5 V | Item 9: the firmware's two-channel differential steering matches the hardware; decision D-007 (one motor) is out of date. New change: `MOTOR_MAX_DUTY` 255 → 110, because full duty on the 3S pack would put about 11 V on 5 V motors. Calculated, not measured. `run_tests.sh` pins the value to 255 so the PC tests are unchanged |
| Servo supply | From the ESP32 board's 5V pin | Brown-out risk when the servo stalls; documented in the wiring reference and power budget. Recommended: servo straight from the 5 V regulator |
| Board | ESP32 Dev Module | As assumed |
| Rudder travel | 90 degrees left and 90 degrees right of centre | Item 8: the firmware's 0–180 already equals 90 ± 90, so no firmware change. The dashboard default (90 ± 6) is the tighter one; to use the full travel set `{"servo_limit_deg": 90}` in the dashboard config. Test with small steps first: an SG90 can hit its internal end stop before 0 or 180 |

Still unanswered: what supplies 5 V to the ESP32 when it runs from the pack; cell rating; which build is flashed now; which board the dashboard test used.

## Questions only the people at the bench can answer

1. Heritage: are the three cells in series? Same type? What is printed on them (capacity, C-rating)?
2. Heritage: one propulsion motor or two? Rated voltage?
3. Heritage: which 5 V regulator is fitted, and does the servo share it?
4. Heritage: which build is on the control ESP32 now, and which board did test B use?
5. Armin: were the 15 s Wi-Fi retry and the 1.0/s ramp chosen after seeing a failure on the board (the comment mentions brown-outs)? If so, on which supply?
6. Team: safe rudder travel in degrees either side of centre.
