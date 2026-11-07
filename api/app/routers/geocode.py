"""Geocoding router — Nominatim (free, no API key)."""

from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("/search")
async def search(q: str = Query(..., min_length=2)):
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
