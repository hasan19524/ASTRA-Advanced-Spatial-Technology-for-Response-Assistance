"""Auth endpoints — /api/v1/auth/*"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.security import decode_refresh_token
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    payload: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Self-registration always yields a CITIZEN account (staff roles are seeded, AD-7)."""
    user = await auth_service.register_user(db, payload)
    return auth_service.issue_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    user = await auth_service.authenticate(db, payload)
    return auth_service.issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    claims = decode_refresh_token(payload.refresh_token)
    user = await db.get(User, claims["sub"])
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )
    return auth_service.issue_tokens(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout() -> None:
    """Stateless JWT: the client discards both tokens.

    Tradeoff (AD-2): refresh tokens stay valid until expiry (~7 days). Server-side
    revocation would need a Redis denylist — parked, not built.
    """


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return auth_service.user_out(user)
