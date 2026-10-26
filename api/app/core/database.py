"""Database (PostgreSQL) and cache (Redis) connection setup.

Infrastructure only — no models or queries yet.
"""

from functools import lru_cache

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from app.core.config import settings


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(settings.database_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> async_sessionmaker:
    from sqlalchemy.ext.asyncio import AsyncSession

    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)


@lru_cache
def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def dispose() -> None:
    """Close pooled connections on shutdown."""
    await get_engine().dispose()
    await get_redis().aclose()
