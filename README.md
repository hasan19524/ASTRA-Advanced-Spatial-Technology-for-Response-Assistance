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
├─ api/                FastAPI backend        (Day 1+)
├─ web/                Next.js frontend       (Day 1+)
├─ contracts/          API contract (openapi.json → generated TS types)
├─ seed/               Demo world seed script
└─ scripts/            dev/demo helpers
```

> Planning documents live outside this repo by design.

## Getting started (after Day 1 scaffold)

```bash
docker compose up
```

## License

MIT — see [LICENSE](LICENSE)
