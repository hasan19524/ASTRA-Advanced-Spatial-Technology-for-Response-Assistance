"""ASTRA API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

import hashlib
import hmac
import time

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.audit import AuditMiddleware
from app.core.config import settings
from app.core.database import dispose
from app.routers import alerts, assistant, audit, auth, coordination, geocode, incidents, map_ws, poll, routing, simulation, stats, tasks, verification, voice, weather
from app.services.incident_service import UPLOADS_DIR


import asyncio as _asyncio

async def _alert_sweeper():
    while True:
        try:
            from datetime import datetime, timezone
            from sqlalchemy import delete
            from app.core.database import get_session_factory
            from app.models import Alert
            async with get_session_factory()() as db:
                await db.execute(
                    delete(Alert).where(Alert.expires_at.is_not(None), Alert.expires_at < datetime.now(timezone.utc))
                )
                await db.commit()
        except Exception:
            pass
        # Weather ingestion tick (every 5 min)
        try:
            from app.core.database import get_session_factory
            from app.services import weather_service
            async with get_session_factory()() as wdb:
                await weather_service.weather_ingestion_tick(wdb)
        except Exception:
            pass
        await _asyncio.sleep(60)

@asynccontextmanager
async def lifespan(app: FastAPI):
    sweeper = _asyncio.create_task(_alert_sweeper())
    # Pre-warm the routing graph cache (AD-4) so the first /route request is fast
    try:
        from app.core.database import get_session_factory
        from app.services import routing_service
        async with get_session_factory()() as db:
            await routing_service.build_graph(db)
    except Exception:
        pass
    yield
    sweeper.cancel()
    await dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every mutating request → one `audit_logs` row (append-only, AD-9 / vision.md §4).
# Added last = runs first (outermost), so it also observes auth/validation errors.
app.add_middleware(AuditMiddleware)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(poll.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(verification.queue_router, prefix="/api/v1")
app.include_router(tasks.incidents_router, prefix="/api/v1")
app.include_router(coordination.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(alerts.ws_router)
app.include_router(stats.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")
app.include_router(weather.router, prefix="/api/v1")
app.include_router(geocode.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(routing.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
# live map channel — no /api/v1 prefix (frozen Day 3 contract, AD-10 query auth)
app.include_router(map_ws.router)

# AD-8: evidence photos - served only with a valid signed URL (audit S5).
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/uploads/{filename}")
async def serve_upload(
    filename: str, exp: int | None = Query(None), sig: str | None = Query(None)
) -> FileResponse:
    if exp is None or sig is None:
        raise HTTPException(status_code=403, detail="Missing signature")
    if int(exp) < int(time.time()):
        raise HTTPException(status_code=403, detail="Signed URL expired")
    expected = hmac.new(
        settings.jwt_secret.encode(), f"{filename}:{exp}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")
    path = UPLOADS_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
