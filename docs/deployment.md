# ASTRA — Deployment Guide

ASTRA is designed for free-tier hosting but **has not been deployed to
production**. This document describes the intended deployment topology and how
to deploy it. No production URL exists yet; do not claim one.

## Intended free-tier stack

| Piece | Provider | Free-tier limit | Notes |
|-------|----------|-----------------|-------|
| API (FastAPI) | Render Web Service (free) | 512 MB RAM, 0.1 CPU, spins down after 15 min idle, ephemeral filesystem | `render.yaml` defines the service |
| Frontend (Next.js) | Vercel Hobby | 100 GB bandwidth/month | Next.js first-class on Vercel |
| Database (Postgres) | Neon Free | 1 GB storage, pauses after 1 week inactive | ASTRA's seeded DB is ~393 MB |
| Redis | Render Key Value (free) | 25 MB, in-memory only | Rate limiting + WS pub/sub |
| Evidence photos | Cloudflare R2 | 10 GB-month, egress free | Required in production (Render disk ephemeral) |

Rejected alternatives and why are documented in `docs/deployment-free-tier.md`.

## Local deployment (docker-compose)

```yaml
db:    postgres:16-alpine, host port 5433 (localhost-only)
redis: redis:7-alpine, host port 6379 (localhost-only)
api:   FastAPI build from ./api, host port 8000 (localhost-only)
```

```powershell
docker compose up -d
```

All published ports are bound to `127.0.0.1` — venue Wi-Fi must never reach
the DB. The frontend (`web/`) runs locally with `npm run dev` on `:3000`.

## Production deployment (Render blueprint)

`render.yaml` defines:
- `astra-redis` — Render Key Value (free, 25 MB)
- `astra-api` — Render Web Service (free, Docker, `./api/Dockerfile.prod`,
  `WEB_CONCURRENCY: 1`)

Render free Postgres expires after 30 days, so Postgres is **not** in
`render.yaml` — use Neon instead and paste its URL into `DATABASE_URL`.

Secrets use `sync: false` — Render prompts for them at blueprint launch;
nothing is stored in the file:

```
DATABASE_URL, JWT_SECRET, S3_ENDPOINT_URL, S3_ACCESS_KEY_ID,
S3_SECRET_ACCESS_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY,
GNANI_API_KEY, WEATHER_API_KEY
```

## Memory constraints (critical)

The OSM Delhi-NCR routing graph (406,154 nodes / 879,902 edges) is loaded into
memory as forward-star flat arrays: ~200 MB peak, ~167 MB resident. Two
workers would hold two copies (~340 MB) and OOM the 512 MB free container, so
`WEB_CONCURRENCY=1` is mandatory on Render Free. Redis is not in the routing
path.

## Media storage in production

`MEDIA_STORAGE=s3` is required in production because Render's filesystem is
ephemeral (every redeploy/spin-down wipes `api/uploads/`). The API always
proxies evidence bytes through the signed-URL route; the HMAC contract is
unchanged.

## What is NOT yet deployed

- No production deployment exists on Render, Vercel, or Neon.
- Real API keys (Groq, OpenRouter, NVIDIA, Gnani, OpenWeatherMap) were pasted
  in chat earlier in the project and **must be rotated** before any production
  deploy.
- The public demo video is not yet recorded; link to it instead of committing
  large video files.

## Pre-deploy checklist

- [ ] Rotate all Gnani / LLM / weather keys that were ever exposed in chat
- [ ] `api/.env` has a strong, non-default `JWT_SECRET`
- [ ] `MEDIA_STORAGE=s3` with valid R2/S3 credentials
- [ ] `WEB_CONCURRENCY=1` on the free tier
- [ ] Alembic migrations at head (`alembic upgrade head`)
- [ ] `ruff check app tests` clean; `pytest` green
- [ ] `npm run lint`, `npm run build`, `npm run test` clean