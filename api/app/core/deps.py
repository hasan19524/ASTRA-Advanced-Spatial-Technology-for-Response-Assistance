"""FastAPI dependencies: current user + backend-enforced RBAC (vision.md §4)."""

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session_factory
from app.core.permissions import permissions_for
from app.core.security import decode_access_token
from app.models import User

_bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    async with get_session_factory()() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    claims = decode_access_token(credentials.credentials)
    user = await db.get(User, claims["sub"])
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or gone"
        )
    return user


def require_permission(permission: str) -> Callable:
    """Dependency factory: 401 without a valid token, 403 when the role lacks `permission`."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if permission not in permissions_for(user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return user

    return checker
