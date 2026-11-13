# Requirements

> **Status: brief received Friday (our notes from the opening talk).** Section 1 is our paraphrase, not official text - correct it against any written brief. Section 2 is written after the concept is chosen (see [concepts.md](concepts.md)).

## 1. Official brief and judging criteria (from the opening talk, Fri 13 Nov - Owner: Person 3)
Presenters: Saab Naval and Marine Technology Center (MTC) - Dr Per Skarin, Jakob Nielsen, Björn Lindkvist.

| Item | What they said (our notes) | Impact on our plan |
|---|---|---|
| Challenge statement | Prompt-to-Product: use modern AI and show how far you can get. **Set your own requirements** and take a concept as far as possible. Any product: on the surface, below the surface, or "in a box". | We choose the problem ourselves, but must justify the choice |
| What they evaluate | (1) **The path, not only the result:** the steps taken, how we validated, the problems and bumps on the road and how we solved them, which tools. (2) **Why we chose** the concept (rationale). (3) Examples of **sensors or technologies** used. (4) How the team **uses its different competencies**. | Log decisions, problems and AI use continuously; every role must be visible in the pitch |
| Pitch must end with | What we could do with **more time, research, money, physical research or a test environment** | Keep a running "next steps / needs" list from the start |
| Physical prototype | "Do not expect us to produce" - but showing one "would be great" | A working printed prototype is a strong differentiator; the process story is required regardless |
| Relevant MTC core areas | Signature management; naval architecture; energy and propulsion; structures and materials; safety and rescue; sensor and weapons integration; automation and autonomy. Lately also **combat systems** (integrating all sensors on a vessel). | Pick a concept that clearly lands in one or two areas |
| Context they mentioned | MTC: triple helix with BTH, SMEs and Karlskrona; test sites (e.g. a fishery site) used by the Royal Swedish Navy, Sweden and NATO. A Copenhagen Prompt-to-Product team won with a 3D-printed moving mechanism that **swapped a drone's battery**, shown live on stage. | A moving, printed mechanism demoed live is proven to land well |
| Collaboration | They invest the weekend because they may **continue the work with us** afterwards | Pitch a credible roadmap, not just a demo |
| Presentation time limit | Not noted - ask | |
| Deliverable / submission rules | Jury Room (Campor) - confirm format | |
| Available equipment (printers, materials) | Not noted - ask | Decides print size and materials |
| Mentor contacts | The three presenters above | Ask them to sanity-check our concept today |
| Deadlines (freeze, submission) | Not noted - ask | |

**Brief-change procedure:** (1) paste the official text above, (2) Person 3 and Person 5 mark what changes, (3) record it in `docs/decisions.md`, (4) update the table below and the issues, (5) announce at the next checkpoint.

## 2. Product requirements (write after the concept is chosen)
Priority: **M** = must (demo fails without it), **S** = should, **C** = could (stretch). Every M requirement needs a test we can run **today or Saturday**.

| ID | Requirement | Measurable target | Pri | Test | Status |
|---|---|---|---|---|---|
| R1 | | | M | T-R1 | Not tested |
| R2 | | | M | T-R2 | Not tested |
| R3 | Printable | STL loads in a slicer with no blocking errors; fits the bed; print time < 3 h | M | T-R3 | Not tested |
| R4 | One genuine design improvement | v1 test result -> change -> v2 retest, with a measured difference | S | T-R4 | Not tested |
| R5 | Evidence is honest | Every requirement marked pass / fail / not tested with evidence | M | T-R5 | Not tested |

## 3. Explicit non-goals
- Not certified; no claim of compliance with any standard.
- No invented statistics, costs, military requirements or test outcomes.

## 4. Assumptions to confirm
- Printer type, materials, bed size and queue time at the venue.
- What tools and materials are available for assembly and testing.
