"""Simulation service — Phase 3 (PL-14: simple documented heuristics)."""

from __future__ import annotations

import json
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
    # affected population = fraction of NCR population by area (rough)
    affected_pop = int(NCR_POPULATION * (affected_radius_km / 50.0) ** 2 * 0.05)
    dmg_factor, cost_per = CATEGORY_FACTORS.get(category, (0.5, 40000))
    estimated_damage = int(affected_pop * cost_per * dmg_factor)
    summary = {
        "scenario": scenario,
        "category": category,
        "affected_population_estimate": affected_pop,
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
