"""Registration, login, and token issuance."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import permissions_for
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department=user.department,
        permissions=permissions_for(user.role),
    )


def issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        user=user_out(user),
    )


async def register_user(db: AsyncSession, payload: RegisterRequest) -> User:
    """Self-registration always creates a CITIZEN.

    Staff roles (admin, dept head, team, verification officer) are provisioned by the
    seed script only — roles are assigned by authority, never self-selected (vision.md §3).
    """
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role="CITIZEN",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, payload: LoginRequest) -> User:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    # Same generic error whether the email exists or the password is wrong (no enumeration).
    if (
        user is None
        or not user.is_active
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return user


async def demo_login(db: AsyncSession, email: str) -> User:
    """Server-side demo login (audit S1).

    Active only when DEMO_MODE=true; otherwise 403. Unknown / inactive
    accounts also yield 403 so there is no enumeration surface, and the
    password never leaves the server.
    """
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Demo login disabled"
        )
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Demo login disabled"
        )
    return user
