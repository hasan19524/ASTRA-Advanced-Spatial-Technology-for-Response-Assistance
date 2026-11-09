# ASTRA — Advanced Spatial Technology for Response Assistance

![ASTRA logo](docs/assets/logo.svg)

> **A unified, role-based emergency-response platform for Delhi-NCR.** Citizens report incidents, an AI assistant triages them, officers verify, response teams coordinate — all over a real OpenStreetMap road graph, with honest degraded states and no dummy data.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2016-black)](web/)
[![FastAPI](https://img.shields.io/badge/backend-FastAPI-blue)](api/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791)](api/)
[![Redis](https://img.shields.io/badge/cache-Redis-DC382D)](api/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2442cf)](web/tests/)
[![pytest](https://img.shields.io/badge/backend%20tests-pytest-3776AB)](api/tests/)
[![Gnani AI](https://img.shields.io/badge/AI-Gnani%20Prisma%20STT-3b82f6)](api/app/services/voice_service.py)

## Table of contents

## About ASTRA

**ASTRA** (Advanced Spatial Technology for Response Assistance) is an emergency-response platform for Delhi-NCR that connects citizens, AI-assisted incident reporting, live maps and navigation, independent incident verification, emergency response coordination, and disaster simulations.

**The problem.** During an emergency — a fire, flood, structural collapse, or medical crisis — citizens need to report what they see, and responders need to verify, prioritize, and dispatch quickly. Existing incident-management tools often centralize control in a single call center, delay verification, show maps with dummy pins instead of real road networks, or fabricate analytics rather than counting from live data.

**Our solution.** ASTRA is role-based and backend-enforced:

- **Citizens** file text/photo/voice reports with geolocation. Every report is assessed automatically (rules or LLM) and, until verified, shown publicly as *PUBLIC_UNVERIFIED*.
- **AI assistant** (Gnani Prisma STT, Groq → OpenRouter → NVIDIA chain, honest rules fallback) answers operational questions and tells you which engine answered.
- **Verification Officers** own an append-only verification queue — VERIFIED / REJECTED with reasons, never fabricated.
- **Department Heads** manage tasks for their own department only; **Response Teams** see only tasks assigned to them.
- **Central Admin** coordinates phases strictly `NONE → COORDINATING → ACTIVE → RESOLVED` and closes incidents only when all tasks are DONE.

Everything runs over a **real** OpenStreetMap road graph of Delhi-NCR (406,154 nodes, 879,902 directed edges, Dijkstra routing) with honest degraded states — live traffic and team GPS are disclosed as unavailable when no provider key or position field exists, never faked.

**Target users.** Citizens reporting emergencies; Verification Officers validating reports; Department Heads and Response Teams coordinating dispatch; Central Admins overseeing city-wide operations.

## Core features

| Feature | Status | What is actually built |
|---|---|---|
| Incident reporting | Implemented | Text + optional photo reports via real `POST /api/v1/incidents` (multipart), client-side validation, geolocation, NCR-center fallback disclosed as default |
| Image evidence intelligence | Implemented | Deterministic Pillow validation (black/white/blank/blur/corrupt/low-res/duplicate) + hosted vision AI (`POST /api/v1/evidence/analyze`) behind a modular `VisionProviderInterface` (OpenAI gpt-4o default, Gemini stub); structured output with honest "undetermined" authenticity; rejected images never invalidate the report |
| Speech-to-text | Implemented | Gnani Prisma STT via `POST /api/v1/voice/stt`; browser audio recorded as OGG, transcoded to WAV server-side before forwarding; transcript inserted into report description |
| Gnani AI integration | Implemented (partial) | Prisma STT is live in the product path (report form → transcript → persisted incident). Timbre TTS now has a UI consumer ("Listen" on assistant answers) and returns WAV via `POST /api/v1/voice/tts`. Evon LLM is not integrated |
| AI-assisted verification | Implemented | Deterministic rules stub with 4 ordered rules (out-of-NCR, blacklist keyword, trusted reporter, absence-is-not-evidence) + multi-provider LLM fallback chain with honest `backend` label in every `assessments` row |
| Public verification & polling | Implemented | One-vote-per-user enforced by DB unique constraint; polls never write verification status; separate axes kept honest |
| Officer/admin verification | Implemented | Append-only verification queue, reject-requires-reason, one-way transitions, `VERIFIED` terminal, `REJECTED→VERIFIED` refused |
| Live incident map | Implemented | Leaflet + real OSM raster tiles (no API key), real incident pins colored by verification status, real Dijkstra polyline, "Locate me", honest "no route between these points" for disconnected pairs; live TomTom traffic overlay (toggle layer, current vs free-flow speed, congestion ratio) |
| Emergency assistance | Implemented | Multi-provider LLM chain (Groq → OpenRouter → NVIDIA → rules stub), provider attribution on every reply, conversation storage |
| Simulation engine | Implemented | Documented heuristic (PL-14): affected area, population estimate, infrastructure count, damage estimate — labeled "Not a real forecast", runs on isolated `sim_*` tables with no FKs into live data |
| Route optimization | Implemented | Dijkstra over travel time on the real OSM graph; `/route/nearest` snaps to routable junctions; closed edges genuinely impassable |
| Team management | Implemented | Canonical 7 departments enforced server-side (422 otherwise), task create/assign/patch, role-scoped task lists |
| Emergency deployment | Partially implemented | Task lifecycle `OPEN→IN_PROGRESS→DONE`, phase ladder `NONE→COORDINATING→ACTIVE→RESOLVED`, close-refused-when-open-tasks; road-closure operator API not yet built |
| Admin dashboard | Partially implemented | Real audit log, departments, stats counted from DB, role-gated; category breakdown widget and response-team cards were fixed to stop claiming "not built yet" |


- [About ASTRA](#about-astra)
- [Core features](#core-features)
- [System architecture](#system-architecture)
- [Engineering deep dive](#engineering-deep-dive)
- [Engineering challenges and how we solved them](#engineering-challenges-and-how-we-solved-them)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Installation and local development](#installation-and-local-development)
- [Environment variables](#environment-variables)
- [API documentation](#api-documentation)
- [Testing and quality assurance](#testing-and-quality-assurance)
- [Security considerations](#security-considerations)
- [Deployment architecture](#deployment-architecture)
- [Roadmap](#roadmap)
- [Team and contributions](#team-and-contributions)
- [Acknowledgements](#acknowledgements)
- [License](#license)
## System architecture

### Frontend architecture

Next.js 16 App Router, React 19, Tailwind CSS 4, Zustand v5 state management, Leaflet 1.9.4 for the map. Every route is a client component (`use client`) backed by a hand-written typed fetch client (`web/src/api/client.ts`) that attaches `Authorization: Bearer <access>`, performs one silent token refresh on 401, and maps non-OK responses to `HttpError`. The OpenAPI contract (`contracts/openapi.json`) is regenerated into `web/src/api/openapi-types.ts` via `web/scripts/contracts-sync.mjs` — schemas only, no generated client. No mocks are used in production (`NEXT_PUBLIC_USE_MOCKS` unset).

### Backend architecture

FastAPI with thin routers (`api/app/routers/`) delegating to service modules (`api/app/services/`), SQLAlchemy 2.0 async ORM + asyncpg against PostgreSQL 16, Redis for rate limiting and WebSocket pub/sub. Routers contain no SQL — validation in Pydantic schemas, logic in services. Alembic migrations at head (`9974fb9d202a`), production never uses `metadata.create_all`.

### Database architecture

19 tables, UUIDv4 string PKs, timezone-aware timestamps. Key tables:

- `users` — id, email (unique, indexed), full_name, password_hash (Argon2id), role, department, is_active, created_at
- `incidents` — title, description, category, region, sensitivity, assessment_status, visibility, verification, response_phase, lifecycle, latitude, longitude, location_text, reported_by, created_at, updated_at
- `incident_reports` — incident_id, reporter_id, content, media_path, source (TEXT|PHOTO), created_at
- `assessments` — incident_id, backend (RULE|LLM|EVON), outcome, confidence, model, reason, created_at — `backend` is the truth of who decided, never rewritten by fallback
- `poll_votes` — incident_id, voter_id, vote (boolean), `UNIQUE(incident_id, voter_id)` — one vote per user
- `verification_events` — incident_id, officer_id, action, reason, created_at — append-only
- `response_tasks` / `task_updates` / `assignments` — task board with `UniqueConstraint(task_id, assignee_id)`
- `alerts` / `user_alert_prefs` — alert center with per-user preferences
- `assist_conversations` / `assist_messages` — assistant conversation storage
- `audit_logs` — actor_id (no FK, survives account changes), action, path, resource_id, status_code, ip, created_at — append-only
- `sim_runs` — structurally isolated (`sim_*` tables, zero FKs into live tables)
- `map_locations` / `routing_edges` — 406,154 nodes + 879,902 edges from real OSM; forward-star flat arrays loaded at runtime

### Redis

Rate-limit counters (`rl:*` keys, per IP per endpoint), WebSocket pub/sub channels (`incidents:map`, `alerts`), fail-open when Redis is down.

### Real-time communication

Two WebSocket channels: `/ws/map` (incident created/updated fan-out, query-string JWT auth, 4401 close before accept for unauth sockets) and `/ws/alerts` (implemented server-side, not yet consumed by the client). Per-connection forwarder tasks reading Redis pub/sub, cancelled and awaited on disconnect.

### AI integration

- **Gnani Prisma STT:** `POST https://api.vachana.ai/stt/v3`, multipart `audio_file` + `language_code`, header `X-API-Key-ID` (not Bearer), 90 s timeout, one retry on HTTP 504. Response JSON parsed for `transcript`, persisted as incident description.
- **Gnani Timbre TTS:** `POST /api/v1/tts/inference`, JSON body, raw WAV bytes proxied to client; no UI consumer yet.
- **Assistant LLM:** Groq → OpenRouter → NVIDIA chain, each with `Authorization: Bearer`, 8 s timeout, all-failed → `rules_stub`. Provider label returned in every `{"reply", "provider"}` response so the UI never presents a canned string as LLM output.
- **Incident assessment:** same chain, degrades to rules; `backend` column records the truth.

### External APIs

| Service | Purpose | Auth | Key needed? |
|---|---|---|---|
| Gnani `api.vachana.ai` | STT / TTS | `X-API-Key-ID` header | Yes |
| Groq / OpenRouter / NVIDIA | Assistant LLM + assessment fallback | `Authorization: Bearer` | Yes (free tiers exist) |
| OpenWeatherMap | Weather ingestion | `appid` query param | Yes |
| Nominatim | Geocoding | `User-Agent: ASTRA/1.0`, no key | No — unauthenticated, unrate-limited |
| OSM raster tiles | Map tiles | None | No |
| TomTom Traffic | Traffic flow (current vs free-flow speed) | `key` query param, server-side | Yes (key validated live) |

### System architecture diagram

```mermaid
flowchart TD
    Citizen[Citizen browser] -->|POST /incidents| API[(FastAPI API)]
    Citizen -->|POST /voice/stt| Voice[(Gnani STT)]
    Voice -->|transcript| API
    API --> DB[(PostgreSQL 16)]
    API --> Redis[(Redis 7)]
    API --> MapWS[WS /ws/map]
    MapWS -.->|pub/sub| Map[Leaflet + OSM map]
    API --> Routing[OSM graph: 406k nodes, 879k edges]
    Assistant[Assistant chat] --> LLM[Groq → OpenRouter → NVIDIA → rules_stub]
    Weather[Weather tick 5 min] --> OWM[OpenWeatherMap]
    Geo[Geocode] --> Nominatim[OpenStreetMap Nominatim]
    Media[Evidence photos] --> S3[(S3-compatible R2 / local disk)]
```
## Engineering deep dive

### Routing graph — memory-engineered for free-tier containers

The strongest piece of backend engineering. Instead of loading 406k OSM nodes and 879k edges as ORM objects (measured 1,546 MB peak RSS), ASTRA uses forward-star flat arrays (`head`, `nxt`, `to`, `wt`, `lat`, `lon`, `live` bytearray) in `api/app/services/routing_service.py`. Measured peak: ~200 MB, resident ~167 MB — fits a 512 MB Render free container. Chunked keyset pagination (`_CHUNK = 50_000`) means no result set is ever fully buffered. Closed edges are genuinely impassable (dropped at build time). Dijkstra runs in-process with `heapq`; disconnected pairs return an honest "no route between these points" instead of a fabricated straight line.

### Single-gate incident state machine

`api/app/services/incident_state.py` is the one invariant gate. Transitions are explicit and one-way where required:
- Verification: `UNVERIFIED → VERIFIED | REJECTED`, `REJECTED → UNVERIFIED` (reopen), `VERIFIED` terminal, `REJECTED → VERIFIED` directly refused
- `DEFINITELY_FALSE` flips visibility to `HIDDEN` and lifecycle to `CLOSED` — no poll, no dispatch
- Polls never write verification — four independent axes (assessment, poll, verification, response)

17 unit tests cover the full truth table.

### Per-event-loop DB/Redis clients (AD-38)

`api/app/core/database.py` caches engines/sessions/Redis clients **per event loop**, not process-wide. asyncpg/Redis connections are loop-bound; closing cross-loop never completes. This was the bug that hung the test suite forever in `dispose()` — fixed, documented, and tested.

### Honest degradation everywhere

- LLM → rules_stub with the truth recorded in `assessments.backend` (never rewritten by fallback)
- Route → "no route between these points" instead of a straight line
- Graph → "loading" in `/health` instead of "ok"
- Simulation → "Not a real forecast" inside the payload
- Live traffic/team GPS → disclosed as unavailable, never faked

### Audit logging

`api/app/core/audit.py` is pure-ASGI middleware (not `BaseHTTPMiddleware`) using a recording `receive` so it can copy login bodies without stealing them. Append-only, never breaks a request it observes, skips token refresh to avoid anonymous actor-less rows. 1,398 rows in the live DB.

### Media storage

Pluggable backend (`MEDIA_STORAGE=local` dev disk / `s3` R2/AWS S3/MinIO production). API always proxies bytes through signed-URL route; HMAC-verified. Render's free tier has an ephemeral filesystem, so S3 is required in production.

### Audio processing (P0 fix G4)

Browser records OGG (Gnani-documented format, not WebM). On the backend, WebM is transcoded to 16 kHz mono 16-bit PCM WAV via ffmpeg before forwarding to Gnani STT. Unsupported formats are rejected with 422 before burning a Gnani call.
## Engineering challenges and how we solved them

### 1. Large routing dataset on a 512 MB free-tier container

**Problem.** 406,154 OSM nodes + 879,902 edges. ORM object loading was measured at 1,546 MB peak RSS — a free-tier container would OOM. A single `db.stream()` of both tables was 373 MB peak — better but still heavy.

**Approaches considered.** (a) ORM objects + dict-of-lists adjacency (rejected, 1,546 MB). (b) Single-shot `db.stream()` of both tables (373 MB, 28.2 s). (c) Forward-star flat arrays with chunked keyset pagination.

**Solution.** Forward-star flat arrays (`head`/`nxt`/`to`/`wt`/`lat`/`lon`/`live` bytearray) in `routing_service.py`: ~200 MB peak, ~167 MB resident, 2.3 s node load + 5.0 s edge load.

**Trade-off.** ~167 MB resident per process — `render.yaml` pins `WEB_CONCURRENCY: 1` because each worker holds its own graph (Redis is not in the routing path).

**Outcome.** Fits free-tier memory budget with margin. Measured numbers recorded in source docstrings.

### 2. Region allowlist silently hiding real emergency reports

**Problem.** `NCR_REGIONS` (the allowlist used by the assessment stub's rule 1) was missing "North Delhi" and "West Delhi" — both unambiguously in Delhi NCR. A citizen typing "North Delhi" had their report classified `DEFINITELY_FALSE`, flipped to `HIDDEN` + `CLOSED`, and vanished from the public map. Proven with 10 live DB rows including "Heavy smoke visible near the tower, people evacuating."

**Solution.** Added "North Delhi" and "West Delhi" to `NCR_REGIONS`; added server-side region validation in `incident_service.create_incident` (422 with the valid list) so an unknown region is rejected before any assessment runs, never silently misclassified.

**Trade-off.** Region is now validated server-side — a report with an unknown region gets 422 instead of being silently dropped. This is the correct behavior: better to tell the user than to lose the report.

**Outcome.** Fixed (P0-1). Regression tests added in `test_incidents.py`.

### 3. Browser audio format incompatible with Gnani STT

**Problem.** `MediaRecorder` in Chrome produces `audio/webm` (labeled `video/webm` by httpx's content-type guessing). Gnani documents WAV/MP3/OGG/FLAC/AAC/M4A — WebM is not supported. The browser path had never been proven live against the Gnani API (only WAV was tested in the spike).

**Solution.** Frontend now prefers OGG (`audio/ogg`, Gnani-supported) with WebM fallback. Backend transcodes WebM→WAV (16 kHz mono PCM) via ffmpeg before forwarding. Unsupported formats rejected with 422. The filename reflects the actual format (`recording.ogg` / `recording.webm`).

**Trade-off.** ffmpeg is a system dependency (already present on host and build image); no new Python package introduced. Transcoding adds latency to the STT path.

**Outcome.** Fixed (P0-4). Voice service tests added in `test_voice.py`.

### 4. Two IDORs on assistant conversations and simulation runs

**Problem.** `GET /assistant/conversations/{id}/messages` and `POST /.../{id}/chat` had no ownership check — any authenticated user who knew (or brute-forced) a `conv_id` could read another user's transcript or inject messages. `GET /simulations/{run_id}` likewise had no mode/ownership check — a citizen could fetch an OPERATIONAL run.

**Solution.** Assistant `get_messages` and `chat` now verify `AssistConversation.user_id == user.id` before any data access, returning 404 (existence stays secret). Simulation `get_run` filters non-admins to `mode == "PUBLIC"` runs only, matching `list_runs`.

**Outcome.** Fixed (P0-4). Tests added in `test_assistant.py` and `test_simulation.py`.

### 5. Weather ingestion burning the free API quota

**Problem.** The sweeper loop ran every 60 seconds (comment said "every 5 min"), making 6 OpenWeatherMap calls per tick → 8,640 calls/day vs the 1,000/day free tier. The real key was being burned continuously. Also, 3 of 6 `DELHI_POINTS` labels ("New Delhi", "North Delhi", "West Delhi") were outside `NCR_REGIONS`, so weather auto-incidents would be auto-hidden.

**Solution.** Sweeper interval changed to 300 s. `DELHI_POINTS` labels corrected so all six are valid `NCR_REGIONS` members; Noida coordinate fixed (was a duplicate of East Delhi).

**Trade-off.** Less frequent weather refresh (5 min instead of 1 min) — acceptable for an ingestion heuristic.

**Outcome.** Fixed (P0-2/C3).

### 6. FastAPI 422 errors rendering as `[object Object]`

**Problem.** `HttpError` did `super(body.detail || ...)` but FastAPI validation errors are arrays of objects — `new Error(array)` coerces to `"[object Object]"`, destroying every validation message in the app.

**Solution.** `HttpError` now safely stringifies strings, arrays (mapping `{loc, msg, type}` to readable text), and objects.

**Outcome.** Fixed (P0-5). No new test needed — existing 422 tests now surface readable messages.

### 7. Gnani API key rotation

**Problem.** The Gnani key (134 chars) was pasted in plaintext in chat earlier in the project and mandated for rotation (`contracts/requests.md:99`, `docs/plan-phases.md:739`). No rotation was recorded in the repo.

**Outcome.** Key status must be re-verified before any production deploy. The key lives in gitignored `.env` only, never committed. This is an operational blocker, not a code change.

### 8. Testing asynchronous backend functionality

**Problem.** The test suite drops and recreates the whole schema before every test (~8 s/test), and asyncpg/Redis clients are loop-bound. A naive teardown closing cross-loop connections hung the suite forever in `dispose()`.

**Solution.** Per-event-loop client caches with `reset_clients()` / `dispose()` in `database.py`; conftest migrated to `reset_clients()` / `dispose()` instead of `cache_clear()`. Fake Redis pool for WS unit tests (no live Redis in unit tests).

**Outcome.** Fixed earlier (AD-38). Suite now runs green: 130 passed, 1 skipped (known Windows WS teardown flake, passes on Linux/CI).

### 9. Frontend/backend integration dead controls

**Problem.** Multiple buttons had no handler ("Share", "Update Status", "View on Map →", "Assign"), the "Live ON/OFF" toggle did nothing, alerts claimed WS delivery but arrived via REST, and the dashboard told response teams "the task list endpoint is not built yet" when it existed.

**Solution.** Removed or wired dead controls; `showBasemapSwitcher={false}` on the dashboard's read-only map card; map control buttons sized to `min-h-10` (40 px); honesty copy corrected throughout.

**Trade-off.** None — these are correctness fixes, not feature changes.

**Outcome.** Fixed earlier (AD-31…AD-38, map-control closeout).
## Technology stack

| Category | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Zustand v5 | App Router, UI, state management |
| Frontend (mapping) | Leaflet 1.9.4, OpenStreetMap raster tiles | Real map, no API key |
| Backend | FastAPI, SQLAlchemy 2.0 (async), asyncpg | API, ORM, Postgres driver |
| Database | PostgreSQL 16 | Primary data store |
| Cache / pub/sub | Redis 7 | Rate limiting, WebSocket channels |
| AI — STT | Gnani Prisma (`api.vachana.ai`) | Speech-to-text, `X-API-Key-ID` auth |
| AI — TTS | Gnani Timbre (`api.vachana.ai`) | Server-side text-to-speech, no UI consumer |
| AI — LLM | Groq → OpenRouter → NVIDIA → `rules_stub` | Assistant + assessment fallback chain |
| Migrations | Alembic | Schema versioning at head |
| Auth | Argon2id, PyJWT HS256 | Password hashing, access/refresh tokens |
| Media | Local disk (dev) / S3-compatible R2 (prod) | HMAC-signed evidence photo URLs |
| Testing (backend) | pytest 8.3.4, pytest-asyncio | 130 tests, real Postgres + Redis |
| Testing (frontend) | vitest 5, Playwright 1.64 | 7 unit tests, 6 E2E tests |
| Lint | ruff 0.8.4, eslint 9 | Backend + frontend |
| Build | Next.js turbopack | Production build |
## Project structure

```
code/                          ← this repository
├─ .github/workflows/ci.yml    ← CI: ruff, pytest, eslint, build, vitest, Playwright
├─ api/                        ← FastAPI backend
│  ├─ app/
│  │  ├─ core/                 config, database (per-loop clients), security, deps,
│  │  │                        permissions, scoping, rate_limit, audit, constants
│  │  ├─ models/               19 SQLAlchemy models (users, incidents, assessments,
│  │  │                        poll_votes, verification_events, response_tasks, alerts,
│  │  │                        assist_*, audit_logs, sim_runs, map_locations, routing_edges)
│  │  ├─ routers/              18 routers (auth, incidents, tasks, verification,
│  │  │                        poll, alerts, stats, audit, voice, weather, geocode,
│  │  │                        simulation, routing, assistant, org, coordination, map_ws)
│  │  ├─ services/             17 services (routing_service, incident_service,
│  │  │                        assessment_backend, assistant_service, simulation_service,
│  │  │                        weather_service, voice_service, task_service, stats_service,
│  │  │                        media_storage, map_ws, incident_state, alert_service,
│  │  │                        poll_service, verification_service)
│  │  └─ main.py               FastAPI entrypoint, lifespan, middleware, /health
│  ├─ alembic/                 migrations at head (9974fb9d202a)
│  ├─ scripts/                 graph_components.py (connectivity measurement)
│  ├─ tests/                   130 tests, real Postgres + Redis
│  ├─ requirements.txt
│  └─ requirements-dev.txt
├─ contracts/openapi.json      ← OpenAPI contract snapshot
├─ docs/
│  ├─ assets/logo.svg          ← ASTRA logo
│  ├─ architecture.md          ← AD decisions (AD-1…AD-38)
│  ├─ ui-ux-audit.md           ← per-page findings, responsive, states, open items
│  ├─ plan-remaining.md        ← Phase 6/7/8 tracking
│  ├─ plan-deployable.md       ← free-tier deployability
│  ├─ deployment-free-tier.md  ← per-provider limits and tradeoffs
│  └─ daily/hasan/             ← worklogs
├─ seed/                       seed.py (demo world), seed_osm.py (real OSM graph)
├─ web/                        Next.js frontend
│  ├─ src/app/(app)/           authenticated routes (dashboard, map, incidents, …)
│  ├─ src/components/          LiveMap, LinkButton, DataTable, task components
│  ├─ src/api/                 client.ts, openapi-types.ts (generated contract)
│  ├─ src/stores/              Zustand stores (auth, incidents, alerts, tasks, …)
│  ├─ tests/                   Playwright specs + vitest unit tests
│  └─ scripts/                 contracts-sync, responsive-audit, page-text-audit
├─ docker-compose.yml          ← db:5433, redis:6379, api:8000 (localhost-only)
├─ render.yaml                 ← Render blueprint (web service + Key Value)
├─ .env / api/.env             ← real keys, gitignored, NEVER committed
└─ LICENSE                     ← MIT
```
## Installation and local development

### Prerequisites

- Docker Desktop (for Postgres :5433, Redis :6379, API :8000)
- Node.js 22+ and npm (frontend)
- Python 3.13 + `pip` (backend)
- ffmpeg (system dependency for WebM→WAV audio transcoding)

### 1. Clone the repository

```powershell
git clone https://github.com/hasan19524/ASTRA-Advanced-Spatial-Technology-for-Response-Assistance.git
cd ASTRA-Advanced-Spatial-Technology-for-Response-Assistance/code
```

### 2. Environment setup

Copy the example and fill in real values (never commit secrets):

```powershell
copy api\.env.example api\.env
copy .env.example .env   # if present at root
```

Required minimum for local dev:

| Variable | Example | Purpose |
|---|---|---|
| `JWT_SECRET` | `python -c "import secrets;print(secrets.token_hex(32))"` | Required — app refuses to boot without it |
| `DEMO_MODE` | `true` | Enables one-click demo login (`demo-login` endpoint) |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5433/astra` | Local Postgres via Docker |
| `REDIS_URL` | `redis://localhost:6379/0` | Local Redis via Docker |
| `GNANI_API_KEY` | (set by operator) | Gnani STT/TTS — register at app.gnani.ai |
| `WEATHER_API_KEY` | (set by operator) | OpenWeatherMap — register at openweathermap.org |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` | (optional) | LLM providers; leave blank to use `rules_stub` |

Phase 7 keys (not yet wired into code — supplied separately):

| Variable | Purpose |
|---|---|
| `TOMTOM_API_KEY` | Traffic layer on the map |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS OTP verification |
| `OPENAI_API_KEY` | Image classification of evidence photos |

All real keys live in gitignored `.env` files only. Never commit them.

### 3. Start the infrastructure

```powershell
docker compose up -d
```

Wait ~25 s for Docker Desktop, then confirm:

```powershell
docker compose ps
# astra-db-1, astra-redis-1 healthy; astra-api-1 starting
```

Verify the API:

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health"
# → {"status":"ok","database":"ok","redis":"ok","routing_graph":"ready",…}
```

### 4. Database schema

Migrations run on API boot (`alembic upgrade head` in the Dockerfile CMD). For local development without Docker:

```powershell
cd api
alembic upgrade head
```

### 5. Seed the demo world (optional, for demos)

```powershell
python seed/seed.py
```

Demo logins (password `astra-demo-2026`): `admin@`, `dephead@`, `team@`, `officer@`, `citizen@astra.dev`.

### 6. Start the frontend

```powershell
cd web
npm install   # first time only
npm run dev   # :3000, Turbopack
```

### 7. Run the tests

**Backend** (real Postgres + Redis via Docker, ~17 min):

```powershell
cd api
python -m pytest -q
# → 130 passed, 1 skipped (known Windows WS teardown flake, passes on Linux/CI)
```

**Frontend lint + build + unit tests:**

```powershell
cd web
npm run lint    # → 0 errors
npm run build   # → compiled cleanly
npm run test    # → 7 passed (vitest)
```

**E2E (Playwright, needs dev server on :3000):**

```powershell
cd web
npx playwright test --workers=1
# → 6 passed
```
## Environment variables

All variables are read via pydantic-settings from `.env` (gitignored). Never commit real values.

| Variable | Default | Required? | Purpose |
|---|---|---|---|
| `APP_NAME` | `"ASTRA API"` | No | Service name |
| `ENVIRONMENT` | `"development"` | No | Drives HSTS in production |
| `DEBUG` | `True` | No | Debug mode — flip to `False` for prod |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5433/astra` | Yes | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Yes | Redis connection |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Yes | JSON array of allowed origins |
| `JWT_SECRET` | *(no default)* | **Yes** | App refuses to boot if empty or a known default |
| `JWT_ALGORITHM` | `"HS256"` | No | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | No | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | No | |
| `ASSESSMENT_BACKEND` | `"rules"` | No | `rules` or `llm` |
| `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL` | `""` | No | Legacy single-provider LLM path |
| `GROQ_API_KEY` / `GROQ_MODEL` / `GROQ_BASE_URL` | `""` / `"openai/gpt-oss-20b"` | No | LLM provider 1 (free tier) |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_BASE_URL` | `""` / `"google/gemma-4-31b-it:free"` | No | LLM provider 2 |
| `NVIDIA_API_KEY` / `NVIDIA_MODEL` / `NVIDIA_BASE_URL` | `""` / `"google/gemma-4-31b-it"` | No | LLM provider 3 |
| `WEATHER_API_KEY` / `WEATHER_BASE_URL` | `""` | No | OpenWeatherMap (free tier: 1,000 calls/day) |
| `GNANI_API_KEY` / `GNANI_BASE_URL` | `""` / `"https://api.vachana.ai"` | No | Gnani STT/TTS (register at app.gnani.ai) |
| `DEMO_MODE` | `False` | No | Gates `POST /auth/demo-login` |
| `DEMO_PASSWORD` | `"astra-demo-2026"` | No | Demo login password (server-side only) |
| `POLL_RATE_LIMIT` / `POLL_RATE_WINDOW_SECONDS` | `5` / `60` | No | Votes per window per user |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_SECONDS` | `10` / `60` | No | Auth attempts per IP per endpoint |
| `ROUTING_PREWARM` | `True` | No | Load OSM graph at startup (~7 s, ~200 MB) |
| `MEDIA_STORAGE` | `"local"` | No | `local` (dev disk) or `s3` (R2/AWS S3/MinIO, required in prod) |
| `MEDIA_URL_TTL_SECONDS` | `3600` | No | Signed URL expiry |
| `S3_ENDPOINT_URL` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_KEY_PREFIX` | `""` / `"auto"` / `""` / `""` / `""` / `"evidence"` | No | S3-compatible bucket config (used when `MEDIA_STORAGE=s3`) |

**Phase 7 (not yet wired into code — supplied separately):**

| Variable | Purpose |
|---|---|
| `TOMTOM_API_KEY` | Traffic layer |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS OTP |
| `OPENAI_API_KEY` | Image classification |
## API documentation

All business endpoints are mounted under `/api/v1`. WebSocket channels (`/ws/map`, `/ws/alerts`) are not prefixed (frozen Day 3 contract). Auth is `Authorization: Bearer <access>` JWT; auth endpoints are rate-limited per IP per endpoint.

### Auth

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/auth/register` | POST | none | Register citizen account (201) |
| `/api/v1/auth/login` | POST | none | Login, returns access + refresh tokens |
| `/api/v1/auth/demo-login` | POST | none | Demo login (gated by `DEMO_MODE`) |
| `/api/v1/auth/refresh` | POST | none | Refresh token pair |
| `/api/v1/auth/logout` | POST | none | Stateless (no-op; refresh tokens live until expiry) |
| `/api/v1/auth/me` | GET | JWT | Current user profile |

### Incidents

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/incidents` | POST | JWT `report.create` | Submit report (multipart: title, description, category, region?, lat/lon?, photo?) |
| `/api/v1/incidents` | GET | JWT | List incidents (filters, pagination) |
| `/api/v1/incidents/{id}` | GET | JWT | Detail with timeline + assessments |

### Poll

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/incidents/{id}/poll` | GET | JWT | Poll state (counts per option) |
| `/api/v1/incidents/{id}/poll/vote` | POST | JWT `poll.vote` | Cast vote (one per user, DB-enforced) |

### Verification

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/incidents/{id}/verify` | POST | JWT `incident.verify` | VERIFY or REJECT (reason required for REJECT) |
| `/api/v1/incidents/{id}/reject` | POST | JWT `incident.verify` | Reject with reason |
| `/api/v1/incidents/{id}/reopen` | POST | JWT `incident.verify` | Reopen from VERIFIED |
| `/api/v1/verification/queue` | GET | JWT `incident.verify` | Officer queue (filters, pagination) |

### Tasks

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/tasks` | GET | JWT `task.view` | Role-scoped task list |
| `/api/v1/tasks/{id}` | GET | JWT `task.view` | Task detail |
| `/api/v1/tasks/{id}` | PATCH | JWT `task.update` | Patch task (status transitions only) |
| `/api/v1/tasks/{id}/updates` | POST | JWT `task.update` | Add task update |
| `/api/v1/incidents/{id}/tasks` | GET/POST | JWT `task.view`/`task.create` | Tasks for an incident |

### Alerts

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/alerts` | GET | JWT | List alerts |
| `/api/v1/alerts` | POST | JWT `alert.manage` | Create alert |
| `/api/v1/alerts/preferences` | GET/POST | JWT | List / upsert user alert preferences |
| `/api/v1/alerts/preferences/{id}` | DELETE | JWT | Delete own preference |
| `/ws/alerts` | WS | JWT | Alerts channel (implemented, not yet consumed by client) |

### Stats / Audit

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/stats/overview` | GET | JWT `stats.view` | Counted stats (all from DB, honest nulls) |
| `/api/v1/audit/logs` | GET | JWT `audit.read` | Append-only audit log (Central Admin only) |

### Voice (Gnani)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/voice/languages` | GET | none | Supported STT/TTS languages |
| `/api/v1/voice/stt` | POST | JWT | Speech-to-text (multipart audio + language_code) |
| `/api/v1/voice/tts` | POST | JWT | Text-to-speech (returns WAV bytes; no UI consumer) |

### Weather / Geocode / Routing

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/weather/current` | GET | none | Current weather (OpenWeatherMap) |
| `/api/v1/weather/delhi` | GET | none | All Delhi NCR points |
| `/api/v1/geocode/search` | GET | none | Nominatim geocoding (Delhi viewbox) |
| `/api/v1/route` | GET | JWT | Dijkstra route (`path_coords` included) |
| `/api/v1/route/nearest` | GET | JWT | Snap to routable junction |
| `/api/v1/route/closures` | GET | JWT | Road closures (empty until operator API exists) |

### Simulation

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/simulations` | POST | JWT `simulation.public` | Run heuristic simulation |
| `/api/v1/simulations/{id}` | GET | JWT | Get run (PUBLIC for non-admins) |
| `/api/v1/simulations` | GET | JWT | List runs (PUBLIC only for non-admins) |

### Assistant

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/v1/assistant/conversations` | POST | JWT | Create conversation |
| `/api/v1/assistant/conversations` | GET | JWT | List own conversations |
| `/api/v1/assistant/conversations/{id}/messages` | GET | JWT | Get messages (owner only) |
| `/api/v1/assistant/conversations/{id}/chat` | POST | JWT | Chat (owner only, returns `{"reply","provider"}`) |

### Health / Media

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | none | DB / Redis / routing graph / media status |
| `/uploads/{filename}` | GET | signed URL | Serve evidence photo (HMAC-verified) |
## Testing and quality assurance

All results below were obtained by running the actual commands against the real stack (PostgreSQL + Redis via Docker). No mock data counts as verification.

### Backend

```
cd api
python -m pytest -q
```

**Result:** `130 passed, 1 skipped in 1008.58s`

- 130 tests pass against **real Postgres + real Redis** (schema dropped and recreated before every test)
- 1 skip: `test_ws_incident_updated_fanout` — known Windows/proactor TestClient WebSocket teardown flake; passes on Linux/CI
- 15 test files covering: auth contract (14), incident-state truth table (17), seed idempotency, incidents (10), poll (8), routing (6), tasks (7), verification (12), assistant (3), assessment backend (10), assessment stub (4), duplicate grouping (3), map WS (3), media (4), day-2 contract (14)
- New P0 regression tests: region validation (`test_incidents.py`), assistant ownership (`test_assistant.py`), simulation authorization (`test_simulation.py`), voice audio format (`test_voice.py`), weather points (`test_incidents.py`)

**Gap:** No direct test files yet for `weather_service`, `voice_service` router integration, `simulation_service`, coordination router, org router, alert service, audit router, geocode router, or background workers.

### Frontend unit tests

```
cd web
npm run test
```

**Result:** `7 passed (7)` — vitest, 2 files (`incidents.store.test.ts`, `permissions.test.ts`)

### Frontend lint

```
cd web
npm run lint
```

**Result:** `0 errors` — eslint 9

### Frontend build

```
cd web
npm run build
```

**Result:** compiled cleanly — Next.js 16 Turbopack, TypeScript type check passes

### E2E (Playwright)

```
cd web
npx playwright test --workers=1
```

**Result:** `6 passed (39.3s)` — 3 projects (citizen, officer, surface)

| Test | What it proves |
|---|---|
| `trust-arc.spec.ts` | Citizen reports → pin appears via WS < 1000 ms → votes genuine → officer verifies → pin flips to green < 1000 ms (real-time, latency-bound) |
| `officer.spec.ts` | Login → verification queue → investigate → reject with reason → reopen → awaiting verification |
| `assistant.spec.ts` | Provider attribution names the engine that answered (LLM model or rules stub) |
| `map.spec.ts` | Real OSM tile source, real incident pins, honest layer note; real route polyline whose point count equals the API's node count |

### Backend lint

```
cd api
python -m ruff check app tests
```

**Result:** `All checks passed!`
## Security considerations

### Authentication

- Argon2id password hashing (`api/app/core/security.py` is the only crypto owner)
- JWT HS256 access tokens (15 min) + refresh tokens (7 days)
- `JWT_SECRET` is required — the app **refuses to boot** if empty or a known default
- No user enumeration: unknown email gives the same error as wrong password
- Refresh token rejected as access token; tampered token → 401

### Authorization

- Role → permission matrix is the single source of truth (`api/app/core/permissions.py`)
- Object-level scoping: 404-not-403 — existence of restricted/hidden incidents stays secret
- Department Heads see only their department's tasks; Response Teams see only assigned tasks
- Assistant conversations and simulation runs are ownership-checked (P0 fix)
- `audit.read` (Central Admin only) for the audit log

### Request validation

- Pydantic schemas on all endpoints; unknown departments rejected with 422 + valid list
- Region validated against `NCR_REGIONS` (P0 fix)
- Photo uploads: MIME type + 5 MB cap, rejected before touching disk
- `POST /voice/tts` body now validated (P0 fix) — was an untyped `dict`
- FastAPI 422 validation errors surface readable messages (P0 fix, `HttpError`)

### Secrets

- All real keys in gitignored `.env` only — zero occurrences in any tracked file, commit, unreachable commit, or loose git object (verified by scanning all history)
- Keys never in `NEXT_PUBLIC_*`, never in response bodies or logs
- `X-API-Key-ID` (Gnani) is header-only, never `Authorization: Bearer`

### Known limitations (honest)

- `POST /auth/logout` is a documented no-op — refresh tokens live until expiry (~7 days); no server-side revocation denylist
- `/weather/*` and `/geocode/search` are unauthenticated (quota burn / Nominatim policy risk — rate limiting planned as P1)
- `/uploads/{filename}` relies on HMAC signature + UUID-hex names; no path-traversal guard beyond that (P1)
- Nominatim error handling: `raise_for_status()` unhandled → 500 (P1)
- Expired alerts are hard-deleted (no `expired` archive flag) — history lost (P1)
## Deployment architecture

### Intended free-tier stack

| Provider | Role | Free-tier limit | Tradeoff |
|---|---|---|---|
| **Render** | API (web service) | 512 MB RAM, spins down after inactivity, ephemeral disk | Media must use R2; container may spin down |
| **Vercel** | Web frontend | Hobby: 100 GB bandwidth/month | Serverless function limits |
| **Neon** | Postgres | 3 GB storage, 10 vCPU-hours/month | Pauses after 1 week inactivity |
| **Cloudflare R2** | Media (S3-compatible) | 10 GB storage, 1M class-A reads/month | No egress fees |
| **Render Key Value** | Redis | Up to 3 × 256 MB instances | Valkey 8 |

**Supabase rejected** — 500 MB limit vs 393 MB seeded DB; pauses after 1 week inactivity. Render Free Postgres, Render free disks, Koyeb, Fly.io, Railway all rejected.

The DB is 393 MB (routing_edges 290 MB / 879,902 rows; map_locations 94 MB / 406,154 rows) — fits Neon's 3 GB.

### Local deployment (`docker-compose.yml`)

```yaml
db:    postgres:16-alpine, host port 5433 (localhost-only)
redis: redis:7-alpine, host port 6379 (localhost-only)
api:   FastAPI build from ./api, host port 8000 (localhost-only)
```

All published ports are bound to `127.0.0.1` — venue Wi-Fi must never reach the DB.

### Render blueprint (`render.yaml`)

`render.yaml` defines the web service with `WEB_CONCURRENCY: 1` (each worker holds its own ~167 MB routing graph; Redis is not in the routing path). Env vars use `sync: false` for optional provider keys so they don't break deploys when unset.

### What is NOT yet deployed

No production deployment exists yet. The stack is designed for free-tier hosting but has not been deployed to Render/Vercel/Neon/R2. Real API keys (Groq, OpenRouter, NVIDIA, Gnani, OpenWeatherMap) were pasted in chat earlier and **must be rotated** before any production deploy.
## Roadmap

### Completed

- Real OpenStreetMap routing graph (406k nodes / 879k edges), memory-engineered to 167 MB
- Citizen incident reporting with photo upload, geolocation, voice STT (Gnani Prisma)
- Image evidence intelligence (Pillow validation + hosted vision AI, modular provider interface)
- TomTom traffic overlay on the live map (real flow data, congestion ratio)
- Gnani Timbre TTS UI consumer ("Listen" button on assistant answers)
- AI-assisted verification (rules stub + multi-provider LLM fallback, honest labels)
- Public verification & polling (one-vote-per-user, separate axes)
- Officer/admin verification queue (append-only events)
- Live incident map (Leaflet + OSM, real Dijkstra polyline, honest no-route message)
- Assistant chat (Groq → OpenRouter → NVIDIA → rules stub, provider attribution)
- Simulation engine (documented heuristic, isolated `sim_*` tables)
- Task board with role-scoped access, canonical 7 departments
- Audit log, departments, stats counted from DB
- WebSocket fan-out (`/ws/map`), signed media URLs
- CI/CD (ruff, pytest, eslint, build, vitest, Playwright)

### In progress (P0 + Phase 2/3/4 — just completed)

- Region allowlist: "North Delhi" / "West Delhi" added + server-side validation
- Weather sweeper: 60 s → 300 s; `DELHI_POINTS` labels/coordinates corrected
- Security: assistant conversation ownership, simulation run authorization
- Gnani audio: OGG recording + WebM→WAV transcoding server-side
- HTTP client: `HttpError` safely stringifies FastAPI 422 arrays
- Docs: Gnani integration documented honestly (not "pending verification")

### P1 (important improvements)

- Gnani TTS UI consumer (play button for assistant replies / navigation)
- On-screen "Prisma v2.5 · Gnani" attribution
- Alert geo-targeting fix (`user.department` vs NCR region names)
- Poll vote `Literal["genuine","fake"]` schema
- TTS body size cap + Pydantic schema
- Stop hard-deleting expired alerts; add `expired_at` + index
- Rate-limit + auth on `/weather/*` and `/geocode/search`
- 375 px Playwright project + vitest for `api/client.ts`
- Delete dead code (`tasks.py` no-op block, shadowed coordination `/reopen`)

### P2 (optional)

- Incident clustering on the map (>500 pins)
- Offline reporting / PWA
- Multi-tenancy, Web Push, DPDP compliance
- Analytics CSV export, predictive dispatch
- Road-closure operator API (route/closures permanently empty without one)
- Open-Meteo / ReliefWeb feed integration (`external_feeds_cache` is a dead table)
- Real screen-reader pass (NVDA/VoiceOver)

### Competition submission (Gnani AI challenge)

- [x] Working application
- [x] Clear problem statement
- [x] Project description
- [x] Gnani AI integration (Prisma STT, live in product path)
- [x] Explanation of AI usage (this README)
- [x] Team contributions (below)
- [ ] Public demonstration video — **not yet recorded**
- [ ] LinkedIn/X announcement with required hashtags — **not yet posted**
## Team and contributions

| Contributor | Role | GitHub |
|---|---|---|
| Hasan Siddique | Backend lead | @hasan19524 |
| Lubna Suhail Quadri | Frontend lead | @lubnasuhail598 |

**Hasan Siddique** — Backend: FastAPI + SQLAlchemy + asyncpg + Redis architecture, Alembic migrations, OSM routing graph (forward-star flat arrays, Dijkstra), incident state machine, multi-provider LLM chain (Groq → OpenRouter → NVIDIA → rules_stub), Gnani voice proxy (STT/TTS), weather ingestion, per-event-loop DB/Redis clients (AD-38), audit middleware, media storage (local/S3), tests (130 passing).

**Lubna Suhail Quadri** — Frontend: Next.js 16 App Router + Tailwind 4, Leaflet map with real OSM tiles, Zustand stores, typed fetch client with token refresh, OpenAPI codegen, report form with voice STT, dashboard, map controls, Playwright E2E (6 tests), responsive and page-text audits.

Contribution counts are not inventoried as percentages; both contributors built the features listed above. Commit history spans 2026-10-26 to 2026-11-09 (45 commits by Hasan, 10 by Lubna).

## Acknowledgements

- **OpenStreetMap** contributors — map tiles and road graph data
- **Gnani AI** — Prisma STT and Timbre TTS APIs (`api.vachana.ai`)
- **Groq, OpenRouter, NVIDIA** — free-tier LLM models for the assistant fallback chain
- **OpenWeatherMap** — weather data
- **Nominatim / OpenStreetMap** — geocoding
- **Cloudflare R2** — S3-compatible media storage target
- **Render, Vercel, Neon** — free-tier hosting targets evaluated for deployment
- **Leaflet** — open-source mapping library

## License

MIT License — see [LICENSE](LICENSE) for full text.

Copyright (c) 2026 Hasan Siddique
