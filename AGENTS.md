# ASTRA — Agent & Contributor Instructions

> This file is read automatically by AI coding agents (OpenCode, etc.) at the start of
> every session in this repo. Keep it short and current — both **Hasan** and **Lubna**
> work through their own agent, and both must follow the same rules.

## 🔄 Daily Git workflow (MANDATORY — applies to every session)

1. **At session START — pull first, before touching anything:**

   ```powershell
   cd <path-to-repo>        # the folder containing this AGENTS.md
   git pull origin main
   ```

   Check the pulled changes (teammate may have pushed work you must build on top of).
   Never start work on a stale checkout.

2. **At session END — push everything before wrapping up:**

   ```powershell
   git add -A
   git commit -m "<what changed and why>"
   git push origin main
   ```

   Never end a working session with unpushed commits. The teammate's next session starts
   by pulling — if you don't push, they can't see your work.

**Task assignment flow:** the lead (Hasan) pulls, writes/updates today's plan in
`docs/daily/<today>.md`, pushes — then both devs pull and each works **their own section**
of that file. When finishing: pull first (teammate may have pushed), then push again.

- The repo is this folder (nested git repo); `Planning/` one level up stays local forever
  and can never be pushed.
- Local `.env` files are gitignored — never commit secrets. Real keys go in `.env` only.
- If `git push` is rejected, `git pull --rebase origin main`, resolve, push again.

## 📅 Daily work log

Every day gets one file: `docs/daily/YYYY-MM-DD.md` with separate sections for
**Hasan (Backend/AI)** and **Lubna (Frontend/UI-UX)**. Each section states *what* was
done and *how to verify it* (exact commands + file paths), so anyone can re-run it.
Write your own section; never edit the teammate's.

## 🏗️ Build rules

- `docs/architecture.md` is the single source of truth for technical decisions
  (AD-1…AD-18). Read it before changing structure; update it if a decision must change.
- **Gates before any push (AD-12):** `ruff check app tests` clean, `pytest` green,
  `npm run build` clean. Never push red.
- **Prove, don't assume:** after touching auth or API behavior, run
  `powershell -File scripts\verify-auth.ps1` (expects `EXIT=0`, 16/16).
- Stack is locked (Next.js/FastAPI/Postgres/Redis) — no framework swaps without both
  devs agreeing first.
- Zero visible errors in the demo: a broken screen must show an error state, never a
  blank page or console red.

## 📚 Where things are

| What | Where |
|---|---|
| Architecture decisions | `docs/architecture.md` |
| Today's / tomorrow's tasks | `docs/daily/YYYY-MM-DD.md` |
| Real-world research + data/keys | `docs/research-existing-apps.md` |
| API endpoint contract | `contracts/requests.md` |
| Backend (FastAPI) | `api/app/{core,routers,services,models,schemas}` |
| Frontend (Next.js) | `web/src/{components,hooks,api,stores,lib}` |
| Verify auth end to end | `scripts/verify-auth.ps1` |
| Local stack | `docker compose up -d` → `astra-api-1`, `astra-db-1` (host port 5433), `astra-redis-1` |
