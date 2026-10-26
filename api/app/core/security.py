"""Password hashing (Argon2 — salt is generated per hash) and JWT issue/verify.

AD-9: this file owns all credential cryptography. Nothing else hashes or signs.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException, status

from app.core.config import settings

# Argon2id: salt is embedded in each hash string (unique per password),
# so we never store or manage salts ourselves.
_hasher = PasswordHasher(time_cost=2, memory_cost=64 * 1024, parallelism=2)


# ---------------------------------------------------------------- passwords
def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    # argon2-cffi 23.x signature is verify(hash, password) — hash FIRST.
    # (Got this backwards once; login 401'd on every correct password. Keep the pin.)
    try:
        return _hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ---------------------------------------------------------------- JWT
def _encode(payload: dict[str, Any], lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    claims = {**payload, "iat": now, "exp": now + lifetime, "iss": "astra"}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer="astra",
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc


def create_access_token(user_id: str, role: str) -> str:
    return _encode(
        {"sub": user_id, "role": role, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _encode(
        {"sub": user_id, "type": "refresh", "jti": str(uuid4())},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> dict[str, Any]:
    claims = _decode(token)
    if claims.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token"
        )
    return claims


def decode_refresh_token(token: str) -> dict[str, Any]:
    claims = _decode(token)
    if claims.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token"
        )
    return claims
