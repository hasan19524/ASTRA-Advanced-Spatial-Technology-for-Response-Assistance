"""Seed a small routing graph around Connaught Place (Phase 3)."""

import os, sys, math, random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5433/astra"
)
import asyncio
from app.core.database import get_session_factory
from app.models import MapLocation, RoutingEdge

random.seed(42)
CENTER_LAT, CENTER_LON = 28.6315, 77.2167  # Connaught Place
GRID = 20  # 20x20 grid ~ 2km x 2km
STEP = 0.001  # ~111m per step


async def main():
    factory = get_session_factory()
    async with factory() as db:
        # check existing
        from sqlalchemy import select, func

        n = await db.scalar(select(func.count()).select_from(MapLocation))
        if n and n > 0:
            print(f"map_locations already seeded ({n}) — skipping")
            return
        # create nodes
        nodes = {}
        for i in range(GRID):
            for j in range(GRID):
                lat = CENTER_LAT + (i - GRID // 2) * STEP
                lon = CENTER_LON + (j - GRID // 2) * STEP
                loc = MapLocation(
                    latitude=lat, longitude=lon, name=f"J{i}-{j}", kind="junction"
                )
                db.add(loc)
                await db.flush()
                nodes[(i, j)] = loc.id

        # create edges (4-neighbor)
        def dist(lat1, lon1, lat2, lon2):
            return math.hypot(
                (lat1 - lat2) * 111000,
                (lon1 - lon2) * 111000 * math.cos(math.radians(lat1)),
            )

        for i in range(GRID):
            for j in range(GRID):
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ni, nj = i + di, j + dj
                    if 0 <= ni < GRID and 0 <= nj < GRID:
                        d = dist(
                            CENTER_LAT + (i - GRID // 2) * STEP,
                            CENTER_LON + (j - GRID // 2) * STEP,
                            CENTER_LAT + (ni - GRID // 2) * STEP,
                            CENTER_LON + (nj - GRID // 2) * STEP,
                        )
                        edge = RoutingEdge(
                            from_location_id=nodes[(i, j)],
                            to_location_id=nodes[(ni, nj)],
                            name=f"road-{i}-{j}-{di}-{dj}",
                            distance_m=d,
                            travel_time_s=d / 13.89,  # ~50 km/h
                            is_closed=False,
                            traffic_factor=1.0,
                        )
                        db.add(edge)
        await db.commit()
        print(f"seeded {GRID * GRID} nodes + edges")


asyncio.run(main())
