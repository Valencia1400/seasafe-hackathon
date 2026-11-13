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
Person 3 updates the status table in README.md. **Nobody stays blocked > 30 minutes** - say it out loud.

Rule of the weekend: **no stretch work until that day's essentials are Done.**

## Friday / Saturday plan
See [start-here.md](start-here.md): first steps per person, and the Friday and Saturday Definition of Done. Sunday: rehearse twice, readiness checklist ([demo-script.md](../presentation/demo-script.md)), present, Q&A. No new features.

## Git workflow (simple)
- `main` = stable. Only technical members merge; beginners edit docs in the browser.
- Branches: `feature/cad`, `feature/electronics`, `feature/dashboard`. Docs/tests/presentation edits can go straight to `main` through the browser (small edits only).
- Each person only edits **their own folder** (see README map).

### Edit docs in the GitHub browser (beginners: Persons 4 and 5)
1. Open the repo on github.com, click the file (e.g. `tests/test-results.md`).
2. Click the pencil icon (Edit).
3. Type your change. Tables: copy a row and fill it in.
4. Click **Commit changes**, write a short message, choose **Commit directly to the main branch**, click **Commit changes**.
5. If GitHub says someone else changed the file: copy your text, reload the page, paste it again, commit again.

### Technical members (command line)
```bash
git clone https://github.com/<owner>/seasafe-hackathon.git
cd seasafe-hackathon
git checkout -b feature/cad        # first time (or: git checkout feature/cad)
# ...edit files in your own folder...
git add cad/
git commit -m "CAD: add hull v1"
git push -u origin feature/cad
```
Open a pull request on GitHub, base = `main`. Keep PRs small. Person 1 reviews and merges. Then everyone updates:
```bash
git checkout main
git pull
```
If conflict: stop and ask Person 1; do not force-push.

## Discord (only for sharing)
Prompts, links, screenshots, decisions. Decisions that matter are copied into docs/decisions.md.

## Issue rules
Every issue has: description, role, priority (P1 must / P2 should / P3 stretch), deadline, Definition of Done, dependencies. Move it **To Do -> In Progress -> Done** yourself.
