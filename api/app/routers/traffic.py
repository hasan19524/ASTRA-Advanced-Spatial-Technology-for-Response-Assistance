"""TomTom traffic proxy — Phase 7 (live traffic overlay).

Proxies the TomTom Traffic Flow Segment Data API so the API key stays
server-side (never exposed to the browser bundle). Returns the current
speed / free-flow speed for a point so the map can color-code congestion.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/traffic", tags=["traffic"])


@router.get("/flow")
async def traffic_flow(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    _user=Depends(get_current_user),
) -> JSONResponse:
    """Return current vs free-flow speed for the road segment at (lat, lon).

    Auth required (any valid user). Returns 503 when no TomTom key is
    configured — the UI then hides the traffic layer honestly.
    """
    if not settings.tomtom_api_key:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "TOMTOM_API_KEY not configured", "available": False},
        )
    url = (
        f"{settings.tomtom_base_url.rstrip('/')}/traffic/services/4/"
        f"flowSegmentData/absolute/10/json"
    )
    params = {
        "key": settings.tomtom_api_key,
        "point": f"{lat},{lon}",
        "unit": "KMPH",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.warning("TomTom flow fetch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TomTom traffic service error: {exc}",
        )
    segment = data.get("flowSegmentData", {}) or {}
    current = segment.get("currentSpeed")
    free_flow = segment.get("freeFlowSpeed")
    ratio = (current / free_flow) if (current and free_flow) else None
    return JSONResponse(
        content={
            "available": True,
            "current_speed_kmh": current,
            "free_flow_speed_kmh": free_flow,
            "congestion_ratio": ratio,
            "road_name": segment.get("roadName") or "",
            "confidence": segment.get("confidence"),
        }
    )
