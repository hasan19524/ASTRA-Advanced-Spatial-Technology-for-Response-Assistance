"""Rate limiting dependency for auth endpoints."""

from fastapi import HTTPException, Request, status

from app.core.database import get_redis


async def rate_limit_auth(request: Request, limit: int = 10, window: int = 60):
    """Allow `limit` requests per `window` seconds per IP."""
    try:
        r = get_redis()
        ip = request.client.host if request.client else "unknown"
        key = f"rl:auth:{ip}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window)
        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Try again later.",
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis down → don't block


async def hit(key: str, limit: int, window: int) -> bool:
    """Return True if under the limit, False if exceeded. Redis-backed."""
    try:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window)
        return count <= limit
    except Exception:
        return True  # Redis down -> don't block
