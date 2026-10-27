# Daily Worklog

**One file per day, named with its date.** Anyone — Hasan, Lubna, or a judge reading the repo —
can open a date and see exactly what was built, how, and by whom.

## 📌 Day index — start here

| Day | Date | File | Status |
|---|---|---|---|
| 1 | 2026-10-27 | [`2026-10-27.md`](2026-10-27.md) | ✅ complete (Hasan) — auth proven, architecture locked |
| 2 | 2026-10-28 | [`2026-10-28.md`](2026-10-28.md) | 🔶 **TODAY'S PLAN — Hasan: Day 2 backend · Lubna: Day 1 + Day 2 frontend** |

**Newest file = today's task list.** Pull first, open it, work your own section.

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
6. **Daily git rhythm (mandatory, both devs):** start every work session with
   `git pull origin main` *before* touching anything, and end it with
   `git add -A && git commit && git push origin main`. Never work on a stale checkout,
   never end a session with unpushed commits — the other person's session begins by
   pulling what you pushed.
7. All standing team rules (git rhythm, quality gates, doc conventions) live in
   `AGENTS.md` at the repo root — read it first; your AI agent loads it automatically.
