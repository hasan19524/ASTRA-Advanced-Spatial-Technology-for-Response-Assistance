# 📋 Tasks — "What is my task today?"

**Assignment folder.** One file per person per date. The lead (Hasan) writes the tasks,
pushes; each dev pulls at session start and works **only their own folder**.

```
tasks/
├─ hasan/
│  ├─ 2026-10-26.md   ← Day 1 assignment (done)
│  ├─ 2026-10-27.md   ← Day 2 assignment (done)
│  └─ 2026-10-28.md   ← Day 3 assignment (today)
└─ lubna/
   ├─ 2026-10-26.md   ← Day 1 assignment (missed — folded into the 27th)
   ├─ 2026-10-27.md   ← Day 1 + Day 2 combined (done, first session)
   └─ 2026-10-28.md   ← Day 3 assignment (today)
```

## Rules

1. **Newest date = today's task list.** Pull first, open `your-folder/<today>.md`.
2. Tick `- [ ]` → `- [x]` as each task finishes; every task has a **"Done when…"** line —
   that's the proof, not your word.
3. Tasks are only moved/edited by the lead. If you finish early, say so in your
   `daily/` log and pull again — the next task file may already be waiting.
4. **What you *did* does not go here** — that goes in `docs/daily/<your-name>/<date>.md`.

## Relationship to the other folders

| Folder | Question it answers |
|---|---|
| `docs/tasks/<name>/<date>.md` | *What should I do today?* (assignment) |
| `docs/daily/<name>/<date>.md` | *What did I actually do, and how do I verify it?* (worklog) |
| `docs/architecture.md` | *Which decisions are locked?* (never changes silently) |
