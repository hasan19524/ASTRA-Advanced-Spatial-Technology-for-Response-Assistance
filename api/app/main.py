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
from app.routers import auth, incidents, map_ws, poll, tasks, verification
from app.services.incident_service import UPLOADS_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connections are created lazily; nothing to open at startup yet.
    yield
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
