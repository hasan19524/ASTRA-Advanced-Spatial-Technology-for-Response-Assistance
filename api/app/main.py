"""ASTRA API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.audit import AuditMiddleware
from app.core.config import settings
from app.core.database import dispose
from app.routers import auth, tasks


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
app.include_router(tasks.router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}
