"""Weather service — Phase 6 (real-time IMD/OpenWeather integration)."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.core.config import settings


async def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from OpenWeatherMap. Returns parsed dict."""
    if not settings.weather_api_key:
        return {"error": "WEATHER_API_KEY not set"}
    url = f"{settings.weather_base_url.rstrip('/')}/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.weather_api_key,
        "units": "metric",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    return {
        "location": data.get("name"),
        "lat": lat,
        "lon": lon,
        "temp_c": data.get("main", {}).get("temp"),
        "humidity": data.get("main", {}).get("humidity"),
        "condition": data.get("weather", [{}])[0].get("main"),
        "description": data.get("weather", [{}])[0].get("description"),
        "wind_speed": data.get("wind", {}).get("speed"),
        "rain_1h": data.get("rain", {}).get("1h", 0),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# Delhi NCR grid points for weather monitoring
DELHI_POINTS = [
    (28.6139, 77.2090, "New Delhi"),
    (28.7041, 77.1025, "North Delhi"),
    (28.5355, 77.3910, "East Delhi"),
    (28.6500, 77.1500, "West Delhi"),
    (28.4595, 77.0266, "Gurugram"),
    (28.5355, 77.3910, "Noida"),
]


async def fetch_all_delhi() -> list[dict]:
    results = []
    for lat, lon, name in DELHI_POINTS:
        try:
            w = await fetch_weather(lat, lon)
            w["label"] = name
            results.append(w)
        except Exception as e:
            results.append({"label": name, "error": str(e)})
    return results


def is_severe(w: dict) -> bool:
    """Heuristic: rain > 50mm/h or temp > 45 or wind > 20 m/s."""
    rain = w.get("rain_1h", 0) or 0
    temp = w.get("temp_c", 0) or 0
    wind = w.get("wind_speed", 0) or 0
    return (
        rain > 50
        or temp > 45
        or wind > 20
        or w.get("condition") in ("Thunderstorm", "Tornado")
    )


async def weather_ingestion_tick(db):
    """Called periodically: fetch weather, auto-create incidents for severe conditions."""
    from app.models import Incident, User
    from app.services import incident_state
    from sqlalchemy import select

    # find an admin user to attribute
    admin = await db.scalar(select(User).where(User.role == "CENTRAL_ADMIN").limit(1))
    if admin is None:
        return
    for lat, lon, name in DELHI_POINTS:
        try:
            w = await fetch_weather(lat, lon)
        except Exception:
            continue
        if not is_severe(w):
            continue
        # check if recent incident already exists for this region
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        existing = await db.scalar(
            select(Incident).where(
                Incident.region == name,
                Incident.category.in_(("Flood/Waterlogging", "Hazard/Other")),
                Incident.created_at >= cutoff,
            )
        )
        if existing:
            continue
        # create incident
        from app.services.assessment_backend import get_assessment_backend

        backend = get_assessment_backend()
        result = await backend.assess(
            title=f"Severe weather: {w.get('condition')} in {name}",
            description=f"Auto-detected: {w.get('description')}, temp {w.get('temp_c')}C, rain {w.get('rain_1h')}mm/h",
            region=name,
            reporter_email=admin.email,
        )
        inc = Incident(
            title=f"Severe weather: {w.get('condition')} in {name}",
            description=f"Auto-detected from weather feed: {w.get('description')}",
            category="Flood/Waterlogging"
            if "rain" in (w.get("description") or "").lower()
            else "Hazard/Other",
            region=name,
            latitude=lat,
            longitude=lon,
            reported_by=admin.id,
        )
        db.add(inc)
        await db.flush()
        db.add(
            incident_state.apply_assessment(
                inc,
                result.outcome,
                backend=result.backend,
                reason=result.reason,
                confidence=result.confidence,
                model=result.model,
            )
        )
        await db.commit()
        await db.refresh(inc)
        try:
            from app.services.map_ws import publish_incident_created

            await publish_incident_created(inc)
        except Exception:
            pass
