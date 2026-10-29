# 📋 Tasks — "What is my task today?"

**Assignment folder.** One file per person per date. The lead (Hasan) writes the tasks,
pushes; each dev pulls at session start and works **only their own folder**.

```
tasks/
├─ hasan/
│  ├─ 2026-10-26.md   ← Day 1 assignment (done)
│  ├─ 2026-10-27.md   ← Day 2 assignment (done)
│  ├─ 2026-10-28.md   ← Day 3 assignment (done)
│  └─ 2026-10-29.md   ← Day 4 assignment (today)
└─ lubna/
   ├─ 2026-10-26.md   ← Day 1 assignment (missed — folded into the 27th)
   ├─ 2026-10-27.md   ← Day 1 + Day 2 combined (done, first session)
   ├─ 2026-10-28.md   ← Day 3 assignment (done)
   └─ 2026-10-29.md   ← Day 4 assignment (today)
```

## 📅 Date mapping (strict scheme — the file's own header is the law)

| Day | Date | Notes |
|---|---|---|
| 1 | 2026-10-26 | |
| 2 | 2026-10-27 | |
| 3 | 2026-10-28 | |
| 4 | 2026-10-29 | ← current |
| 5 | 2026-10-30 | |
| 6 | 2026-10-31 | |
| 7 | 2026-11-01 | |
| 8 | 2026-11-02 | |
| 9 | 2026-11-03 | |
| 10 | 2026-11-04 | |
| 11 | 2026-11-05 | |
| 12 | 2026-11-06 | + buffer after |

**Change log:** 2026-10-28 — files renumbered so Day N ↔ a fixed calendar date (the Day 1–2
files originally carried later dates; a path can therefore have held *different* content across
renames — never infer content from a filename alone, and never re-date a file).

## Rules

1. **The "Current day" pointer in `docs/daily/README.md` names today's files** — pull first,
   open exactly those paths. Never pick by "newest file" heuristics; never trust the system clock
   over the file's header.
2. Tick `- [ ]` → `- [x]` as each task finishes; every task has a **"Done when…"** line —
   that's the proof, not your word. Ticking requires evidence (command + output) in your worklog.
3. Tasks are only moved/edited by the lead — agents treat them as **read-only**. If you finish
   early, say so in your `daily/` log and pull again — the next task file may already be waiting.
4. **What you *did* does not go here** — that goes in `docs/daily/<your-name>/<date>.md`,
   at the exact path printed in your task file.
5. A task file opening with 🩹 = a repair pass: execute it fully before new tasks.

## Relationship to the other folders

| Folder | Question it answers |
|---|---|
| `docs/tasks/<name>/<date>.md` | *What should I do today?* (assignment) |
| `docs/daily/<name>/<date>.md` | *What did I actually do, and how do I verify it?* (worklog) |
| `docs/architecture.md` | *Which decisions are locked?* (never changes silently) |
