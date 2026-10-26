# Daily Worklog

**One file per day, named with its date.** Anyone — Hasan, Lubna, or a judge reading the repo —
can open a date and see exactly what was built, how, and by whom.

## File naming

```
daily/
├─ README.md            ← this file (the format)
├─ 2026-10-27.md        ← Day 1: what happened on 27 Oct 2026
├─ 2026-10-28.md        ← Day 2: plan + what happened
└─ ...
```

Format: `YYYY-MM-DD.md` (ISO date, sorts chronologically, zero ambiguity).

## File format (copy this every day)

```markdown
# Day N — <date> · <focus of the day>

## Hasan (Backend / AI)
### Done
- **<what>** — how it was built, key files, commands to reproduce/verify
### In progress
### Blockers

## Lubna (Frontend / UI/UX)
### Done
### In progress
### Blockers

## Decisions made today
- Only if they change/extend locked decisions → also update docs/architecture.md

## Plan for tomorrow
- Or: "see daily/YYYY-MM-DD.md" if tomorrow's file already exists
```

## Rules

1. **Write it the same day**, before you sleep. 10 honest bullets beat a perfect essay later.
2. **"How" matters as much as "what"** — include the command, file path, or endpoint that
   proves it works, so the other person can verify without asking.
3. Nobody overwrites another person's section. You write yours, they write theirs.
4. If a day's file doesn't exist yet, that work hasn't been logged — check `git log`.
5. Anything that changes locked architecture goes in `docs/architecture.md` **and** is
   mentioned in that day's file.
