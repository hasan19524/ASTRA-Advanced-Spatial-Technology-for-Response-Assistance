"""Weather router — Phase 6 (real-time weather integration)."""

from fastapi import APIRouter, HTTPException, status

from app.services import weather_service as svc

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current")
async def current(lat: float = 28.6139, lon: float = 77.2090):
    try:
        return await svc.fetch_weather(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/delhi")
async def delhi():
    return await svc.fetch_all_delhi()
