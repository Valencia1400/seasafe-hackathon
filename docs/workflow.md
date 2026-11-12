# Team Workflow & How-To

## Team GitHub usernames (fill in)
| Person | Role | GitHub username |
|---|---|---|
| 1 | Technical lead / CAD | TODO |
| 2 | Electronics | TODO |
| 3 | Product lead / integration | TODO |
| 4 | Prototype & verification | TODO |
| 5 | Research, docs & pitch | TODO |

## Checkpoints (every 60-90 minutes, 5 minutes, standing at the table)
Each person answers: **What is done? What am I on now? Am I blocked? Does anyone need something from me? Are we on track for the demo?**
Person 3 updates the status table in README.md and the issue board. **Nobody stays blocked > 30 minutes** - say it out loud and add the `Blocked` label.

Rule of the weekend: **no stretch goal work until that day's essential issues are Done.**

## Friday / Saturday plan (adjust to the official schedule)
**Friday**
1. First hour: all five read the brief together. P3 fills docs/requirements.md section 1. P2 confirms components, P1 confirms printer. P5 starts research. P4 builds the dummy module + tub setup.
2. P2 -> P1: module dimensions by midday (critical path).
3. P1: CAD v1 and first print started by evening (long prints overnight if the venue allows). P4: flotation mock-up (bottle + ballast) to learn how self-righting behaves.
4. P2: LED + button circuit on breadboard, tested dry. P3: integration plan, AI log running.
5. Evening checkpoint: requirements frozen v1, CAD v1 sliced, circuit works, mock-up results recorded.

**Saturday**
1. Morning: print/assemble housing, test flotation (T-R1, T-R2). Integrate electronics into module. Module swap (T-R4).
2. Midday: pick the failing test -> AI-assisted CAD v2 -> reprint -> retest (R8).
3. Afternoon: stretch goals only if all essentials Done. Record backup video. Fill test-results.md. Finish pitch + demo script.
4. Evening: **prototype freeze** at the agreed time. After freeze: only documentation, rehearsal, backups.

**Sunday:** rehearse twice, demo readiness checklist (presentation/demo-script.md), present, Q&A. No new features.

## Git workflow (simple)
- `main` = stable. Always demo-able. Only technical members merge; beginners edit docs in the browser.
- Branches: `feature/cad`, `feature/electronics`, `feature/dashboard`. Docs/tests/presentation edits can go straight to `main` through the browser (small edits only).
- Each person only edits **their own folder** (see README map). That avoids conflicts.

### Edit docs in the GitHub browser (beginners: Persons 4 and 5)
1. Open the repo on github.com, click the file (e.g. `tests/test-results.md`).
2. Click the pencil icon (Edit).
3. Type your change. Tables: copy a row and fill it in.
4. Click **Commit changes**, write a short message ("Add flotation trial 1"), choose **Commit directly to the main branch**, click **Commit changes**.
5. If GitHub says someone else changed the file: copy your text, reload the page, paste it again, commit again.
Photos/videos: drag small images into an issue comment and link them, or put them in Discord and paste the link into test-results.md.

### Technical members (command line)
```bash
git clone https://github.com/<owner>/seasafe-hackathon.git
cd seasafe-hackathon
git checkout -b feature/cad        # first time (or: git checkout feature/cad)
# ...edit files in your own folder...
git add cad/
git commit -m "CAD: add ballast parameter"
git push -u origin feature/cad
```
Open a pull request on GitHub (button "Compare & pull request"), base = `main`. Keep PRs small. Person 1 reviews and clicks **Merge pull request** (use "Squash and merge" if unsure). Then everyone updates:
```bash
git checkout main
git pull
```
Before starting new work on a branch: `git pull origin main` into it (or `git merge main`).
If conflict: stop and ask Person 1; do not force-push.

## Discord (only for sharing)
Channels/threads as needed: prompts, links, screenshots, decisions, GitHub updates. Decisions that matter are copied into docs/decisions.md. Do not use Discord instead of talking at the table.

## Issue rules
Every issue has: description, role, priority (P1 must / P2 should / P3 stretch), deadline (milestone), Definition of Done, dependencies. Move the card **To Do -> In Progress -> Done** yourself. Use `Blocked` when stuck.
