# ASTRA — Advanced Spatial Technology for Response Assistance

**Autonomous Spatial Intelligence & Simulation Platform**

A unified, role-based platform connecting citizens, AI-assisted incident reporting, live maps & navigation, independent incident verification, emergency response coordination, and disaster simulations.

> Prototype of the full product vision — breadth over depth, but zero visible errors.

## Modules

1. **Reporting & Incident Management** — text/photo/voice reports → AI assessment (*Definitely False* / *Maybe True*) → public poll → independent verification → coordinated response
2. **AI Assistance** — conversational voice assistant (STT → reasoning → TTS)
3. **Maps & Navigation** — live incident map, Dijkstra routing, voice turn-by-turn
4. **Simulations** — public & operational scenario modes on isolated hypothetical state

## Roles

Citizen · Central Admin · Department Head · Response Team Member · ASTRA Verification Officer — all permissions enforced **on the backend**.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js · React · TypeScript · Tailwind CSS · Zustand |
| Backend | Python · FastAPI · PostgreSQL · Redis · WebSockets |
| AI / Voice | Gnani models (Prisma STT · Timbre TTS · Evon LLM) — pending API verification |
| Maps | Leaflet + OpenStreetMap · Dijkstra route finding |
| Security | JWT auth · backend-enforced RBAC · audit logging |

## Repository layout

```
code/                  ← this repository
├─ AGENTS.md           Team rules — read first (your AI agent loads it automatically)
├─ api/                FastAPI backend        (Day 1+)
├─ web/                Next.js frontend       (Day 1+)
├─ contracts/          API contract (openapi.json → generated TS types)
├─ docs/               Shared team docs — architecture decisions are LOCKED here
├─ seed/               Demo world seed script
└─ scripts/            dev/demo helpers
```

> 📌 Start here: **[docs/architecture.md](docs/architecture.md)** — the locked architecture
> both engineers build against. Planning notes live outside this repo by design.

## Daily workflow & team rules

Full standing rules: **[AGENTS.md](AGENTS.md)** (loaded automatically by both devs' AI
agents). The two that matter every day:

1. **Session start →** `git pull origin main` before doing anything.
2. **Session end →** `git add -A && git commit && git push origin main`.

Plus: quality gates must be green before any push — `ruff check app tests`, `pytest`,
`npm run build`, and `powershell -File scripts\verify-auth.ps1` (expect `EXIT=0`).
Every day is logged in [docs/daily/](docs/daily/) — each dev writes their own section
with exact verification commands.

## Getting started (after Day 1 scaffold)

```bash
docker compose up
```

## License

MIT — see [LICENSE](LICENSE)
