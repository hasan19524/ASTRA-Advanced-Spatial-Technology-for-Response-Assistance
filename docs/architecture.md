# ASTRA — Architecture (LOCKED)

> **This file is the shared, authoritative record of architecture decisions for everyone on the team.**
> Decided Day 1 (27 Oct 2026). Nothing here changes without an explicit discussion —
> new ideas go to the Parking Lot in [`contracts/requests.md`](../contracts/requests.md), never into code.
> Day-to-day workflow rules (pull at session start / push at session end, quality gates) live in
> [`AGENTS.md`](../AGENTS.md) — same source for both devs.

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

## 2. Decisions (AD-1 … AD-22)

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

### Domain decisions (AD-13 … AD-22)

| # | Decision | Choice | Consequences |
|---|---|---|---|
| AD-13 | **Demo geography** | **Delhi NCR** | OSM extract centered on Delhi (28.6139°N, 77.2090°E) incl. Noida/Gurugram/Ghaziabad. Seed incidents, routes, alerts, and map viewport are NCR-scoped. |
| AD-14 | **Departments (7)** | Police · Fire & Rescue · Medical/EMS · Transport & Roads · Disaster Management · Electricity/Utilities · Water & Drainage | Seed: 1 Department Head + 2 response team members per department (≈15 accounts) + admin + officers + citizens. Dashboards and assignment UI cover all 7. |
| AD-15 | **Incident categories (8)** | Fire · Accident · Flood/Waterlogging · Structural collapse · Medical emergency · Crime/Safety · Utility outage · Hazard/Other | Report form = category picker; map pin styling + department suggestion per category. Paired with the **sensitivity rule** below. |
| AD-16 | **Voice languages** | **All Indian languages Gnani supports** — no hardcoding | Backend passes BCP-47 codes through to STT/TTS untouched; frontend exposes a language selector on voice features; seed carries multilingual samples. UI chrome stays English (no i18n framework in scope). |
| AD-17 | **API prefix** | **`/api/v1/...`** | Business routers mounted under `/api/v1`; `/health` stays bare; OpenAPI remains the contract. |
| AD-18 | **Poll eligibility** | **Every public UNVERIFIED incident** | Poll opens automatically with public publication — closes the "eligible" gap vision.md never defined. Restricted incidents aren't public → never polled. |
| AD-19 | **Incident read visibility** | List/detail require a token. Rows with `sensitivity=RESTRICTED` **or** `visibility=HIDDEN` exist only for `incident.view_restricted` holders (Central Admin + Verification Officer); everyone else gets **absence from lists and 404 by id — never 403** | Existence stays secret; no probing for hidden reports. One predicate in `incident_service` serves list *and* detail (`scoping.py`-style, like tasks). |
| AD-20 | **Live map channel** | `ws://…/ws/map?token=<jwt>` (no `/api/v1` prefix) + **Redis pub/sub topic `incidents:map`**; envelopes `connected`, `incident.created` and `incident.updated` (Day 4, AD-23) with `IncidentOut`; publish only while `visibility=PUBLIC_UNVERIFIED AND sensitivity=PUBLIC` | Redis decouples creation from fan-out (any number of map clients). WS is an enhancement: publish failures are logged, never fail a submission. |
| AD-21 | **Duplicate grouping v1** | Attach report to parent: same `region`, ≤ 30 min old, ≥ 50% token overlap on title+description, parent not `DEFINITELY_FALSE` → 201 with the **parent's** `IncidentOut` + `grouped: true` | No duplicate incident rows ever (vision §D); `report_count` grows; reports/evidence retained. Exact-string region match v1 - Day 6 can add geo distance. |
| AD-23 | **Verification transitions (Day 4)** | `UNVERIFIED -> VERIFIED | REJECTED`, `REJECTED -> UNVERIFIED` (reopen); `VERIFIED` is terminal; `REJECTED -> VERIFIED` directly refused (two auditable events); no-op changes refused. `reason` required for REJECTED and reopen. Events append-only. | `incident.verify` holders only. Verification never writes assessment/visibility/lifecycle/poll. `incident.updated` WS envelope fires on flip for publicly visible incidents. |
| AD-22 | **Assessment stub** | Deterministic **3 ordered rules** (outside-NCR region → DF · keyword blacklist → DF · trusted-reporter whitelist → MT · else MT), every row `backend="rules_stub"` + reason | Runs on every `POST /incidents` before commit; DF flips HIDDEN+CLOSED via the state machine (AD-19 makes it invisible immediately). Lists are pinned by tests — growing them is a contract change. |

### Sensitivity rule (AD-15 addendum — closes a vision.md gap)

> *"Not all data should be directly updated to the map — some are sensitive."*

Every report carries `sensitivity: PUBLIC | RESTRICTED`.

- **PUBLIC** → normal Maybe-True flow: public map, poll opens, UNVERIFIED badge.
- **RESTRICTED** → **withheld from the public map entirely**; visible only to authorized roles
  (Admin / Verification Officer / relevant department). Still assessed, verified, and responded
  to normally — response is never blocked by secrecy. No public poll (it isn't public).
- Default per category lives in seed config (e.g. Crime/Safety likely RESTRICTED); an authorized
  user can override a report's sensitivity, and every change is audit-logged.

**Implementation note (Day 2):** axis purity (§3) is never overwritten — a RESTRICTED report
*keeps* `visibility=PUBLIC_UNVERIFIED`. The public map query is
`visibility = 'PUBLIC_UNVERIFIED' AND sensitivity = 'PUBLIC'`, so restriction is enforced at
query time, not by mutating another axis. Seed ships 2 RESTRICTED incidents this way.

This makes vision.md's promise enforceable instead of aspirational: *citizens see public-safe
information; sensitive operational detail is restricted.*

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
