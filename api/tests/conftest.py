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
# Tests must be deterministic: never let a developer's local .env switch the
# assessment path to a live LLM (assessment rows are pinned to rules_stub).
os.environ["ASSESSMENT_BACKEND"] = "rules"
# The routing graph pre-warm runs in the background at startup. In tests the
# schema is dropped and recreated between every test, so a background graph
# build would race the DDL — tests build the graph explicitly when they need
# it (tests/test_routing.py).
os.environ["ROUTING_PREWARM"] = "false"
for _k in (
    "LLM_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "NVIDIA_API_KEY",
    "GNANI_API_KEY",
):
    os.environ[_k] = ""

import httpx  # noqa: E402
import pytest  # noqa: E402
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
    database.reset_clients()


_ensure_database()
_reset_tables()


async def _async_reset_tables() -> None:
    engine = database.get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    database.reset_clients()


@pytest.fixture(autouse=True)
def _reset_db_per_test():
    """Reset the test database before every test (sync + async)."""
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_async_reset_tables())
    finally:
        loop.close()
    yield


@pytest_asyncio.fixture(autouse=True)
async def _engine_per_test():
    """Fresh engine/pool per test, bound to that test's event loop."""
    database.reset_clients()
    # The auth rate limiter counts attempts in Redis. Those counters must not
    # leak between tests, or a long suite trips its own 429s (the whole suite
    # runs from 127.0.0.1). Production keeps the counters; tests start clean.
    try:
        r = database.get_redis()
        async for key in r.scan_iter(match="rl:*"):
            await r.delete(key)
    except Exception:
        pass
    yield
    # Close this loop's engine + Redis client, then drop every cached
    # client. The clients are cached per event loop (see
    # app/core/database.py): the app under test runs on an anyio portal
    # loop while this fixture runs on the pytest-asyncio loop, so the two
    # must never share (or close) each other's connections.
    await database.dispose()
    database.reset_clients()


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as c:
        yield c
