# Daily Worklog & Tasks — how the docs are organised

Two questions, two folders — **never mix them**:

| Folder | Question | Who writes |
|---|---|---|
| [`docs/tasks/<name>/<date>.md`](../tasks/) | *What should I do today?* | Hasan (lead) assigns |
| [`docs/daily/<name>/<date>.md`](.) | *What did I actually do, and how do I verify it?* | each dev, their own file |

```
docs/
├─ tasks/                      ← assignments ("what is my task today")
│  ├─ README.md
│  ├─ hasan/
│  │  ├─ 2026-10-27.md         Day 1  ✅ done
│  │  └─ 2026-10-28.md         Day 2  ← today's tasks
│  └─ lubna/
│     ├─ 2026-10-27.md         missed → folded into the 28th
│     └─ 2026-10-28.md         Day 1+2 combined ← her first session
├─ daily/                      ← worklogs ("what happened")
│  ├─ README.md                ← this file
│  ├─ hasan/
│  │  ├─ 2026-10-27.md         Day 1  ✅ written
│  │  └─ 2026-10-28.md         Day 2  ← filled as Hasan works
│  └─ lubna/
│     └─ 2026-10-28.md         BLANK  ← she fills it after doing the tasks
├─ architecture.md             ← locked decisions (AD-1…18)
└─ research-existing-apps.md   ← real-world precedents + data/keys
```

## 📌 Current day

**Day 2 — 2026-10-28:**

- Hasan's tasks → [`tasks/hasan/2026-10-28.md`](../tasks/hasan/2026-10-28.md)
- Lubna's tasks (Day 1+2) → [`tasks/lubna/2026-10-28.md`](../tasks/lubna/2026-10-28.md)

**Newest date = today.** Pull first, open your own folder.

## Daily file format (worklogs)

```markdown
# Worklog — Day N · <date> · <Name> (<role>)
### Done
- <what> — how it was built + exact command/path to verify it
### In progress
### Blockers
## Decisions made today
- only if they change locked decisions → also update docs/architecture.md
```

## Rules

1. **Write it the same day**, before you sleep. 10 honest bullets beat a perfect essay later.
2. **"How" matters as much as "what"** — include the command, file path, or endpoint that
   proves it works, so the other person can verify without asking.
3. Nobody overwrites another person's file. You write yours, they write theirs.
4. Tasks are assigned only by the lead — if you finish early, pull again; the next task
   file may already be waiting.
5. Anything that changes locked architecture goes in `docs/architecture.md` **and** is
   mentioned in that day's file.
6. **Daily git rhythm (mandatory, both devs):** start every work session with
   `git pull origin main` *before* touching anything, and end it with
   `git add -A && git commit && git push origin main`. Never work on a stale checkout,
   never end a session with unpushed commits.
7. All standing team rules live in `AGENTS.md` at the repo root — read it first; your
   AI agent loads it automatically.
