# Personal AI logs (raw)

One file per person, e.g. `angelo.md`. These are raw, automatic records of AI use, kept as evidence.

- **Who writes here:** the `ai-logger` mod in Claude Code appends one entry per prompt to *your own* file. Set your name once with `/ai-log-name <name>`; check with `/ai-log`.
- **Without the mod** (ChatGPT, Cursor, phone, etc.): add entries by hand to your own file, using the template in [`../ai-process.md`](../ai-process.md).
- **Fill in the TODO lines** (human verification, errors, changes afterwards) soon after: that is what the judges care about.
- **Never edit someone else's file.** Each person only appends to their own, so there are no merge conflicts (`.gitattributes` also tells Git to keep both sides if two branches add entries).
- **Secrets:** the mod masks passwords, API keys and tokens, but never paste secrets into a prompt in the first place.
- **Curated log:** the best, most relevant entries are copied into [`../ai-process.md`](../ai-process.md) by Persons 3 and 5. That file is the one we show.
