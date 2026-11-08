# Phase 6 & 7 Plan — Making ASTRA a deployable, usable product

Status legend: **done** = implemented and verified with a real command in the
worklog · **open** = still to do · **blocked** = waiting on a user-supplied key.

## Phase 6 — No external keys needed

### 6.1 Assistant chat UI wiring — **done**
- `web/src/app/(app)/assistant/page.tsx` calls the real API (`POST
  /assistant/conversations`, `POST /assistant/conversations/{id}/messages`)
  with the auth token; loading, error and empty states are explicit.
- The store was rewired from the mock layer to the HTTP client.

### 6.2 Routing UI on map — **done**
- Route panel on the map page: pick from/to from `/route/locations`
  (real OSM nodes), call `/route`, show distance + the node path.
- The route is drawn on the map as a polyline over the OSM tile layer.

### 6.3 Nominatim geocoding — **done**
- `GET /api/v1/geocode?q=` proxies Nominatim (free, no key, correct
  `User-Agent`), returns lat/lon + display name.
- The map page has a search box that geocodes and drops a pin.

### 6.4 CI/CD (GitHub Actions) — **done**
- `.github/workflows/ci.yml`: backend (`ruff` → `pytest` against Postgres on
  **5433** + Redis on 6379 — the ports the test harness hardcodes),
  frontend (`eslint` → `next build` → `vitest`), and an E2E job that seeds
  the demo world, starts the API and runs the Playwright specs.
- `render.yaml` deploys the API; Vercel deploys the frontend.

### 6.5 Mobile responsive polish — **open**
- Sidebar hamburger drawer: **done**.
- Cards, tables, forms, topbar collapse, map full-width on mobile: **open**
  (audit report below lists the per-page gaps).

### 6.6 Free-tier deployability (added after the hosting plan) — **done**
Full plan with provider limits and trade-offs: **`docs/deployment-free-tier.md`**.

- **Routing graph memory**: 1546 MB → **200 MB peak / 167 MB resident**
  (flat forward-star arrays + chunked keyset pagination). Fits Render Free's
  512 MB. `api/app/services/routing_service.py`.
- **Ephemeral media**: pluggable storage backend — local disk in dev,
  S3-compatible (Cloudflare R2) in production. `api/app/services/media_storage.py`.
- **Evidence-photo bug**: the frontend built photo URLs without `exp`/`sig`,
  so every photo returned **403**. The API now issues the signed URL itself
  (`ReportOut.media_url`) and the frontend renders that.
- **Cold start**: the graph loads in a background task at startup
  (`ROUTING_PREWARM`), so `/health` answers immediately and `/route` waits on
  the build lock instead of failing.
- **Two-way streets**: `seed/seed_osm.py` now stores both directions of every
  non-one-way OSM way (9,720 one-way ways respected). Before the fix the
  router could not find half the street pairs.

## Phase 7 — Needs API keys

### 7.1 Traffic integration (TomTom free tier) — **blocked** (needs `TOMTOM_API_KEY`)
- Fetch traffic flow for route segments, fold the factor into the edge
  weights. The `routing_edges.traffic_factor` column and the
  `is_closed` closure flag already exist for this.

### 7.2 SMS/OTP auth (MSG91 or Twilio) — **blocked** (needs an SMS key)
- Phone-based registration/login, OTP verification, demo logins kept only as
  a gated `DEMO_MODE` affordance.

### 7.3 Image classification (OpenAI Vision or Google Vision) — **blocked** (needs a vision key)
- Classify the uploaded photo (fire/flood/crash/medical), auto-set the
  category, store the confidence on the assessment row.

## Phase 8 — Product decisions needed (future)
- Multi-tenant architecture
- Push notifications (FCM/APNs)
- Offline PWA support
- DPDP Act compliance
- Historical analytics dashboards
- Predictive dispatch (ML)
