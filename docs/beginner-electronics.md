# Beginner guide - Electronics group (Person 4)

You work with **Person 2** (electronics lead). You do not need tech experience. Your job: **help build the bench setup safely, and prove with tests whether the safety system works.** A failed test is good evidence too - it shows we test honestly.

You own [tests/test-plan.md](../tests/test-plan.md) and [tests/test-results.md](../tests/test-results.md), and you help fill [components.md](components.md) and the pin table in [electronics/README.md](../electronics/README.md).

## Safety rules (read first)
1. **Never connect or disconnect power yourself unless Person 2 says so.** Unplug USB/battery before changing any wire.
2. Dry bench only. No water near the electronics. No propellers on motors.
3. Every LED needs a resistor. Check + and - before connecting a battery.
4. If something gets hot, smells or smokes: unplug it, say it out loud.

## Golden rules for using AI
1. Start every new AI chat with the context block below.
2. Ask "how sure are you?" If the AI is unsure or gives a fact without a source, do not use it.
3. Never paste passwords, codes or personal data.
4. Never write a number in our documents that we did not measure.
5. Log what you did (3 minutes per entry) - see the bottom.
6. Stuck for 30 minutes? Say it at the table.

### Context block - paste this first in every new chat
```
I am a beginner with almost no tech experience, on a 5-person hackathon team (Saab x Marine Technology Center, "Prompt-to-Product").
I am in the electronics group, helping the electronics lead and owning the tests.
Our project: SeaGuardian, a small unmanned boat concept for harbour inspection after storms or incidents. A laptop runs the mission
and a dashboard; ESP32 #1 (small microcontroller) streams camera video; ESP32 #2 reads sensors (MPU-6050 tilt/turn-rate sensor, GPS,
BMP280 air pressure sensor, a leak input), drives one propeller motor and a rudder servo, and stops the motor by itself if something goes wrong
(lost connection, emergency stop button, leak). There is no Raspberry Pi. Everything is tested on a dry table.
Please explain in simple words, avoid jargon (or explain it), use short steps, and tell me when you are unsure. Never invent facts or numbers.
```

## Your day, step by step

### Step 1 - understand the parts (first hour)
Ask Person 2 to show you each board and sensor for 5 minutes. Then:

Prompt E4-1:
```
Explain these parts to me with a real-life comparison for each: ESP32 (we have two: camera and control), MPU-6050 (IMU), GPS, BMP280, a leak sensor,
a motor driver, a servo, a breadboard, a resistor. Then explain what a "heartbeat", "emergency stop" and "comms-loss timeout" are in our system.
End with 3 questions to check I understood.
```

### Step 2 - measure the parts for CAD (Person 1 needs this early!)
With a ruler or caliper, measure every part (length x width x height in mm) and weigh it if there is a scale. Write it in the table in [components.md](components.md). Take one photo of each part next to the ruler.

Prompt E4-2:
```
I need to measure electronic parts for a 3D model. How do I use a caliper (or ruler) to measure length, width and height correctly,
including connectors and pins that stick out? What should I add as extra space (clearance) and why? Keep it short.
```

### Step 3 - help with wiring (with Person 2)
- Read the pin table in electronics/README.md out loud while Person 2 connects, and tick each wire.
- Take a clear photo of the finished wiring from above and save it in `electronics/wiring/` (or Discord, then link it).

Prompt E4-3 (to double-check the wiring, show the result to Person 2):
```
Here is our pin table: [paste the table from electronics/README.md]. Here is what I see on the board: [describe each wire: colour, from, to].
Make a checklist that compares them wire by wire. Do not tell me it is correct - list what matches, what does not, and what I should ask the electronics lead.
```

### Step 4 - learn the tests on the simulator (20 minutes, with Person 3)
Person 3 runs `python run.py --sim` in the `dashboard` folder. Click **Start mission**, then **Toggle tilt**, then **Cut link**, and watch the event log. These are the same tests you will run on the real hardware.

### Step 5 - turn tests into checklists
Start with T-R6 (tilt), T-R8 (E-stop) and T-R9 (cut link) from [tests/test-plan.md](../tests/test-plan.md).

Prompt E4-4:
```
Here is one test from our test plan: [paste the row].
Turn it into a step-by-step checklist a beginner can follow on a table: what to prepare, exactly what to press or click, what to look at
(the status LED, the dashboard, the event log), how to measure the time, and what counts as pass or fail.
Add a table for 5 trials. Do not change the pass criterion.
```
Paste the checklist under the test in test-plan.md (show Person 2 first).

### Step 6 - run the tests (when Person 2 says the hardware works)
- One person presses, you film the screen **and** the board together, and you write the result **right away** in test-results.md.
- Take the time from the dashboard event log (for example "COMMLOST ... 842 ms after the link was cut").
- 5 trials each. Write **every** trial, including the bad ones.

Prompt E4-5 - when a result looks strange:
```
I ran this test: [paste]. Expected: [..]. What happened: [exact description with numbers].
List the most likely reasons, most likely first, and for each a simple check I can do or ask the electronics lead about.
Do not tell me it passed if it did not meet the criterion.
```

### Step 7 - check your records (end of each day)
Prompt E4-6:
```
Here are my test records: [paste from tests/test-results.md]. Act as a strict engineering judge.
What is missing (numbers, evidence, number of trials, conditions)? Which results are not convincing, and what would make them convincing?
```

## Your Definition of Done
- **Friday:** parts measured and in components.md; wiring photo saved; checklists for T-R6, T-R8, T-R9 written.
- **Saturday:** T-R5 to T-R9 run 5 times each where the hardware works; every trial recorded; videos linked; "not tested" written where we could not test.

## Logging your AI use (3 minutes per entry)
In `docs/ai-log/<your-name>.md` (in the GitHub browser), add:
```
### <time> - <what you were doing>
- Prompt: (paste it, or "E4-4 for T-R8")
- What the AI gave me:
- How I checked it: (asked Person 2 / measured / ran the test)
- What was wrong or missing:
- What I changed:
```
"How I checked it" is the line the jury cares about most.

## Words you will hear
| Word | Simple meaning |
|---|---|
| ESP32 | Tiny computer chip that reads sensors and controls motors |
| GPS | Receiver that tells where the boat is (position); it does not give a reliable direction when standing still |
| Servo | Small motor that turns to an angle - it moves the rudder |
| Rudder | Flap at the back that steers the boat left/right |
| IMU (MPU-6050) | Tilt-and-motion sensor (roll = side to side, pitch = front to back) |
| BMP280 | Air pressure sensor (hPa) |
| I2C (SDA/SCL) | Two wires that several sensors share to talk to the ESP32 |
| GND | Ground: the common "minus" every part must share |
| PWM | Switching power on/off very fast to set motor speed |
| Motor driver | Board between the ESP32 and the motors (the ESP32 cannot power motors directly) |
| Heartbeat | "Still here" message the laptop sends 5 times a second; if it stops, the ESP32 stops the motors |
| E-stop | Emergency stop: motors stop until someone presses Reset |
| Telemetry | Stream of sensor readings sent to the dashboard |
| Pass / Fail / Not tested | The only three allowed test results |
