# AI log: Heritage

Heritage (Electrical & Embedded Systems Lead) worked with Claude (Anthropic, chat assistant) on 13-14 November 2026. These entries were written up by Angelo on 14 November from Heritage's own records: the session-by-session log in [`electronics/firmware/seaguardian_revC/ACTIVITY_LOG.md`](../../electronics/firmware/seaguardian_revC/ACTIVITY_LOG.md) and [`RECONCILIATION.md`](../../electronics/firmware/seaguardian_revC/RECONCILIATION.md). Heritage should correct anything here that is wrong. Entries follow the template in [`../ai-process.md`](../ai-process.md). No passwords or Wi-Fi keys are recorded here.

### AI-H01 - Circuit design and the earlier ESP-IDF firmware (rev A and rev B)
- Time / person / task: 13 Nov, 13:04-15:00, Heritage, circuit diagram with a motor driver, then power design and firmware.
- AI tool + model: Claude (chat assistant).
- Prompt (paste or link): design the circuit from the team's parts list and deliver it in KiCad and Wokwi; later a requirements document for wiring, battery calculations, modular firmware with two-way web control and a validation plan. Activity log sessions 1-4.
- Result (what the AI produced): KiCad schematic and Wokwi project (rev A), then rev B: ESP-IDF firmware, wiring diagram, power budget and an engineering report.
- Human verification: Heritage built and ran the Wokwi project and pasted the serial output (motor ramp, servo sweep, ADC and wake-button lines).
- Errors / limitations found: the first real build failed with a duplicate `app_main` because the project was built with the Arduino core, not native ESP-IDF; the AI also used a wrong Wokwi part name and found a logic-level problem on the BTS7960 module. Rev B was tested only on a PC and in the QEMU emulator (46 PC tests, 25 end-to-end checks), never on a real board, and it is not the firmware in use.
- Changes made afterwards: entry point renamed so the Wokwi build runs; rev B replaced by rev C when the hardware changed.
- Linked requirement / issue / commit: activity log sessions 1-4.

### AI-H02 - Arduino control firmware (rev C) and first run on the real board
- Time / person / task: 13 Nov 22:24 to 14 Nov 11:55, Heritage, control firmware for L298N, SG90, MPU6050 and NEO-6M.
- AI tool + model: Claude (chat assistant).
- Prompt (paste or link): a new requirements document: Arduino framework, several `.ino` files, emergency stop, watchdog, detailed logging, ESP32 connects out to the website's server. Activity log sessions 5-8.
- Result (what the AI produced): the `seaguardian_revC` sketch (14 source files), 79 PC unit tests on the real source files, a bench test server and a README with a 15-step hardware test procedure.
- Human verification: Heritage compiled and uploaded it from the Arduino IDE and pasted the boot log from the real ESP32: boot, Wi-Fi join, MPU6050 start-up and gyro calibration, NEO-6M reception.
- Errors / limitations found: the ESP32 did not connect to the test server on Heritage's laptop (Windows Firewall suspected, never confirmed); GPS data became corrupted after about 90 s (loose jumper or supply dip suspected); the AI gave a misleading browser check for a WebSocket-only server. Motors, servo, emergency stop and watchdog were not tested on hardware.
- Changes made afterwards: a review found that a `speed` command could restart the motors after a watchdog stop; fixed, with a unit test added.
- Linked requirement / issue / commit: `electronics/firmware/seaguardian_revC/`; activity log sessions 5-8.

### AI-H03 - Reconciliation of the electronics package with GitHub, and the 3S power budget
- Time / person / task: 14 Nov, 13:31-17:41, Heritage, battery change to three cells and comparison of the package (revD) with the GitHub firmware.
- AI tool + model: Claude (chat assistant).
- Prompt (paste or link): update the battery calculations for three 3.7 V 2200 mAh cells; then the team's reconciliation request (12 conflicts plus power-budget corrections). Activity log sessions 9-11.
- Result (what the AI produced): `RECONCILIATION.md` (decision per item with the evidence behind it), a rev E power budget, a text wiring reference and a small proposed patch on top of GitHub.
- Human verification: Heritage answered the hardware questions from the bench (three cells in series, two 5 V motors, servo fed from the ESP32 board's 5V pin, rudder travel 90 degrees each side). The patched tree was compiled and passed 79 of 79 PC tests; it has not been flashed to any board.
- Errors / limitations found: the emergency-stop race the team found was real and came from the AI's original code, whose README also claimed a 20 ms pin re-write the code did not do; the single-threaded PC tests could not catch it. The AI's rev D budget had the wrong L298 voltage drop (about 2.8 V; the datasheet gives 3.7 V typical). Decision D-007 (one motor) no longer matches the hardware. Full duty on the 3S pack would put about 11 V on 5 V motors.
- Changes made afterwards: GitHub's emergency-stop fix kept unchanged; port 5000 dropped; `MOTOR_MAX_DUTY` 255 to 110 proposed (calculated, not measured). The patch with the `Config.h`, README, power-budget and wiring files has not been applied to the repository yet.
- Linked requirement / issue / commit: `RECONCILIATION.md`; compared against commit a86eb17.
