# AI Engineering Log (Prompt-to-Product)

This is our evidence that AI **accelerated** the engineering and that we **verified** it instead of trusting it. Log every meaningful AI use (a line is enough; screenshots go in Discord and are linked here). Owners: Person 3 + Person 5. Everyone adds entries.

## Raw logs vs. this file
Raw, per-person records go in [`ai-log/`](ai-log/README.md) (automatic with the `ai-logger` mod in Claude Code, by hand otherwise). This file is the **curated** log: Persons 3 and 5 copy the meaningful entries here, with verification filled in.

## How to log an entry
Copy the template, fill it in right after the AI use. Be honest about errors - mistakes caught are the best evidence.

```
### AI-### - <short title>
- Time / person / task:
- AI tool + model:
- Prompt (paste or link):
- Result (what the AI produced):
- Human verification (what we checked and how - measurement, test, review by whom):
- Errors / limitations found:
- Changes made afterwards:
- Linked requirement / issue / commit:
```

## Design iteration procedure (use for the R11 showpiece)
Requirement -> AI-generated design -> human review -> physical or simulated test -> revised design -> repeated test.

1. **Requirement:** write the requirement ID and target.
2. **AI-generated design:** prompt the AI with the requirement + parameter table; save the prompt and output (commit as `v1`).
3. **Human review:** the owner (P1 for CAD, P2 for firmware, P3 for dashboard) plus Person 4 review it; list every issue found (also those the AI missed).
4. **Test:** physical or simulated; record in tests/test-results.md.
5. **Revised design:** feed the *measured* result back to the AI, ask for a change, review it, commit as `v2`. State exactly which parameter changed and why.
6. **Repeat test:** same procedure, same conditions. Record before/after numbers.
7. **Log it here** as one linked chain of entries, and add a row to the iteration log in cad/README.md.

## Summary of AI use (update at the end)
| Area | What AI did | What humans verified | Time saved (estimated - say "estimated") |
|---|---|---|---|
| CAD | | | |
| Firmware (ESP32) | | | |
| Dashboard (Pi) | | | |
| Testing | | | |
| Docs / pitch | | | |

## Entries

> **The entry below is an EXAMPLE of the format. It is NOT real work that was done.** Delete it when the first real entry is added.

### EXAMPLE-1 - First CAD part from a requirement *(example, not real)*
- Time / person / task: Fri 14:00, Person 1, part v1
- AI tool + model: (example) an AI assistant
- Prompt: "Write a parametric OpenSCAD model for <part> with these dimensions as variables: ... Print time must stay under 3 hours."
- Result: A model file with the requested variables.
- Human verification: Opened in slicer, checked dimensions and print time, checked wall >= 2x nozzle width.
- Errors / limitations: Two parts did not fit - clearance was zero. The AI had not been told about print tolerance.
- Changes made afterwards: Added a `clearance` parameter = 0.3 mm; re-prompted with the printer tolerance.
- Linked: R2, R3, R11
