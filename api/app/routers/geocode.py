"""Geocoding router — Nominatim (free, no API key)."""

import httpx
from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit_auth
from app.models import User

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("/search")
async def search(
    q: str = Query(..., min_length=2),
    user: User = Depends(get_current_user),
    _rl=Depends(rate_limit_auth),
):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": q,
        "format": "json",
        "limit": 5,
        "countrycodes": "in",
        "viewbox": "76.8,28.4,77.6,28.9",
        "bounded": 1,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params, headers={"User-Agent": "ASTRA/1.0"})
        resp.raise_for_status()
        results = resp.json()
    return [
        {
            "display_name": r.get("display_name"),
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
        }
        for r in results
    ]
