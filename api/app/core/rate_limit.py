"""Redis vote rate limiter (Day 4, AD-12).

Fail-open by design: a Redis blip never blocks voting — it only logs.
"""

import logging

from app.core.database import get_redis

logger = logging.getLogger(__name__)


async def hit(key: str, limit: int, window_seconds: int) -> bool:
    """Return True if the request is within the rate limit.

    Redis INCR + EXPIRE per key. On any Redis error we fail open (True)
    and log — availability beats perfect rate accounting here.
    """
    try:
        redis = get_redis()
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, window_seconds)
        return current <= limit
    except Exception:  # fail open on any Redis failure
        logger.warning("rate limiter fail-open for %s", key)
        return True
