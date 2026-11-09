# Remaining Buildable Items — ASTRA Completion Plan

Status legend: **done** · **partial** · **blocked** (needs a key or a
provider we rejected) · **todo**

---

## Phase 6 — No external dependencies

| # | Item | Status | Evidence / note |
|---|------|--------|-----------------|
| 6.1 | Assistant chat UI wiring | **done** | `web/src/app/(app)/assistant/page.tsx`. The reply now carries the **provider label** (`llm:<model>` or `rules_stub`) and the screen shows it under every bubble — a chat that cannot say which engine answered is claiming more than the system did. The backend runs the full Groq → OpenRouter → NVIDIA chain (`assistant_service.chat`), not just the first provider. |
| 6.2 | Routing UI on map | **done** | `web/src/components/map/LiveMap.tsx` draws the real Dijkstra polyline from `path_coords`. `/api/v1/route/nearest` snaps arbitrary points (an incident pin is not a graph node) and the UI states the snap distance when it is more than 500 m. |
| 6.3 | Geocoding UI | **done** | Nominatim search on the map; a "Route here" action routes from the found place to the selected incident. |
| 6.4 | Mobile responsive polish | **done** | `web/scripts/responsive-audit.mjs` measures every page at 375 / 768 / 1440. Remaining sub-40 px targets are inline text links (WCAG 2.5.8 exempts inline text) and desktop-density buttons. |
| 6.5 | Loading skeletons | **partial** | Skeletons on the incidents list, teams board and the map's own load state. Several screens still show a text "Loading…" line — see Phase 8. |
| 6.6 | Alert auto-generation on incident creation | **done** | Verified by `scripts/verify-e2e.py`. |
| 6.7 | Incident clustering on map | **todo** | 89 pins is readable; the API caps the map at 500. With Phase 8's multi-tenant load it will need real clustering. |
| 6.8 | CI/CD | **done** | `.github/workflows/ci.yml`: backend (ruff + pytest on Postgres 5433 / Redis 6379), frontend (eslint + next build + vitest), Playwright E2E. `render.yaml` + `web/vercel.json` for deploys. |

### 6.x Items added during the UI/UX audit

| # | Item | Status | Evidence / note |
|---|------|--------|-----------------|
| 6.9 | **Real map** (Leaflet + OpenStreetMap tiles) | **done** | Replaced `MapPlaceholder` (coloured dots on a CSS gradient). Real OSM raster tiles, pan/zoom/drag, incident pins coloured by verification status, drawn route polyline, closure layer, "locate me". `MapPlaceholder.tsx` deleted. |
| 6.10 | Department directory | **done** | `GET /api/v1/users` + `GET /api/v1/departments` — real head, real personnel count, real task load. The Departments screen used to render 100 % hard-coded units. |
| 6.11 | Role-scoped task board | **done** | `GET /api/v1/tasks` — admin sees all, a dept head sees their department, a response team sees only assigned tasks. The Teams screen used to say "endpoint not built yet". |
| 6.12 | Canonical department names | **done** | `app/core/constants.DEPARTMENTS` is the one list. The API rejects a department outside it (422) — before this, `"Fire"` and `"Fire & Rescue"` were two separate departments and the directory showed a team with zero people next to a team with zero tasks. |
| 6.13 | Real Reports & Analytics | **done** | The screen rendered hard-coded fixtures ("128 total incidents", "94 % poll agreement", an invented category chart). It now reads counted numbers from `GET /api/v1/stats/overview`: incidents per category, a real 7-day vs previous-7-day delta, average verification latency, poll-vs-officer agreement, and the recent-closure list. A metric that cannot be computed shows a dash, never a number. |
| 6.14 | Real Simulation Center | **done** | The screen showed fixed cards ("12.5 km²", "45,000+", "₹320 Cr") no matter what you selected. It now runs the real model and renders its summary. |
| 6.15 | Real voice-language selector | **done** | Settings listed 12 languages with most disabled and the note "selector wires up on Day 7". The list now comes from `GET /api/v1/voice/languages`, the selection persists, and the report form's microphone uses it. |
| 6.16 | Real dashboard activity feed | **done** | The card said "The activity feed endpoint is not built yet". It now reads the real audit log for roles that hold `audit.read`, and keeps an honest "admin-only" state for everyone else. |
| 6.17 | Invalid `<a><button>` nesting removed | **done** | Eight places nested a `<Button>` inside a `<Link>`: invalid HTML, a double focus stop, and a 16 px-tall invisible tap target. New `web/src/components/ui/LinkButton.tsx`. |
| 6.18 | Signed evidence-photo URLs | **done** | The frontend built `${API_URL}${media_path}` with no signature, so every evidence photo returned 403. The API now issues the signed URL (`ReportOut.media_url`) and the frontend renders it with an honest fallback tile. |
| 6.19 | Graph connectivity measured | **done** | `api/scripts/graph_components.py`: 406,154 nodes, 879,902 open edges, **487 components, largest = 401,105 nodes (98.8 %)**. The remaining 5,049 nodes are isolated OSM fragments. The API says so plainly instead of drawing a route that no car can drive. |

---

## Phase 7 — Needs API keys (blocked on the user)

| # | Item | Status | Blocked on |
|---|------|--------|------------|
| 7.1 | Traffic integration (TomTom free tier) | **blocked** | `TRAFFIC_API_KEY` |
| 7.2 | SMS/OTP auth (MSG91) | **blocked** | `MSG91` key + sender id |
| 7.3 | Image classification (OpenAI/Google Vision) | **blocked** | vision provider key |
| 7.4 | Voice-first reporting (continuous listening) | **partial** | STT/TTS work (Gnani). Continuous listening + wake word are not built. |

Until 7.1 lands, the map's layer panel says in plain words that live traffic
is unavailable — it does not draw a fake congestion overlay.

---

## Phase 8 — Platform hardening and scale

### 8.1 Multi-tenant and multi-agency isolation
- `agency_id` on `users`, `incidents`, `response_tasks`, `alerts`.
- Every read path gets an agency predicate beside the existing visibility
  predicate. The current scope model is *role*-based; a district
  commissioner must not see another district's incidents.
- Migration + backfill of the 89 seeded incidents to one default agency.
- Admin UI: agency switcher, per-agency role grants.
- **Why now:** it is a schema change. Doing it after real data exists costs
  a migration on live rows; doing it now costs a migration on seed rows.

### 8.2 Push notifications
- Web Push (VAPID) for incident assignment, task updates and alerts —
  free, no provider key, works on Android Chrome and desktop.
- A `push_subscriptions` table; the existing `WS /ws/alerts` fan-out
  becomes one of two delivery channels.
- Service worker + PWA shell (see 8.3) so push can actually be received.
- Fallback stays the in-app alert banner.

### 8.3 PWA and offline
- `manifest.webmanifest` + installable icons.
- Service worker: precache the app shell, network-first for the API.
- Offline incident reporting: queue a report in IndexedDB and submit it
  when the network returns, with a visible "queued, not yet sent" state.
  This matters for the one scenario the product exists for — a citizen in
  a flooded street with no signal.

### 8.4 DPDP Act 2023 compliance
- Consent records: `consent_events` table (purpose, lawful basis,
  timestamp, version of the notice).
- Data-minimisation on reports: a report's phone number and exact
  coordinates are currently retained forever. Add retention windows and a
  deletion job.
- Right-to-erasure: a self-service endpoint that deletes or anonymises a
  citizen's reports, keeping only the aggregate counts.
- Grievance-officer contact surfaced in the UI.

### 8.5 Analytics and reporting
- CSV export for incidents, tasks and the audit log (an admin should be
  able to hand a file to a district office).
- Weekly operational digest (email or downloadable) — incident volume by
  category and region, median verification latency, mean time to close.
- Read-optimised rollup tables so the analytics screen does not scan the
  whole incident table on every load.

### 8.6 Predictive dispatch
- Position history per response unit (`unit_positions`, written from the
  mobile client).
- Predict the demand hotspot for the next 3 hours from the incident
  time series + weather (OpenWeatherMap is already integrated).
- Suggest the nearest available unit for a new task instead of leaving
  the choice to the dispatcher.
- **Explicitly not** an autonomous dispatch decision: the model proposes,
  a human disposes. That stays a rule of the product, not just the code.

### 8.7 Performance and scale work
- The routing graph is 200 MB peak / 167 MB resident in-process. It fits
  Render Free's 512 MB with one worker, and the container is configured
  for one worker. Before a second region is added, move the graph into a
  shared structure (pgvector + a graph extension, or a precomputed
  `shortest_path` table for the ~200 depot/hospital pairs that actually
  matter) so the API can scale horizontally.
- Incident search is currently `ILIKE` over a free-text field. Add
  Postgres full-text search (`tsvector`) with a GIN index before the
  incident table passes ~100 k rows.
- `/ws/map` and `/ws/alerts` currently fan out in-process. Two API
  instances means two fan-out loops. Move the pub/sub to Redis (the free
  Render Key Value instance is already provisioned).

### 8.8 Testing and observability
- Playwright coverage for the map (pan, zoom, route, pin selection) —
    the map is now the most complex surface and has no E2E coverage.
- Contract test that the committed `contracts/openapi.json` matches the
    running API, so a backend change that forgets to regenerate the
    contract fails CI.
- Structured request logs with a request id, plus a slow-request metric.

---

## Testing

| # | Item | Status |
|---|------|--------|
| T1 | Playwright E2E specs | **done** — 3/3 pass |
| T2 | Vitest unit tests | **done** — 7/7 pass |
| T3 | Full E2E script (`scripts/verify-e2e.py`) | **done** — 27/27 pass |
| T4 | Auth verification (`scripts/verify-auth.ps1`) | **done** — 16/16, `EXIT=0` |
| T5 | Backend unit suite | **done** — see `docs/plan-deployable.md` for the current count |
| T6 | Map E2E coverage | **done** — `web/tests/map.spec.ts` + `web/tests/assistant.spec.ts`, 6/6 Playwright pass |
