# Beginner guide - Software group (Person 5)

You work with **Person 3** (Angelo, software + integration). You do not need tech experience. Your job: **make the jury believe us** - with a real user problem, a clear demo, honest evidence of how we used AI, and the pitch. Problem understanding and user value alone are 40% of the score.

You own [research.md](research.md), [ai-process.md](ai-process.md) (with Person 3) and [presentation/](../presentation/pitch-outline.md). You are also the **first user of the dashboard**: if you cannot understand it, the jury will not either.

## Golden rules for using AI
1. Start every new AI chat with the context block below.
2. Ask "how sure are you?" If the AI is unsure or gives a fact without a source, do not use it.
3. Never paste passwords, codes or personal data.
4. Never write a number in our documents that we did not measure or find in a source.
5. Log what you did (3 minutes per entry) - see the bottom.
6. Stuck for 30 minutes? Say it at the table.

### Context block - paste this first in every new chat
```
I am a beginner with almost no tech experience, on a 5-person hackathon team (Saab x Marine Technology Center, "Prompt-to-Product").
I am in the software group, and I own research, the user story, the AI log and the pitch.
Our project: SeaGuardian, a small unmanned boat concept for harbour inspection after storms or incidents. A laptop runs a simulated
inspection mission and a dashboard; ESP32 #1 (small microcontroller) streams camera video; ESP32 #2 reads sensors (tilt, GPS position,
air pressure, water leak), drives one propeller motor and a rudder servo, and stops the motor by itself if something goes wrong
(lost connection, emergency stop, leak). The mission is simulated; nothing goes in water.
Please explain in simple words, avoid jargon (or explain it), use short steps, and tell me when you are unsure. Never invent facts or numbers.
```

## Your day, step by step

### Step 1 - understand the project (first hour)
Prompt S5-1:
```
Explain SeaGuardian so I could explain it to my grandparents in 30 seconds. Then explain the 3 things that make it different
from "just a small autonomous boat". Then give me the 5 hardest questions a Saab engineer could ask about it.
```

### Step 2 - try the dashboard yourself (30 minutes, with Person 3)
Person 3 starts it on a laptop: `python run.py --sim` in the `dashboard` folder, then open http://127.0.0.1:8000.
- Click **Start mission**, **Toggle tilt**, **Cut link**, **E-STOP**, **Reset**. Watch what changes.
- Write down everything that confused you (words, colours, where to look). Give the list to Person 3 - **they** change the code.

Prompt S5-2:
```
I am testing an operator dashboard for a stage demo in front of judges. Here is what I saw: [describe the screen, or paste a screenshot].
Here is what confused me: [list]. Suggest simple improvements to wording and layout, ranked by how much they help a first-time viewer.
Do not suggest new features.
```

### Step 3 - research how harbour inspection is done today
Prompt S5-3:
```
I am researching how harbours (in Sweden or elsewhere) inspect quays, piers and the water after a storm or an incident,
and what tools exist (boats, divers, drones, unmanned surface vehicles). Give me a short overview and, for EVERY claim, a source link
I can open. If you are not sure a source exists, say "not sure" instead of giving a link. Do not give numbers without a source.
```
Open every link yourself. Put only what the source really says into research.md (with the link). Wrong or missing source -> "Unverified / rejected claims" table.

### Step 4 - the mentor interview (with Person 3, as early as possible)
Prompt S5-4 - before:
```
Help me prepare a 5-minute conversation with a Saab/MTC expert about whether harbour inspection after storms is a real problem.
Give me 5 short, open questions (not yes/no), what to listen for in each answer, and tips for writing down their words accurately.
```
During the talk: write their words as exactly as you can, with their name and the time. After, Prompt S5-5:
```
Here are my notes from a conversation with a Saab/MTC expert: [paste notes].
Rewrite our problem statement and target user using ONLY what they said. Then list which of our assumptions they confirmed,
which they did not mention, and which they contradicted. Do not add anything they did not say.
```

### Step 5 - the user scenario (user value = 20%)
Prompt S5-6:
```
Write a short, realistic scenario (8-10 sentences) of a harbour safety officer the morning after a storm, using SeaGuardian.
Show the decision they must make, what SeaGuardian tells them, and how that changes the decision. Use only these facts: [paste the mentor's
words and our features from the README]. Mark anything that is an assumption with [ASSUMPTION].
```

### Step 6 - curate the AI log (every 2-3 hours)
Ask each person: "What did AI help you with, and what did it get wrong?" Copy the best entries from `docs/ai-log/` into ai-process.md. **AI-001** is already there: our own test caught a wrong assumption about the stop timing.

Prompt S5-7:
```
Here are entries from our AI engineering log: [paste]. Pick the 3 that best show (1) AI saving time, (2) a human catching an AI mistake,
(3) a test that changed the design. For each, write 2 sentences we could say in the pitch. Do not add details that are not in the entries.
```

### Step 7 - the pitch and the backup video (Saturday)
Prompt S5-8:
```
Here is our pitch outline: [paste presentation/pitch-outline.md] and our test results: [paste the summary table].
Write a spoken script for [N] minutes, split per speaker (Persons 1-5), simple sentences, no invented numbers.
Mark every number with its source (test ID or research link). End with what we could do with more time, money, research and a test environment.
```
Record the backup demo video with Person 4 (screen + hardware), save it on a laptop **and** a phone.

Prompt S5-9 - practice:
```
Act as a strict Saab engineer on a hackathon jury. Ask me one hard question at a time about SeaGuardian (originality, safety,
autonomy, cost, regulations, the AI process). Wait for my answer, then tell me how to make it more honest and convincing.
```

## Your Definition of Done
- **Friday:** mentor answer recorded word for word; 5+ sourced facts in research.md; dashboard feedback given to Person 3; AI log curated once.
- **Saturday:** user scenario; 3 pitch-ready AI-log stories; full pitch script with sources; backup video; Q&A practised.

## Logging your AI use (3 minutes per entry)
In `docs/ai-log/<your-name>.md` (in the GitHub browser), add:
```
### <time> - <what you were doing>
- Prompt: (paste it, or "S5-3")
- What the AI gave me:
- How I checked it: (opened the source / asked the mentor / compared with the test results)
- What was wrong or missing:
- What I changed:
```
"How I checked it" is the line the jury cares about most.

## Words you will hear
| Word | Simple meaning |
|---|---|
| Laptop | Runs the mission program and the dashboard |
| GPS | Tells where the boat is (position) |
| Rudder + servo | The flap at the back that steers, and the small motor that turns it |
| ESP32 | Tiny computer chip that reads sensors and controls motors |
| Dashboard | The web page on the laptop where the operator sees and controls the mission |
| Simulator / SIMULATED | Pretend data from our software, always labelled on screen |
| Heartbeat | "Still here" message the laptop sends 5 times a second; if it stops, the ESP32 stops the motors |
| E-stop | Emergency stop: motors stop until someone presses Reset |
| Telemetry | Stream of sensor readings sent to the dashboard |
| USV | Unmanned surface vehicle - a boat without a crew on board |
| Requirement (R1...) | Something the product must do, with a number we can test |
| Pass / Fail / Not tested | The only three allowed test results |
