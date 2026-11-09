"""Routing router — Phase 3 (AD-4)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models import MapLocation
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


@router.get("/nearest")
async def nearest(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Snap an arbitrary point to the closest routable junction.

    The map routes between places that are not graph nodes (an incident
    pin, a geocoded address, the user's position). This endpoint does the
    snapping so the client does not have to know about the graph.
    """
    node = await svc.nearest_node(db, latitude, longitude)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="routing unavailable",
        )
    return node


@router.get("/closures")
async def closures(
    limit: int = Query(200, ge=1, le=1000),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Roads currently marked closed in the graph.

    Real rows from `routing_edges.is_closed` — the same flag the router
    honours. The list is legitimately empty until an operator closes a
    road; the UI says "no closures reported" rather than inventing one.
    """
    from sqlalchemy import select

    from app.models import RoutingEdge

    rows = (
        await db.execute(
            select(
                RoutingEdge.id,
                RoutingEdge.name,
                RoutingEdge.from_location_id,
                RoutingEdge.to_location_id,
            )
            .where(RoutingEdge.is_closed.is_(True))
            .limit(limit)
        )
    ).all()

    if not rows:
        return []

    node_ids = {r[2] for r in rows} | {r[3] for r in rows}
    locs = (
        await db.execute(
            select(MapLocation.id, MapLocation.latitude, MapLocation.longitude).where(
                MapLocation.id.in_(node_ids)
            )
        )
    ).all()
    coords = {lid: (lat, lon) for lid, lat, lon in locs}

    return [
        {
            "id": rid,
            "name": name,
            "from_location_id": frm,
            "to_location_id": to_id,
            "from_coords": coords.get(frm),
            "to_coords": coords.get(to_id),
        }
        for rid, name, frm, to_id in rows
        if frm in coords and to_id in coords
    ]
