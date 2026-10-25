# ASTRA — Backend (FastAPI)

Stack: Python 3.13 · FastAPI · SQLAlchemy (async) · PostgreSQL · Redis

## Setup

```bash
cd api
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt    # macOS/Linux: .venv/bin/pip
copy .env.example .env
```

## Run

```bash
.venv\Scripts\uvicorn app.main:app --reload      # macOS/Linux: .venv/bin/uvicorn
```

- Health check: http://localhost:8000/health
- Auto docs: http://localhost:8000/docs
- Contract: http://localhost:8000/openapi.json → regenerate frontend types with `npm run contracts:sync`

## Layout

```
api/
├─ app/
│  ├─ main.py      FastAPI app + CORS + /health
│  ├─ config.py    settings (pydantic-settings, reads .env)
│  └─ db.py        async SQLAlchemy engine + Redis client (lazy)
├─ requirements.txt
└─ .env.example
```
