# ASTRA — 100% free-tier deployment plan

Verified against each provider's current published pricing/limits (checked
2026-11-08). Every number below is the provider's published free-tier limit,
not an estimate.

**The stack, and where each piece runs**

| Piece | Provider (free) | Why this one | Measured limit that matters |
|---|---|---|---|
| API (FastAPI) | **Render** Web Service, `free` | Docker runtime, WebSockets, `render.yaml` IaC | 512 MB RAM / 0.1 CPU, spins down after 15 min idle, **ephemeral filesystem** |
| Frontend (Next.js) | **Vercel** Hobby | Next.js is a first-class citizen, global CDN | 100 GB fast transfer, 1M function invocations, **non-commercial use only** |
| Database (Postgres) | **Neon** Free | 1 GB (ASTRA's seeded DB is 393 MB), PostGIS, no expiry | 1 GB/project, 100 CU-hours/project, scales to zero **without** pausing |
| Redis | **Render Key Value** `free` | Same private network as the API, no TLS hassle | 25 MB, **in-memory only** |
| Evidence photos | **Cloudflare R2** | 10 GB-month free, **egress free** | 1M Class A + 10M Class B ops/month |

Rejected alternatives and why:

- **Supabase Free** — 500 MB database (ASTRA's seeded DB is 393 MB = 79% of
  the quota before a single new incident) and the project is **paused after 1
  week of inactivity**. Supabase remains the better choice only if you need
  Auth/Storage in the dashboard; the API has its own JWT auth and uses R2 for
  files. Neon is the correct DB for this dataset.
- **Render Free Postgres** — **expires after 30 days**. Unusable as a target.
- **Render Free disks** — persistent disks are not available on the free plan.
- **Koyeb** — no free compute tier (Pro is $29/mo + compute).
- **Fly.io** — free allowances were removed; the smallest instance is paid.
- **Railway** — $5 trial credit, then paid.
- **Upstash Redis** — works, but the free tier is 10k requests/day and the
  TCP/TLS setup is more work than Render's in-network Key Value.

---

## The two hard blockers (and how the code now answers them)

### 1. Render Free has 512 MB of RAM — the routing graph used 1546 MB

The Delhi-NCR graph is 406,154 OSM nodes / 879,902 edges (every two-way way
is stored in both directions; 9,720 one-way ways are respected). The original
implementation materialised every row as a SQLAlchemy object:

| Implementation | Peak RSS | Build time |
|---|---|---|
| ORM objects + dict-of-lists adjacency | **1546 MB** | 23.4 s |
| `db.stream()` of both tables (buffers the result set) | 373 MB | 28.2 s |
| **Forward-star arrays + chunked keyset pagination (ships)** | **200 MB** | **4.8 s** |

What changed in `api/app/services/routing_service.py`:

- The adjacency list lives in flat `array` buffers (`head`/`nxt`/`to`/`wt`) —
  16 bytes per edge instead of a Python tuple + float + list slot.
- Rows are pulled from Postgres in 50,000-row chunks with keyset pagination
  (`WHERE id > :last ORDER BY id LIMIT n`), so no result set is ever fully
  buffered.
- Resident memory after the build: **167 MB** — the app's whole process stays
  around 250 MB, which fits 512 MB with room for the request path.
- The graph is loaded in a **background task** at startup (`ROUTING_PREWARM`),
  so the container answers `/health` immediately instead of looking dead for
  five seconds. `/route` waits on the same lock and never returns a fake
  route: if the graph is unavailable it answers `routing unavailable`.
- `api/Dockerfile.prod` now runs **one** worker by default
  (`WEB_CONCURRENCY`, default 1). Two workers would hold two copies of the
  graph (≈340 MB) and OOM the free tier.

### 2. Render's filesystem is ephemeral — uploaded photos disappeared

`api/uploads/` was wiped on every redeploy and every spin-down. The API now
has a pluggable media backend (`api/app/services/media_storage.py`):

```
MEDIA_STORAGE=local   # api/uploads/ — development
MEDIA_STORAGE=s3      # Cloudflare R2 / AWS S3 / MinIO — production
```

The access rule does not change: the API always proxies the bytes through the
signed-URL route (`/uploads/<name>?exp=…&sig=…`), so the HMAC contract from
AD-8 and audit finding S5 still holds. R2's egress is free, so proxying costs
nothing.

**A real bug was found and fixed while doing this**: the frontend built photo
URLs as `${API_URL}${media_path}` — with no `exp` and no `sig`. The API
requires both, so **every evidence photo returned 403**. The API now issues
the signed URL itself (`ReportOut.media_url`) and the frontend renders that,
falling back to a placeholder if the link has expired.

---

## Step-by-step: deploy ASTRA for ₹0

### Step 1 — Neon (Postgres)

1. Sign up at <https://neon.tech>, create a project named `astra`, pick the
   region closest to Delhi (`ap-southeast-1`, Mumbai/Singapore).
2. Create a branch/database `astra`.
3. Copy the **pooled** connection string and change the driver:
   `postgresql+asyncpg://USER:PASSWORD@HOST/astra?sslmode=require`.
4. Keep the **direct** (non-pooled) URL too — the seed script and Alembic
   want a direct connection.

### Step 2 — Cloudflare R2 (evidence photos)

1. Cloudflare dashboard → **R2** → *Create bucket* → `astra-evidence`.
2. *Manage R2 API Tokens* → create a token with **Object Read & Write** for
   that bucket.
3. Note the **S3 API endpoint** (`https://<account>.r2.cloudflarestorage.com`),
   the Access Key ID and the Secret Access Key. Region is `auto`.
4. No public access bucket needed — the API signs and serves every file.

### Step 3 — Render (API + Redis)

1. New → **Blueprint** → point at this repo. `render.yaml` creates:
   - `astra-redis` — Key Value, `free` (25 MB), internal-only.
   - `astra-api` — Web Service, Docker (`api/Dockerfile.prod`), `free`.
2. Render prompts for the `sync: false` values. Fill in:
   - `DATABASE_URL` — the Neon pooled URL from step 1.
   - `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY` — from step 2.
   - `CORS_ORIGINS` — a **JSON array** with your Vercel URL, e.g.
     `["https://astra.vercel.app"]`. The parser expects JSON, not a
     comma-separated string.
   - `JWT_SECRET` — leave `generateValue: true`; Render generates it.
3. Optional free-tier keys: `GROQ_API_KEY`, `OPENROUTER_API_KEY`,
   `NVIDIA_API_KEY` (assistant), `GNANI_API_KEY` (voice), `WEATHER_API_KEY`
   (weather). Empty is fine — the app degrades honestly instead of faking
   data.
4. `MEDIA_STORAGE=s3` is already set by the blueprint.

### Step 4 — Seed the database (once)

The routing graph must be seeded from real OpenStreetMap data:

```bash
# on any machine with the repo + Python (NOT on the free Render instance —
# the Overpass download and the 880k inserts take ~3 minutes and ~400 MB)
pip install httpx
python seed/fetch_osm_roads.py          # → _delhi_roads.json (47 MB)
DATABASE_URL=postgresql+asyncpg://…/astra python seed/seed.py
DATABASE_URL=postgresql+asyncpg://…/astra python seed/seed_osm.py
```

`seed/seed_osm.py` writes 406,154 nodes and 879,902 edges (≈393 MB).
`seed/fetch_osm_roads.py` is new: it fetches the Overpass JSON with the
mandatory `User-Agent: ASTRA/1.0` header (Overpass answers **406** without
it), retries on 429/504, validates the payload and writes atomically so an
interrupted run can never corrupt the seed.

### Step 5 — Vercel (frontend)

1. New Project → import this repo → **Root Directory: `web`**.
2. Environment variable: `NEXT_PUBLIC_API_URL=https://astra-api.onrender.com`.
   It must be set at build time (it is `NEXT_PUBLIC_*`), so add it before the
   first deploy.
3. Deploy. `web/vercel.json` pins the framework, the Mumbai region (`bom1`)
   and the security headers.
4. Copy the deployed URL into Render's `CORS_ORIGINS` and redeploy the API
   (or update the env var — Render applies env changes on the next deploy).

### Step 6 — CI/CD

`.github/workflows/ci.yml` runs on every push and PR:
`ruff` → `pytest` (Postgres on 5433, Redis on 6379 — the ports the test
harness hardcodes) → `eslint` → `next build` → `vitest` → Playwright E2E
against a real seeded API. Render is set to `autoDeployTrigger: commit`, so
a green main deploys the API; Vercel deploys the frontend on its own.

---

## The honest trade-offs of running everything on free tiers

| Limit | What it means for ASTRA | Mitigation (already in the code) |
|---|---|---|
| Render spins down after 15 min idle | The first request after a quiet period waits ~1 min for a cold start | Acceptable for a demo; a paid instance removes it. Nothing is lost — all state is in Postgres/R2 |
| Render Free: 512 MB, 0.1 CPU | Dijkstra over 880k edges is in-memory and fast, but the container is slow under load | The graph is 167 MB resident, leaving headroom; one worker, not two |
| Render filesystem is ephemeral | Nothing may be stored on disk | `MEDIA_STORAGE=s3` (R2) for photos; no other state is on disk |
| Render Key Value is in-memory (25 MB) | Redis state is lost on restart | Redis only carries pub/sub fan-out and rate-limit counters — both rebuild themselves. The Postgres `alerts` table is the source of truth |
| Neon 100 CU-hours/project | The DB auto-suspends after 5 min idle and resumes in ~1 s; it does **not** pause like Supabase | Nothing to do; the API's first query after a cold DB pays a resume |
| Neon 1 GB storage | The seeded DB is 393 MB (78%) | `audit_logs` is the only table that grows without bound — prune it periodically, or the project will hit the limit |
| Vercel Hobby is non-commercial | Fine for a portfolio/demo; **not** allowed for a commercial product | Move to a paid Vercel account (or Cloudflare Pages) before commercial use |
| Vercel 100 deployments/day | Not a real constraint for this project | — |
| R2 10 GB-month | ~10k evidence photos at ~1 MB each | Fine for a demo; the API caps each photo at 5 MB |
| Weather API | OpenWeatherMap free tier is capped per minute | The app shows the cached value and an honest "stale" marker |

## What is deliberately **not** on a free tier

- **Push notifications** (Phase 8) — no free provider with a reliable
  delivery guarantee; the web app uses WebSockets instead.
- **A second API instance / blue-green deploys** — Render Free allows one.
- **Managed queues** — the background work here (alert expiry sweeper, weather
  ingestion) runs inside the API process as an asyncio task.

## If you later need to pay (the smallest sensible step up)

| Need | Cheapest fix | Cost |
|---|---|---|
| No cold starts | Render `starter` (512 MB, no spin-down) | $7/mo |
| More DB headroom | Neon `scale` 4 GB | $19/mo |
| Commercial Vercel | Vercel Pro | $20/mo |
| Persistent local files | Render disk (paid only) | +$0.25/GB-mo |

Everything above is optional: the free configuration runs the complete
product — real OSM routing, live weather, real incidents, real evidence
photos, live map updates over WebSockets.
