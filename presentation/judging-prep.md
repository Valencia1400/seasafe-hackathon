# Judging Prep - SeaGuardian (3-person team: Electronics, CAD, Software)

Built from the official criteria (7 criteria, 0-5 each, weighted) and what is **actually in the repo as of Sat 14 Nov**. Rule for every answer: say what we built, what we tested, what we did not. "We did not test that" is a good answer; a made-up number is a zero.

> **Team note:** older docs assume five people. We are three: **Electronics**, **CAD**, **Software/product (Angelo)**. In the pitch, say who did what - judges score "your team's own work" and "what you built vs reused". Reused: YOLOE/Ultralytics model, ESP32 Arduino libraries, Python standard library. Built by us: everything else below.

---

## 1. Where we stand, honestly (fill the gaps BEFORE the demo)

| Area | What the repo proves today | Gap that costs points |
|---|---|---|
| Dashboard + simulated mission | Works, 60 unit/scenario tests pass (run today: `Ran 60 tests ... OK`). Start/Stop/E-STOP/Reset, event log, scenarios: tilt, comms loss, leak, GPS lost | Simulation only - must be labelled SIMULATED on stage |
| Camera + detection | **Real hardware.** XIAO ESP32S3 camera -> iPhone hotspot -> YOLO viewer -> dashboard. Measured 13 Nov: ESP32 17.8-26.7 fps, viewer 19-26 fps, 22-27 ms inference, person detected. CAMERA DOWN shown and recovered with no restart. Honest model test: on 64 public-domain photos buoy 0/10, kayak 0/4, debris 0/6, life jacket 1/10 -> removed from defaults | Detections are "potential object, operator review required", not damage assessment |
| Control ESP32 firmware | Written | **Not compiled or run on hardware** (electronics/README.md). Biggest technical-quality risk |
| Safety stop (E-stop, comms loss) | Logic tested in simulation; timing finding: stop 0.8-1.05 s after link cut (842 ms measured in the sim run) | **No real-hardware T-R8/T-R9 numbers.** `tests/test-results.md` is still all "Not tested" |
| CAD | `cad/models` empty on `main`; branch `feature/cad` has no commits ahead of main | Nothing for judges to see unless CAD pushes. Feasibility and partner relevance depend on it |
| Mentor validation (R1) | `research.md` table empty | Problem understanding is 20% - need at least one real quote |
| AI log | AI-001 is a real caught mistake (test expected exactly 1.0 s, real logic counts from last heartbeat) | Add 1-2 entries from CAD and electronics |
| Costs, component list | `components.md` blank | Do not quote costs unless sourced |

**Do these in this order (about 2 hours total):**
1. Electronics: compile + flash control firmware, run E-stop and comms-loss 5x each on the bench, **film it**, write the numbers in `tests/test-results.md` (fails included).
2. CAD: push a model + exploded view + one iteration (v1 -> v2, with the reason) to `cad/`.
3. Software (you): ask one Saab/MTC person the mentor question in `research.md`, write the quote word for word. Update README status table. Record a 60-90 s backup video of the full demo.
4. All: update `docs/ai-process.md` with one entry each (what AI produced, what was wrong, how we caught it).

---

## 2. Score map: what each criterion rewards and our best honest evidence

Scale reminder: 3 = "clearly supported for a weekend prototype". **Aim for solid 3s everywhere and 4s on User value, Problem and Technical quality.** A polished pitch does not lift every score; evidence does.

| Criterion (weight) | What a 3 vs 5 needs | Our evidence to show | One-liner for the judge note |
|---|---|---|---|
| **Problem understanding (20%)** | 3: right users, scoped problem. 5: evidence, causes vs symptoms, why *this* problem | Mentor quote (get it!); scoped to *initial inspection before sending people*; explicit non-goals (no autonomy claim) | "We chose the first look after a storm, because the decision to send personnel needs information first." |
| **User value (20%)** | 3: concrete improvement + a test/scenario. 5: supported improvement over today, open about drawbacks | The operator scenario; live camera + sensor + fault warnings in one screen; dashboard wording that forces operator review | "Operator sees condition, position, camera and faults before committing people. Not yet compared against a real inspection." |
| **Feasibility (15%)** | 3: realistic next step, dependencies, risks. 5: credible rollout step, tested assumptions | `docs/risks.md`, CAD fit, the camera's measured Wi-Fi performance | Next step: "controlled water test at an authorised site with a tethered, supervised hull." Biggest risk: waterproofing + Wi-Fi range |
| **Technical quality (15%)** | 3: core shown, choices explained, limitations stated. 5: reliable demo + tests | 60 passing tests, real camera chain with measured fps, separation of safety logic from dashboard, bench stop timing (once recorded) | "Here is what ran, here is what was simulated." |
| **Innovation (10%)** | 3: relevant adaptation. Unusual tech gets no bonus | Safety on ESP32 independent of the laptop; modular sensor bay; no-training open-vocabulary detection with honest limits | "Not a new boat. A modular platform where mission logic and safety are kept apart." |
| **Presentation + demo (10%)** | 3: on time, problem -> solution -> demo -> limits. Clarity beats polish | `demo-script.md`; every person speaks; backup video | Show limits on a slide yourself |
| **Partner relevance (10%)** | 3: addresses brief core + constraints | Brief: Prompt-to-Product; MTC areas: sensor integration, autonomy and safety. Sensors + camera + safety + AI process log | "We show the *path*: prompt -> design -> test -> fix, logged." |

Tie-break order if scores are equal: user value, problem, feasibility, technical, innovation, partner, presentation. So **user value and problem evidence matter most**.

---

## 3. Likely questions and honest answer directions

Each answer: **claim -> evidence -> limit**. Fill `[...]` from real results before Sunday; delete the ones you cannot back.

### Problem and user (20%)
| Question | Answer |
|---|---|
| Who is the user and is this a real need? | Harbour maintenance/safety operators deciding whether to send personnel after a storm or incident. Mentor said: "[quote, name, time]". Without a quote say: "This is our hypothesis; we asked [x]." |
| How is it done today? | [only from the mentor or a sourced link]. If unknown: "We have not verified current practice." |
| Why this problem and not another? | Five concepts were weighed (`docs/concepts.md`, decision D-002); chose the one that fits sensors + autonomy + safety and can be tested on a bench in two days |
| What are you NOT solving? | Real navigation, obstacle avoidance, water operation, damage assessment (requirements section 3) |

### User value (20%)
| Question | Answer |
|---|---|
| What improves for the user? | One screen: live camera with detections, IMU/pressure, position, faults and event log. Operator reviews before deciding |
| How did you check that? | Scenario run in the dashboard (tilt, comms loss, leak, GPS lost) plus a real camera test. We did **not** test with real operators |
| Drawbacks? | Detections can be wrong (buoy 0/10, debris 0/6 in our test, so not in defaults); camera needs a Wi-Fi link; bench only |

### Feasibility (15%)
| Question | Answer |
|---|---|
| What is the next concrete step? | Run the safety tests on the real control board with a motor, then a tethered hull test at an authorised site (e.g. MTC's) |
| Biggest risk? | Waterproofing and radio range on a real hull; detection accuracy at sea. Both untested |
| Cost? | Only sourced component prices. If `components.md` is blank: "We have not costed it" |
| Could it be tested on water? | Only in an authorised environment, following maritime rules for trials of unmanned vessels |

### Technical quality (15%)
| Question | Answer |
|---|---|
| What actually works? | Real: camera chain (fps measured), dashboard, 60 tests. Simulated: mission movement, control board data in the dashboard. [Bench: control firmware result] |
| How do you know it stops? | [T-R8/T-R9 numbers from the bench, 5 of 5]. Logic also tested in simulation. "Dry bench, not full vessel safety." |
| Why does the stop take up to ~1 s? | The timeout counts from the last heartbeat (sent every 200 ms): measured 0.8-1.05 s. We chose 1.0 s to avoid false stops on a Wi-Fi hiccup |
| What if the laptop crashes? | The ESP32 enforces the stop itself (D-004); the laptop is never the only safety mechanism |
| Why Python stdlib / JSON lines? | No install on stage, easy to log and time; USB serial today is simple and reliable on a bench |
| Why YOLOE and not a trained model? | No training data or time; text prompts work for person/boat/ship/bottle. We tested it, found what fails, and removed those classes |
| What does the camera do to safety? | Nothing. Detections never touch motor or rudder (tested: T9). Camera failure shows a banner only |
| Is the hardware link wired or Wi-Fi? | Control link is USB serial in the demo; camera is Wi-Fi. A real boat needs radio for both - not tested |
| What are the limitations of the tests? | Simulation is not physical proof; one network (iPhone hotspot); one person detected in a controlled test; no water, waves, glare or salt |

### Innovation (10%)
| Question | Answer |
|---|---|
| Saab already builds autonomous vessels. What is new? | We do not claim a better boat. We show a low-cost experimental platform where mission logic and safety are separate, with a swappable sensor bay and an auditable AI-assisted process |
| Isn't this just an ESP32 and YOLO? | The parts are common. The adaptation: operator-in-the-loop wording, stale/frozen detection handling, failure isolation, honest test of what the model cannot see |

### Presentation / partner (10% + 10%)
| Question | Answer |
|---|---|
| Which brief goal does this meet? | Prompt-to-Product: we show requirements -> design -> test -> iterate with AI. MTC areas: sensor integration, automation and autonomy, safety |
| Who built what? | Electronics: [x]. CAD: [x]. Software: dashboard, simulator, mission logic, tests, integration with the camera viewer. Reused: YOLOE/Ultralytics, ESP32 libraries |
| What would you do with more time/money/test site? | Next week: real sensors on a bench rig. With prototyping: build the hull, test flotation, sealing, power. With a marine test site: supervised trials, then positioning |

### AI use (supports Partner + Technical)
| Question | Answer |
|---|---|
| How do you know the AI was right? | We did not trust it. AI-001: AI wrote a test expecting a stop at exactly 1.0 s; the real logic counts from the last heartbeat. 1 of 13 tests failed, we measured 842 ms in a live run, corrected the test and the docs. Also found a null-IMU crash in review |
| What did AI speed up? | [estimate, say "estimated"]. Not a measured number |
| What did humans decide? | Architecture, scope (D-001..D-008), what to test and what to cut |

### Hard / trick questions
| Question | Answer |
|---|---|
| "Is it autonomous?" | No. Simulated, supervised mission. Real autonomy needs positioning, perception, water trials |
| "Is it safe?" | The control logic stops the motor on bench faults; that is not proof of vessel safety |
| "Is the data real?" | Camera: real. Control board data on the dashboard: [real/simulated]. Every simulated value is labelled SIMULATED |
| "Why should we believe your fps / accuracy?" | Measured 13 Nov, setup in `vision/INTEGRATION.md` section 6, one network, one machine |
| "Does the detection find drowning people?" | No. It finds "potential person" in view; not tested for people in water |
| "What happens if the demo fails?" | Backup video + simulator mode (both labelled) |

---

## 4. Stage plan for three people (about 5-7 min; confirm the actual limit)

| Part | Speaker | Content |
|---|---|---|
| Problem + scenario (1 min) | Software | The operator's decision; mentor quote; what we scoped out |
| Solution + demo (2-3 min) | Software drives, Electronics narrates the hardware | Start mission -> live data -> camera detection -> tilt/leak warning -> cut link -> motor stop (real if tested, else labelled simulation) |
| CAD (1 min) | CAD | Exploded view, sensor bay, one iteration v1 -> v2 and why |
| Process + tests (1 min) | Electronics | Test table with numbers (fails included), AI-001 mistake |
| Limits + next step (1 min) | Software | What not tested, biggest risk, next concrete step |

Answer rules for Q&A: pass the question to the owner of that part; answer in two sentences (claim, evidence); say "not tested" without apology; never defend a claim you cannot show.

---

## 5. Words to use and avoid
**Use:** "simulated supervised mission", "bench test", "potential object, operator review required", "measured on 13 Nov", "not tested".
**Avoid:** "autonomous", "safe", "AI-powered rescue", "detects drowning people", "cheaper than", any statistic without a source.

## 6. Final-hour checklist
- [ ] `tests/test-results.md` has real rows (pass and fail) for E-stop, comms loss, tilt, camera
- [ ] CAD pushed to `main` with exploded view image
- [ ] Mentor quote in `docs/research.md` (or the slide says "hypothesis")
- [ ] `python run_operator.py` starts offline; simulator mode ready; camera chain tested on the venue Wi-Fi/hotspot
- [ ] Backup video on laptop and phone
- [ ] README status table updated (it still says "Not started" everywhere)
- [ ] Everyone can answer: what did I build, what did I test, what failed
- [ ] No new features on Sunday
