"""Weather router — Phase 6 (real-time weather integration)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit_auth
from app.models import User
from app.services import weather_service as svc

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current")
async def current(
    lat: float = 28.6139,
    lon: float = 77.2090,
    user: User = Depends(get_current_user),
    _rl=Depends(rate_limit_auth),
):
    try:
        return await svc.fetch_weather(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/delhi")
async def delhi(
    user: User = Depends(get_current_user),
    _rl=Depends(rate_limit_auth),
):
    return await svc.fetch_all_delhi()
