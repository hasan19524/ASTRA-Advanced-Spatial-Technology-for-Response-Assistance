# ASTRA — Local Setup & Development

This guide covers getting ASTRA running on a developer machine. It complements
`README.md` (installation overview) with the operational details needed to run,
test, and verify the stack locally.

The full stack has three parts:

| Part | Runs where | Technology |
|------|-----------|------------|
| Infrastructure | Docker Compose | PostgreSQL 16 + Redis 7 |
| Backend | Python (host or container) | FastAPI 0.115.6 |
| Frontend | Node (host) | Next.js 16 / Turbopack |

## Prerequisites

- Docker Desktop (Postgres `:5433`, Redis `:6379`)
- Node.js 22+ and npm
- Python 3.13 + pip
- ffmpeg (system dependency for WebM → WAV voice transcoding)

## 1. Clone

```powershell
git clone https://github.com/hasan19524/ASTRA-Advanced-Spatial-Technology-for-Response-Assistance.git
cd ASTRA-Advanced-Spatial-Technology-for-Response-Assistance/code
```

The repository root for all commands below is `code/` (the nested git repo
containing `api/`, `web/`, `seed/`, `scripts/`, `docs/`).

## 2. Environment configuration

Copy the example files and fill in real values. Never commit `.env`.

```powershell
copy api\.env.example api\.env
# If a root .env.example exists:
copy .env.example .env
```

Minimum variables for local development (`api/.env`):

| Variable | Example | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | `python -c "import secrets;print(secrets.token_hex(32))"` | Required; the app refuses to boot without a non-default value |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5433/astra` | Local Postgres via Docker |
| `REDIS_URL` | `redis://localhost:6379/0` | Local Redis via Docker |
| `DEMO_MODE` | `true` | Enables `POST /api/v1/auth/demo-login` (demo accounts) |
| `GNANI_API_KEY` | (operator) | Gnani STT/TTS — register at app.gnani.ai |
| `WEATHER_API_KEY` | (operator) | OpenWeatherMap — register at openweathermap.org |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` | (optional) | LLM providers; leave blank to use `rules_stub` |

All other variables have safe defaults in `api/.env.example` and
`api/app/core/config.py`. Real keys live in gitignored `.env` files only.

## 3. Start the infrastructure

```powershell
docker compose up -d
```

Wait ~25 s for Docker Desktop, then confirm:

```powershell
docker compose ps
# astra-db-1, astra-redis-1 healthy
```

Verify the API health endpoint once the backend is running (section 5):

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health"
# → {"status":"ok","database":"ok","redis":"ok","routing_graph":"ready",…}
```

## 4. Database schema

Migrations run on API boot (`alembic upgrade head` in the Dockerfile CMD).
For local development without Docker:

```powershell
cd api
alembic upgrade head
```

Migrations are at head `9974fb9d202a`. Production never uses
`metadata.create_all`; schema changes go through Alembic.

## 5. Start the backend

```powershell
cd api
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

- Health check: http://localhost:8000/health
- Auto docs: http://localhost:8000/docs
- OpenAPI contract: http://localhost:8000/openapi.json

## 6. Start the frontend

```powershell
cd web
npm install   # first time only
npm run dev   # :3000, Turbopack
```

The frontend talks to the API at `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:8000`).

## 7. Seed the demo world (optional, for demos)

```powershell
python seed/seed.py
```

Demo logins (password `astra-demo-2026`):

| Login | Role |
|-------|------|
| `citizen@astra.dev` | Citizen |
| `officer@astra.dev` | Verification Officer |
| `admin@astra.dev` | Central Admin |
| `dephead@astra.dev` | Department Head |
| `team@astra.dev` | Response Team |

## 8. Run the checks

Backend (real Postgres + Redis via Docker):

```powershell
cd api
python -m ruff check app tests
python -m pytest -q
```

Frontend:

```powershell
cd web
npm run lint    # eslint
npm run build   # Next.js Turbopack production build + type check
npm run test    # vitest unit tests
npx playwright test --workers=1  # E2E (needs dev server on :3000)
```

Live-stack verification (against the running API, no mocks):

```powershell
# auth: registration, login, refresh, RBAC, argon2id salt proof
powershell -File scripts\verify-auth.ps1

# dispatch arc: report → task → phase ladder → close/reopen → alerts → stats
powershell -File scripts\verify-module1.ps1
```

`verify-module1.ps1` needs `DEMO_MODE=true` and the seeded demo accounts.

## 9. Troubleshooting

- **API won't boot:** `JWT_SECRET` is empty or a known default — set a random
  value in `api/.env`.
- **`/health` reports `routing_graph: loading`:** the OSM graph (~406k nodes)
  is still being pre-warmed in the background (~7 s). Wait and retry.
- **Voice STT fails with 400:** confirm ffmpeg is on PATH or that
  `imageio-ffmpeg` is installed (`pip install imageio-ffmpeg==0.6.0`).
- **Tests hang on `dispose()`:** asyncpg/Redis clients are bound per event
  loop; `conftest.py` uses `reset_clients()`/`dispose()` to avoid cross-loop
  deadlocks (AD-38).