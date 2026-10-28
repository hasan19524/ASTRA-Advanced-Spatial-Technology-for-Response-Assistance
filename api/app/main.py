"""ASTRA API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.audit import AuditMiddleware
from app.core.config import settings
from app.core.database import dispose
from app.routers import auth, incidents, map_ws, tasks
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
# live map channel — no /api/v1 prefix (frozen Day 3 contract, AD-10 query auth)
app.include_router(map_ws.router)

# AD-8: evidence photos — plain static route (dir must exist before mount).
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
