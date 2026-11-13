# Beginner's guide - Person 4 and Person 5

You do not need tech experience. Your work is **evidence**: tests, sources, the user story and the pitch. That evidence is a big part of the score (problem understanding and user value alone are 40%). Use AI as a patient teacher, and always check what it says.

## Golden rules for using AI
1. **Start every new AI chat with the context block below.** Without it, the AI guesses.
2. **Ask "how sure are you?"** If the AI is not sure, or gives a fact without a source, do not use it.
3. **Never paste passwords, codes or personal data** into an AI chat.
4. **Never write a number in our documents that we did not measure or find in a source.**
5. **Log what you did** (3 minutes per entry): see "Logging your AI use" at the bottom.
6. Stuck for 30 minutes? Say it at the table. Asking is part of the job.

### Context block - paste this first in every new chat
```
I am a beginner with almost no tech experience, on a 5-person hackathon team (Saab x Marine Technology Center, "Prompt-to-Product").
Our project: SeaGuardian, a small unmanned boat concept for harbour inspection after storms or incidents. A Raspberry Pi (small computer)
runs the mission and a dashboard on a laptop; an ESP32 (small microcontroller) reads sensors (tilt, air pressure, water leak) and stops the
motors by itself if something goes wrong (lost connection, emergency stop button, leak). The mission is simulated; nothing goes in water.
Please explain in simple words, avoid jargon (or explain it), use short steps, and tell me when you are unsure. Never invent facts or numbers.
```

## Your tools (15 minutes, once)
- **GitHub in the browser:** how to edit a file is in [workflow.md](workflow.md) ("Edit docs in the GitHub browser"). Practise once by creating your own AI log: open `docs/ai-log/`, click **Add file -> Create new file**, name it `<your-name>.md`, write "# AI log: <your name>", and commit.
- **An AI chat** (Claude, ChatGPT - whatever you have).
- **Phone** for videos and photos (Person 4).

---

## Person 4 - Verification (you prove that things work, or that they don't)
You own [tests/test-plan.md](../tests/test-plan.md) and [tests/test-results.md](../tests/test-results.md). A failed test is **good** evidence too - it shows we test honestly.

### Step 1 - understand the system (first hour)
Prompt B4-1:
```
Explain SeaGuardian's safety system to me like I'm new: what a "heartbeat" is, what happens when it stops, what an emergency stop does,
and what the leak sensor does. Use a real-life comparison for each. Then ask me 3 questions to check I understood.
```
Then ask Person 2 to show you the ESP32 and the wires for 5 minutes. Ask: "What should I see when it works? What when it fails?"

### Step 2 - practise on the simulator (with Person 3's help, 20 minutes)
Person 3 runs `python run.py --sim` in the `dashboard` folder and opens the dashboard. Click **Start mission**, then **Toggle tilt**, then **Cut link**, and watch the event log. This is exactly what you will test on the real hardware.

### Step 3 - turn each test into a checklist you can follow
Prompt B4-2 (do this for T-R6, T-R8 and T-R9 first):
```
Here is one test from our test plan: [paste the row from tests/test-plan.md].
Turn it into a step-by-step checklist that a beginner can follow on a table: what to prepare, exactly what to click or press,
what to look at, how to measure the time (phone video or the dashboard event log), and what counts as pass or fail.
Add a short table where I can write the result of 5 trials. Do not change the pass criterion.
```
Paste the checklist into tests/test-plan.md under the test (or show it to Person 3 first).

### Step 4 - run the tests (as soon as Person 2 says the hardware works)
- One person presses, you film the screen and the board together, you write the result **right away** in the trial table in tests/test-results.md.
- Write the time from the dashboard event log (it says e.g. "COMMLOST ... 842 ms after the link was cut").
- Do 5 trials. Write **every** trial, also the bad ones.

Prompt B4-3 - when a result looks strange:
```
I ran this test: [paste the test]. Expected: [..]. What happened: [describe exactly, with numbers].
List the most likely reasons, from most to least likely, and for each one a simple check I can do or ask Person 2 about.
Do not tell me it passed if it did not meet the criterion.
```

### Step 5 - check your own records (end of each day)
Prompt B4-4:
```
Here are my test records: [paste from tests/test-results.md]. Act as a strict engineering judge.
What is missing (numbers, evidence, number of trials, conditions)? Which results are not convincing, and what would make them convincing?
```

---

## Person 5 - Research, user story, AI log and pitch (you make the jury believe us)
You own [research.md](research.md), [ai-process.md](ai-process.md) (with Person 3) and [presentation/](../presentation/pitch-outline.md).

### Step 1 - understand the project (first hour)
Prompt B5-1:
```
Explain SeaGuardian to me so I could explain it to my grandparents in 30 seconds. Then explain the 3 things that make it different
from "just a small autonomous boat". Then give me the 5 hardest questions a Saab engineer could ask about it.
```

### Step 2 - research how harbour inspection is done today
Prompt B5-2:
```
I am researching how harbours (in Sweden or elsewhere) inspect quays, piers and the water after a storm or an incident,
and what tools exist (boats, divers, drones, unmanned surface vehicles). Give me a short overview and, for EVERY claim, a source link
I can open. If you are not sure a source exists, say "not sure" instead of giving a link. Do not give numbers without a source.
```
Open every link yourself. Put only what you found in the source into research.md (with the link). Wrong or missing source -> "Unverified / rejected claims" table.

### Step 3 - the mentor interview (with Person 3)
Prompt B5-3 - before:
```
Help me prepare a 5-minute conversation with a Saab/MTC expert about whether harbour inspection after storms is a real problem.
Give me 5 short, open questions (not yes/no), what to listen for in each answer, and tips for writing down their words accurately.
```
During the talk: write their words as exactly as you can. After the talk, Prompt B5-4:
```
Here are my notes from a conversation with a Saab/MTC expert: [paste notes].
Rewrite our problem statement and target user using ONLY what they said. Then list which of our assumptions they confirmed,
which they did not mention, and which they contradicted. Do not add anything they did not say.
```

### Step 4 - the user scenario (user value = 20%)
Prompt B5-5:
```
Write a short, realistic scenario (8-10 sentences) of a harbour safety officer the morning after a storm, using SeaGuardian.
Show the decision they must make, what SeaGuardian tells them, and how that changes the decision. Use only these facts: [paste the mentor's
words and our features from the README]. Mark anything that is an assumption with [ASSUMPTION].
```

### Step 5 - curate the AI log (every 2-3 hours)
Ask each person "what did AI help you with, and what did it get wrong?" and copy the best entries from `docs/ai-log/` into ai-process.md. Start with **AI-001** (already there): our own test caught a wrong assumption about the stop timing.
Prompt B5-6:
```
Here are entries from our AI engineering log: [paste]. Pick the 3 that best show (1) AI saving time, (2) a human catching an AI mistake,
(3) a test that changed the design. For each, write 2 sentences we could say in the pitch. Do not add details that are not in the entries.
```

### Step 6 - the pitch (Saturday)
Prompt B5-7:
```
Here is our pitch outline: [paste presentation/pitch-outline.md] and our test results: [paste the summary table].
Write a spoken script for [N] minutes, split per speaker (Persons 1-5), simple sentences, no invented numbers.
Mark every number with its source (test ID or research link).
```
Prompt B5-8 - practice:
```
Act as a strict Saab engineer on a hackathon jury. Ask me one hard question at a time about SeaGuardian (originality, safety,
autonomy, cost, regulations, the AI process). Wait for my answer, then tell me how to make the answer more honest and convincing.
```

---

## Logging your AI use (both of you, 3 minutes per entry)
In your file `docs/ai-log/<your-name>.md` (in the GitHub browser), add:
```
### <time> - <what you were doing>
- Prompt: (paste it, or "B4-2 for T-R8")
- What the AI gave me:
- How I checked it: (opened the source / asked Person 2 / ran the test / compared with the requirement)
- What was wrong or missing:
- What I changed:
```
The "how I checked it" line is the most important one for the jury.

## Words you will hear
| Word | Simple meaning |
|---|---|
| ESP32 | A tiny computer chip that reads sensors and controls motors |
| Raspberry Pi | A small computer that runs our mission program and dashboard |
| Heartbeat | A "still here" message the Pi sends 5 times a second; if it stops, the ESP32 stops the motors |
| E-stop | Emergency stop: one press stops the motors until someone resets it |
| IMU | Tilt-and-motion sensor (roll = side to side, pitch = front to back) |
| Telemetry | The stream of sensor readings sent to the dashboard |
| CAD | 3D drawing of the boat on the computer |
| Simulated | Pretend data from our software, always labelled "SIMULATED" |
| Requirement (R1...) | Something the product must do, with a number we can test |
| Pass / Fail / Not tested | The only three allowed test results |
