"""Database (PostgreSQL) and cache (Redis) connection setup.

Infrastructure only — no models or queries yet.

Both clients are cached **per event loop**, not process-wide.

Why per loop: an asyncpg connection and a redis-py connection each own
socket transports that are bound to the event loop that opened them.
Closing one from a *different* loop never completes — the transport's
close future is scheduled on the original loop, which is either busy or
already closed — so a process-wide cache turns a cross-loop shutdown into
an infinite hang.

This is not hypothetical. The test harness runs the FastAPI app on an
anyio portal loop (the `TestClient`) while the test body runs on the
pytest-asyncio loop. A Redis client created by the test body was then
closed by the app's lifespan shutdown on the portal loop, and the suite
hung forever in `dispose()`. The same latent bug existed for the
database engine.

In production there is exactly one event loop per process, so the
per-loop cache holds one entry and behaves exactly like the old
process-wide one. See `docs/architecture.md` AD-38.
"""

import asyncio
from typing import Any

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.core.config import settings


def _loop_key() -> Any:
    """Cache key for the running event loop (`None` outside a loop)."""
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


_ENGINES: dict[Any, AsyncEngine] = {}
_FACTORIES: dict[Any, async_sessionmaker] = {}
_REDIS: dict[Any, Redis] = {}


def get_engine() -> AsyncEngine:
    """The SQLAlchemy async engine for the current event loop."""
    key = _loop_key()
    engine = _ENGINES.get(key)
    if engine is None:
        engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        _ENGINES[key] = engine
    return engine


def get_session_factory() -> async_sessionmaker:
    """The async session factory for the current event loop."""
    key = _loop_key()
    factory = _FACTORIES.get(key)
    if factory is None:
        from sqlalchemy.ext.asyncio import AsyncSession

        factory = async_sessionmaker(
            get_engine(), class_=AsyncSession, expire_on_commit=False
        )
        _FACTORIES[key] = factory
    return factory


def get_redis() -> Redis:
    """The Redis client for the current event loop."""
    key = _loop_key()
    client = _REDIS.get(key)
    if client is None:
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        _REDIS[key] = client
    return client


def reset_clients() -> None:
    """Drop every cached client without closing it.

    Test-harness only. Call `dispose()` first on the loop that owns the
    clients if they should be closed gracefully — closing a client from
    the wrong loop is exactly the bug this module exists to avoid.
    """
    _ENGINES.clear()
    _FACTORIES.clear()
    _REDIS.clear()


async def dispose() -> None:
    """Close the pooled connections owned by the CURRENT event loop.

    Clients belonging to another loop are deliberately left alone: they
    cannot be closed from here without hanging. In production this is
    every client that exists.
    """
    key = _loop_key()
    _FACTORIES.pop(key, None)
    engine = _ENGINES.pop(key, None)
    if engine is not None:
        await engine.dispose()
    client = _REDIS.pop(key, None)
    if client is not None:
        await client.aclose()
