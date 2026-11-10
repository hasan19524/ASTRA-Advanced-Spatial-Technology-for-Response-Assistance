# ASTRA — Project Structure

The repository root for development is `code/` (the nested git repo).
`Planning/` one level up stays local and is never pushed.

```
code/                          ← this repository
├─ .github/workflows/ci.yml    ← CI: ruff, pytest, eslint, build, vitest, Playwright
├─ .gitignore                  ← caches, env, secrets, artefacts, logs
├─ AGENTS.md                   ← team workflow rules (pull at start / push at end)
├─ docker-compose.yml          ← db:5433, redis:6379, api:8000 (localhost-only)
├─ render.yaml                 ← Render blueprint (API + Key Value)
├─ LICENSE                     ← MIT
├─ README.md                   ← project README (public landing page)
├─ frontend.log                ← local dev log (gitignored)
├─ scripts/                    ← dev/demo helpers
│  ├─ verify-auth.ps1          ← auth end-to-end (16 checks)
│  ├─ verify-e2e.py            ← full-stack verification script
│  └─ verify-module1.ps1       ← dispatch arc verification (29 checks)
├─ api/                        ← FastAPI backend (owned by backend lead)
│  ├─ app/
│  │  ├─ core/                 config, database (per-loop clients), security,
│  │  │                        deps, permissions, scoping, rate_limit, audit,
│  │  │                        constants
│  │  ├─ models/               19 SQLAlchemy models (users, incidents,
│  │  │                        assessments, poll_votes, verification_events,
│  │  │                        response_tasks, alerts, assist_*, audit_logs,
│  │  │                        sim_runs, map_locations, routing_edges)
│  │  ├─ routers/              18 routers (auth, incidents, tasks, verification,
│  │  │                        poll, alerts, stats, audit, voice, weather,
│  │  │                        geocode, simulation, routing, traffic, assistant,
│  │  │                        org, coordination, map_ws)
│  │  ├─ services/             17 services (routing_service, incident_service,
│  │  │                        assessment_backend, assistant_service,
│  │  │                        simulation_service, weather_service, voice_service,
│  │  │                        task_service, stats_service, media_storage,
│  │  │                        map_ws, incident_state, alert_service,
│  │  │                        poll_service, verification_service,
│  │  │                        evidence_verification, vision_provider)
│  │  └─ main.py               FastAPI entrypoint, lifespan, middleware, /health
│  ├─ alembic/                 migrations at head (9974fb9d202a)
│  ├─ scripts/                 graph_components.py, measure_graph_memory.py
│  ├─ tests/                   130 tests, real Postgres + Redis
│  ├─ requirements.txt
│  └─ requirements-dev.txt
├─ contracts/                  openapi.json = LAW · requests.md · generated types.ts
├─ docs/                       architecture + setup + api + ai-integration +
│                              deployment + project-structure + worklogs
├─ seed/                       seed.py (demo world), seed_osm.py (real OSM graph)
├─ web/                        Next.js frontend (owned by frontend lead)
│  ├─ src/app/(app)/           authenticated routes (dashboard, map, incidents, …)
│  ├─ src/app/(auth)/          login, signup
│  ├─ src/components/          LiveMap, task components, UI primitives
│  ├─ src/api/                 client.ts (typed fetch), openapi-types.ts (generated)
│  ├─ src/stores/              Zustand stores (auth, incidents, alerts, tasks, …)
│  ├─ src/lib/                 constants, mocks (fixtures, handlers)
│  ├─ tests/                   vitest unit tests + Playwright E2E specs
│  ├─ scripts/                 contracts-sync, audits
│  └─ public/                  static assets (svg icons)
└─ artifacts/                  demo videos + scripts (gitignored; link, don't commit)
```

## Ownership

| Directory | Owner | Technology |
|-----------|-------|------------|
| `api/` | Backend lead (Hasan) | Python / FastAPI / SQLAlchemy / asyncpg / Redis |
| `web/` | Frontend lead (Lubna) | Next.js 16 / React 19 / Tailwind 4 / Zustand |
| `contracts/` | Shared | OpenAPI contract (law) |
| `docs/` | Shared | Architecture + operational docs |
| `seed/` | Backend lead | Demo world + real OSM graph seeding |
| `scripts/` | Shared | Dev/demo verification helpers |

## Contract workflow

Backend changes an endpoint → update `contracts/openapi.json` → frontend runs
`npm run contracts:sync` → TypeScript errors show exactly what moved. No
endpoint merges without regenerating types.

## Generated / gitignored artefacts (not committed)

- `api/.env`, root `.env` — real secrets
- `node_modules/`, `.next/`, `build/`, `dist/` — frontend build output
- `__pycache__/`, `.pyc`, `.pytest_cache/`, `.ruff_cache/` — Python caches
- `*.log`, `frontend.log` — logs
- `uploads/`, `media/` — user-uploaded evidence
- `pt*.txt`, `pytest_full.txt`, `_delhi_roads.json` — temporary debug output
- `artifacts/` — large demo videos (link to public video instead)