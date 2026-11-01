"""Routing router — Phase 3 (AD-4)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.services import routing_service as svc

router = APIRouter(prefix="/route", tags=["routing"])


@router.get("")
async def route(
    from_id: str = Query(...),
    to_id: str = Query(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await svc.shortest_path(db, from_id, to_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=result["error"]
        )
    return result


@router.get("/locations")
async def locations(
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    locs = await svc.list_locations(db, limit)
    return [
        {
            "id": loc.id,
            "name": loc.name,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "kind": loc.kind,
        }
        for loc in locs
    ]
