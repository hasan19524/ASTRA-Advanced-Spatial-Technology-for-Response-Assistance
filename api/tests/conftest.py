"""Test harness — isolated `astra_test` database on the Docker Postgres (:5433).

DATABASE_URL / JWT_SECRET are set BEFORE any `app.*` import because
`app.core.config` instantiates Settings at import time.
"""

import asyncio
import os

os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://postgres:postgres@localhost:5433/astra_test"
)
os.environ["JWT_SECRET"] = "test-secret"

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402

from app.core import database  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

_ADMIN_URL = "postgresql://postgres:postgres@localhost:5433/postgres"
_TEST_DB = "astra_test"


def _ensure_database() -> None:
    """CREATE DATABASE astra_test if it does not exist yet."""

    async def go() -> None:
        import asyncpg

        conn = await asyncpg.connect(_ADMIN_URL)
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", _TEST_DB
            )
            if not exists:
                await conn.execute(f"CREATE DATABASE {_TEST_DB}")
        finally:
            await conn.close()

    asyncio.run(go())


def _reset_tables() -> None:
    """Drop + recreate schema so every pytest run starts clean."""

    async def go() -> None:
        engine = database.get_engine()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(go())
    database.get_engine.cache_clear()
    database.get_session_factory.cache_clear()


_ensure_database()
_reset_tables()


@pytest_asyncio.fixture(autouse=True)
async def _engine_per_test():
    """Fresh engine/pool per test, bound to that test's event loop.

    The engine is lru_cached at module level; reusing a pool across
    pytest-asyncio's per-function loops raises "attached to a different loop".
    """
    database.get_engine.cache_clear()
    database.get_session_factory.cache_clear()
    database.get_redis.cache_clear()
    yield
    if database.get_engine.cache_info().currsize:
        await database.get_engine().dispose()
    database.get_engine.cache_clear()
    database.get_session_factory.cache_clear()


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as c:
        yield c
