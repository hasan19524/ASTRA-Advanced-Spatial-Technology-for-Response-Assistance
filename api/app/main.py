"""ASTRA API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

import asyncio as _asyncio

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import Response

from app.core.audit import AuditMiddleware
from app.core.config import settings
from app.core.database import dispose
from app.routers import (
    alerts,
    assistant,
    audit,
    auth,
    coordination,
    evidence,
    geocode,
    incidents,
    map_ws,
    org,
    poll,
    routing,
    simulation,
    stats,
    tasks,
    traffic,
    verification,
    voice,
    weather,
)
from app.services import media_storage
from app.services.media_storage import UPLOADS_DIR


async def _alert_sweeper():
    while True:
        try:
            from app.core.database import get_session_factory
            from app.services import alert_service

            async with get_session_factory()() as db:
                # Archive (never delete) expired alerts -- see
                # alert_service.archive_expired_alerts for why.
                await alert_service.archive_expired_alerts(db)
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
        await _asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sweeper = _asyncio.create_task(_alert_sweeper())
    prewarm = None
    # Pre-warm the routing graph cache (AD-4) so the first /route request is
    # fast. It is loaded in the BACKGROUND: the graph costs ~7 s and ~190 MB
    # to build, and blocking startup on it would make a free-tier container
    # look dead to its health check. The build is lock-protected, so a /route
    # request arriving mid-build waits for it instead of failing.
    if settings.routing_prewarm:

        async def _prewarm_graph():
            try:
                from app.core.database import get_session_factory
                from app.services import routing_service

                async with get_session_factory()() as db:
                    await routing_service.build_graph(db)
            except Exception:
                pass

        prewarm = _asyncio.create_task(_prewarm_graph())
    yield
    if prewarm is not None:
        prewarm.cancel()
        # wait for the cancellation to land so the task never outlives the
        # database engine disposal below
        await _asyncio.gather(prewarm, return_exceptions=True)
    sweeper.cancel()
    await _asyncio.gather(sweeper, return_exceptions=True)
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
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Every mutating request → one `audit_logs` row (append-only, AD-9 / vision.md §4).
# Added last = runs first (outermost), so it also observes auth/validation errors.
app.add_middleware(AuditMiddleware)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(evidence.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(org.router, prefix="/api/v1")
app.include_router(poll.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(verification.queue_router, prefix="/api/v1")
app.include_router(tasks.incidents_router, prefix="/api/v1")
app.include_router(coordination.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(alerts.ws_router)
app.include_router(stats.router, prefix="/api/v1")
app.include_router(traffic.router, prefix="/api/v1")
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
# The bytes come from the configured media backend (local disk in dev, an
# S3-compatible bucket in production); the access rule never changes.
if not media_storage.using_s3():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/uploads/{filename}")
async def serve_upload(
    filename: str, exp: int | None = Query(None), sig: str | None = Query(None)
) -> Response:
    error = media_storage.verify(filename, exp, sig)
    if error:
        raise HTTPException(status_code=403, detail=error)
    found = await media_storage.read_bytes(filename)
    if found is None:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = found
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=300"},
    )


@app.get("/health")
async def health() -> dict:
    from sqlalchemy import text

    checks = {"service": settings.app_name, "status": "ok"}
    try:
        from app.core.database import get_session_factory

        async with get_session_factory()() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        checks["status"] = "degraded"
    try:
        from app.core.database import get_redis

        r = get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
        checks["status"] = "degraded"
    # Routing graph state — honest about a cold or failed graph build instead
    # of pretending the feature works.
    try:
        from app.services import routing_service

        checks["routing_graph"] = (
            "ready" if routing_service.graph_ready() else "loading"
        )
    except Exception:
        checks["routing_graph"] = "unknown"
    checks["media_storage"] = "s3" if media_storage.using_s3() else "local"
    return checks
