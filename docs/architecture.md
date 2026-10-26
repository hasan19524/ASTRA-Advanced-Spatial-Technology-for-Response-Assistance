# ASTRA — Architecture (LOCKED)

> **This file is the shared, authoritative record of architecture decisions for everyone on the team.**
> Decided Day 1 (27 Oct 2026). Nothing here changes without an explicit discussion —
> new ideas go to the Parking Lot in [`contracts/requests.md`](../contracts/requests.md), never into code.

---

## 1. Stack (fixed)

| Layer | Tech |
|---|---|
| Frontend | Next.js · React · TypeScript · Tailwind CSS · Zustand |
| Backend | Python · FastAPI · PostgreSQL · Redis · WebSockets |
| AI / Voice | Gnani models — Prisma (STT) · Timbre (TTS) · Evon (LLM), *pending API verification* |
| Maps | Leaflet + OpenStreetMap · Dijkstra route finding |
| Security | JWT auth · backend-enforced RBAC · audit logging |

No Django, no stack swaps, no new frameworks without discussion.

---

## 2. Decisions (AD-1 … AD-12)

| # | Decision | Choice | Consequences |
|---|---|---|---|
| AD-1 | **FE ↔ BE communication** | Direct calls + CORS (`NEXT_PUBLIC_API_URL=http://localhost:8000`) | One typed fetch client in `web/src/api/`. No BFF/proxy layer. WS connects straight to FastAPI. |
| AD-2 | **Token storage** | Access token **in memory (Zustand)** · refresh token **in localStorage** | On reload the access token is gone → silent refresh via `POST /auth/refresh` before the first API call. |
| AD-3 | **Simulation isolation** | Dedicated `sim_*` tables, **no foreign keys into live tables** | Only `app/services/simulation.py` writes them. This is the enforceable proof that simulations never modify live state. |
| AD-4 | **Routing graph** | OSM `nodes`/`edges` tables in Postgres + **adjacency list built in memory at startup** | Dijkstra runs in-process. Weight changes (closures) → rebuild adjacency. Redis is *not* in the routing path. |
| AD-5 | **Frontend structure** | **Layer-based**: `src/components/`, `src/hooks/`, `src/api/`, `src/stores/`, `src/lib/` | Keep collisions low: prefix filenames by module (`IncidentCard.tsx`, `useIncidents.ts`, `incidentStore.ts`). |
| AD-6 | **Docker scope** | **Infra only**: postgres:16 + redis:7 | `docker compose up -d` = data services. `api/` and `web/` run locally with hot reload. |
| AD-7 | **User ↔ role model** | **One role per account** | 5+ seeded accounts, one per role. `users.role` = single enum; permissions derive from role. No role-switcher UI. |
| AD-8 | **Evidence (photo) storage** | **Local `api/uploads/` volume** (gitignored) | Multipart upload → save file → DB stores path/metadata → FastAPI serves it back via a static route. |
| AD-9 | **Backend layout** | `app/routers/` · `app/services/` · `app/models/` · `app/schemas/` · `app/core/` | Routers stay thin; logic lives in services. `core/security.py` = JWT + argon2, `core/deps.py` = `require_permission()`, `core/audit.py` = audit writer. |
| AD-10 | **WebSocket auth** | **`?token=<jwt>` on handshake**, verified before accept | Simpler client code. Known tradeoff: tokens appear in server logs — acceptable for the prototype, noted honestly. |
| AD-11 | **Next.js rendering** | **Client-heavy** — dashboards/map/assistant are `"use client"`; server components only for layout shells | Zustand and WS never run on the server → no RSC hydration bugs. |
| AD-12 | **Tooling** | `ruff` (lint+format) for Python · `pytest` auth contract tests · eslint (present) | `ruff check` before every push. Tests in `api/tests/`. |

**Deferred:** the Gnani API-key spike was postponed; voice integration still targets Day 7. It may
change the *implementation* behind `GnaniClient` / `AssessmentBackend` — never these decisions.

---

## 3. The four-state data model (non-negotiable)

Assessment ≠ poll ≠ verification ≠ response. Four independent axes on one incident:

```
Incident
├─ assessment_status : UNASSESSED | DEFINITELY_FALSE | MAYBE_TRUE   (AI-owned, set once)
├─ visibility        : HIDDEN | PUBLIC_UNVERIFIED                    (derived from above)
├─ verification      : UNVERIFIED | VERIFIED | REJECTED              (Verification Officer-owned)
├─ response_phase    : NONE | COORDINATING | ACTIVE | RESOLVED       (Central Admin-owned)
├─ lifecycle         : OPEN | CLOSED                                 (Central Admin-only)
└─ tasks[]           : each with its own status (OPEN | IN_PROGRESS | DONE)
```

Invariants enforced in the service layer (not by convention):
- `visibility = HIDDEN` iff `assessment = DEFINITELY_FALSE`
- **poll votes never write to `verification`**
- task completion never writes to `lifecycle` — only the Central Admin closes an incident

---

## 4. Repo layout & ownership

```
code/
├─ api/          FastAPI          → owned by A
├─ web/          Next.js          → owned by B
├─ contracts/    openapi.json = LAW · requests.md · generated types.ts → shared
├─ docs/         this file + shared docs → shared
├─ seed/         demo world       → owned by A
└─ scripts/      dev/demo helpers
```

**Contract workflow:** A changes an endpoint → update `contracts/openapi.json` → B runs
`npm run contracts:sync` → TypeScript errors show exactly what moved. No endpoint merges
without regenerating types.

Daily rhythm: 15-min morning sync · 3 bullets each in the daily log · trunk-based, merge same day.

---

## 5. Rules (from the project vision)

1. Authorization is enforced **on the backend** — hiding UI is not security.
2. AI assesses and recommends; it never verifies and never dispatches.
3. Public opinion never determines incident truth.
4. Unverified reports must never be presented as facts.
5. Simulated events never touch live-world data (AD-3 makes this structural).
6. Citizens see public-safe data only; operational data is role-restricted.
7. No new features, modules, or technologies without discussion — use the Parking Lot.

**To propose a change:** add an entry to the Parking Lot in `contracts/requests.md`,
discuss, then update this file *and* the local plan together.
