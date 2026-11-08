"""Rate limiting dependency for auth endpoints."""

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.database import get_redis


async def rate_limit_auth(
    request: Request, limit: int | None = None, window: int | None = None
):
    """Allow `limit` requests per `window` seconds per IP **and endpoint**.

    The endpoint is part of the key on purpose: a burst of registrations must
    not lock every citizen out of logging in from the same NAT address
    (mobile carriers and campus networks share one public IP), while brute
    force on a single endpoint is still capped.
    """
    limit = settings.auth_rate_limit if limit is None else limit
    window = settings.auth_rate_window_seconds if window is None else window
    try:
        r = get_redis()
        ip = request.client.host if request.client else "unknown"
        key = f"rl:auth:{request.url.path}:{ip}"
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
