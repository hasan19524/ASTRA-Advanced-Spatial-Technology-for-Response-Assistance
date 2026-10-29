# Daily Worklog & Tasks — how the docs are organised

Two questions, two folders — **never mix them**:

| Folder | Question | Who writes |
|---|---|---|
| [`docs/tasks/<name>/<date>.md`](../tasks/) | *What should I do today?* | Hasan (lead) assigns |
| [`docs/daily/<name>/<date>.md`](.) | *What did I actually do, and how do I verify it?* | each dev, their own file |

```
docs/
├─ tasks/                      ← assignments ("what is my task today")
│  ├─ README.md                ← date-mapping table + rules live here
│  ├─ hasan/
│  │  ├─ 2026-10-26.md         Day 1  ✅ done
│  │  ├─ 2026-10-27.md         Day 2  ✅ done
│  │  ├─ 2026-10-28.md         Day 3  ✅ done
│  │  └─ 2026-10-29.md         Day 4  ← today's tasks
│  └─ lubna/
│     ├─ 2026-10-26.md         missed → folded into the 27th
│     ├─ 2026-10-27.md         Day 1+2 combined  ✅ done
│     ├─ 2026-10-28.md         Day 3  ✅ done
│     └─ 2026-10-29.md         Day 4  ← today's tasks (opens with 🩹 repair pass)
├─ daily/                      ← worklogs ("what happened")
│  ├─ README.md                ← this file (worklog template lives here)
│  ├─ hasan/
│  │  ├─ 2026-10-26.md         Day 1  ✅ written
│  │  ├─ 2026-10-27.md         Day 2  ✅ written
│  │  ├─ 2026-10-28.md         Day 3  ✅ written
│  │  └─ 2026-10-29.md         Day 4  ← filled in as Hasan works
│  └─ lubna/
│     ├─ 2026-10-27.md         Day 1+2  ✅ written
│     ├─ 2026-10-28.md         Day 3  ✅ written
│     └─ 2026-10-29.md         Day 4  ← filled in as Lubna works
├─ architecture.md             ← locked decisions (AD-1…AD-23)
└─ research-existing-apps.md   ← real-world precedents + data/keys
```

## 📌 Current day

**Day 4 — 2026-10-29 (Assessment + Poll + Verification):**

- Hasan's tasks → [`tasks/hasan/2026-10-29.md`](../tasks/hasan/2026-10-29.md)
- Lubna's tasks → [`tasks/lubna/2026-10-29.md`](../tasks/lubna/2026-10-29.md) (opens with 🩹 repair pass)

**Pull first, open exactly these paths.** Dates follow the strict Day N ↔ date table in
[`tasks/README.md`](../tasks/README.md) — the file's own header is the law, never the system clock.

## Worklog template (mandatory sections — write every one)

```markdown
# Worklog — Day N · <date> · <Name> (<role>)
> Task file: docs/tasks/<name>/<date>.md — <all boxes ticked / list what's left>
> git: <start SHA> → <end SHA>  |  pushed: yes/no

## Session timeline        (ordered bullets — one unit of work each, with file paths)
## Files touched           (every path created/modified + a one-line why)
## Verification log        (exact commands + their ACTUAL output — "pytest → 61 passed",
                           never "tests pass"; paste the proof)
## Mock vs REAL            (per feature: real API / WS / mock — explicit; anything never
                           proven on the real stack = UNPROVEN, say so)
## Decisions & assumptions (anything you chose autonomously — flag it; undecided
                           decisions belong to the human, never assume)
## Problems hit + fixes    (the "cost me an hour" gotchas — root cause, not symptoms;
                           these save your teammate a day)
## Environment state EOD   (containers up? ports? seed? web/.env? git SHA clean/pushed?)
## Integration status      (proven end-to-end vs waiting on the teammate)
## Blockers                (only real ones — clear a stale blocker the moment it's false)
```

## Rules

1. **Write it the same day**, before you sleep. 10 honest bullets beat a perfect essay later —
   but every section of the template above must appear, even if just "none today".
2. **Evidence-first (hard rule):** every "done/green/verified" claim carries the exact command
   and its actual output. "Tests pass" is not evidence — `pytest → 61 passed` is. Mock data
   never counts as verification; declare mock-vs-real for every feature.
3. **Stale info is a bug:** a blocker you resolved, a gate you completed — update it the same
   session. Contradicting sections (Blockers saying "down" while Gates say "verified") cost us
   a day of diagnosis on Day 3.
4. Nobody overwrites another person's file. You write yours, they write theirs.
5. Tasks are assigned only by the lead — task files are **read-only for agents**; if you finish
   early, pull again; the next task file may already be waiting.
6. Anything that changes locked architecture goes in `docs/architecture.md` **and** is
   mentioned in that day's file.
7. **Daily git rhythm (mandatory, both devs):** start every work session with
   `git pull origin main` *before* touching anything, and end it with
   `git add -A && git commit && git push origin main`. Never work on a stale checkout,
   never end a session with unpushed commits.
8. **Dates are law:** header date = filename date = worklog date, taken from the task file,
   never from the system clock. Never re-date, rename, or "correct" a doc — ask instead.
9. All standing team rules live in `AGENTS.md` at the repo root — read it first; your
   AI agent loads it automatically.
