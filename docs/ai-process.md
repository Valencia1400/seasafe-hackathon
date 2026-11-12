# AI Engineering Log (Prompt-to-Product)

This is our evidence that AI **accelerated** the engineering and that we **verified** it instead of trusting it. Log every meaningful AI use (a line is enough; screenshots go in Discord and are linked here). Owners: Person 3 + Person 5. Everyone adds entries.

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

## Design iteration procedure (use for the R8 showpiece)
Requirement -> AI-generated design -> human review -> physical or simulated test -> revised design -> repeated test.

1. **Requirement:** write the requirement ID and target (e.g. R2: upright <= 5 s, 3/5).
2. **AI-generated design:** prompt the AI with the requirement + parameter table; save the prompt and output (commit as `v1`).
3. **Human review:** Person 1 + Person 4 check dimensions, printability, interfaces; list every issue found (also those the AI missed).
4. **Test:** physical (flotation tub) or simulated (calculation); record in tests/test-results.md.
5. **Revised design:** feed the *measured* result back to the AI, ask for a change, review it, commit as `v2`. State exactly which parameter changed and why.
6. **Repeat test:** same procedure, same conditions. Record before/after numbers.
7. **Log it here** as one linked chain of entries, and add a row to the iteration log in cad/README.md.

## Summary of AI use (update at the end)
| Area | What AI did | What humans verified | Time saved (estimated - say "estimated") |
|---|---|---|---|
| CAD | | | |
| Electronics | | | |
| Testing | | | |
| Docs / pitch | | | |

## Entries

> **The three entries below are EXAMPLES of the format. They are NOT real work that was done.** Delete them when the first real entry is added.

### EXAMPLE-1 - Generate first housing from requirements *(example, not real)*
- Time / person / task: Fri 14:00, Person 1, housing v1
- AI tool + model: (example) an AI assistant
- Prompt: "Write a parametric OpenSCAD model for a floating cylindrical housing, outer diameter 70 mm, wall 2.4 mm, with a compartment of 60x35x25 mm and a ballast cup in the base. Expose all dimensions as variables."
- Result: A model file with the requested variables.
- Human verification: Opened in slicer, measured compartment with a ruler on screen, checked wall >= 2x nozzle width.
- Errors / limitations: Lid did not fit - clearance was zero. AI had not been told about print tolerance.
- Changes made afterwards: Added `lid_clearance` parameter = 0.3 mm; re-prompted with the printer tolerance.
- Linked: R5, R6

### EXAMPLE-2 - Draft flotation test procedure *(example, not real)*
- Time / person / task: Fri 16:00, Person 4 with AI, test procedure
- AI tool + model: (example)
- Prompt: "I am new to engineering. Explain how to test whether a small floating object self-rights, and write a step-by-step procedure with a table for results."
- Result: A 6-step procedure.
- Human verification: Person 1 reviewed it; Person 4 ran a dry-run with a plastic bottle.
- Errors / limitations: Draft suggested testing the powered unit in water - rejected, replaced with unpowered dummy module rule.
- Changes made afterwards: Safety rules added to tests/test-plan.md.
- Linked: R2, R9

### EXAMPLE-3 - Competitor research summary *(example, not real)*
- Time / person / task: Fri 15:00, Person 5, research
- AI tool + model: (example)
- Prompt: "List types of personal and vessel rescue beacons and what they do. Give sources."
- Result: A summary with claims.
- Human verification: Opened each source; removed two claims with no source; marked the rest with link.
- Errors / limitations: AI stated a figure that could not be found in the cited source - removed.
- Changes made afterwards: Only sourced claims kept in docs/research.md.
- Linked: pitch slide 2
