"""Simulation service — Phase 3 (PL-14: simple documented heuristics).

Every figure the simulation screen shows comes from this module. The screen
used to render hard-coded cards ("12.5 km²", "45,000+ people", "₹320 Cr")
regardless of the inputs — it looked alive and said nothing true. Now the
inputs (scenario, category, radius, intensity) decide the output, and the
summary states plainly that it is a heuristic, not a forecast.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SimRun, User

# Per-category damage/cost factors (heuristic, documented). Clearly labelled an estimate.
CATEGORY_FACTORS = {
    "Fire": (0.8, 50000),
    "Flood/Waterlogging": (0.6, 30000),
    "Structural collapse": (0.9, 80000),
    "Accident": (0.4, 20000),
    "Medical emergency": (0.3, 15000),
    "Crime/Safety": (0.2, 10000),
    "Utility outage": (0.3, 25000),
    "Hazard/Other": (0.5, 40000),
}

NCR_POPULATION = 30_000_000
# Delhi NCR spans roughly 50 km across; the area term below is scaled to it.
NCR_RADIUS_KM = 50.0
# Average people per square kilometre inside the footprint, used to turn the
# affected area into an affected-population estimate.
DENSITY_PER_KM2 = 5_500
# One key-infrastructure asset per N square kilometres (hospital, bridge,
# substation, shelter…).
INFRA_PER_KM2 = 0.45


async def run_simulation(
    db: AsyncSession, user: User, mode: str, scenario: str, params: dict
) -> SimRun:
    run = SimRun(
        mode=mode,
        scenario=scenario,
        params=json.dumps(params),
        status="RUNNING",
        created_by=user.id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.flush()

    category = params.get("category", "Hazard/Other")
    affected_radius_km = float(params.get("radius_km", 5.0))
    # intensity 0..100 scales the radius: a weak event touches a smaller area.
    intensity = max(0.0, min(100.0, float(params.get("intensity", 60))))
    effective_radius_km = affected_radius_km * (0.4 + 0.6 * intensity / 100.0)

    affected_area_km2 = math.pi * effective_radius_km**2
    # affected population = density × area, capped by the NCR population.
    affected_pop = int(min(NCR_POPULATION, affected_area_km2 * DENSITY_PER_KM2))
    infra_count = max(0, int(affected_area_km2 * INFRA_PER_KM2))

    dmg_factor, cost_per = CATEGORY_FACTORS.get(category, (0.5, 40000))
    estimated_damage = int(affected_pop * cost_per * dmg_factor)

    summary = {
        "scenario": scenario,
        "category": category,
        "radius_km": round(effective_radius_km, 2),
        "intensity": round(intensity),
        "affected_area_km2": round(affected_area_km2, 2),
        "affected_population_estimate": affected_pop,
        "key_infrastructure_estimate": infra_count,
        "damage_estimate_inr": estimated_damage,
        "cost_per_affected_person_inr": cost_per,
        "damage_factor": dmg_factor,
        "note": "Heuristic estimate (PL-14). Not a real forecast.",
    }
    run.summary = summary
    run.status = "DONE"
    run.finished_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return run


async def get_run(db: AsyncSession, run_id: str) -> SimRun | None:
    return await db.get(SimRun, run_id)


async def list_runs(db: AsyncSession, user: User, limit: int = 20) -> list[SimRun]:
    from sqlalchemy import select

    stmt = select(SimRun).order_by(SimRun.created_at.desc()).limit(limit)
    if user.role not in ("CENTRAL_ADMIN",):
        stmt = stmt.where(SimRun.mode == "PUBLIC")
    rows = (await db.scalars(stmt)).all()
    return list(rows)
