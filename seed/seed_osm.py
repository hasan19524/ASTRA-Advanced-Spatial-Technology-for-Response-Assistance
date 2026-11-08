"""Seed the real Delhi-NCR road graph from OpenStreetMap.

Input: `_delhi_roads.json` in the repo root (47 MB, gitignored) — the raw
Overpass API response produced by `seed/fetch_osm_roads.py`:

    {"elements": [{"type": "node", "id": ..., "lat": ..., "lon": ...},
                   {"type": "way",  "id": ..., "nodes": [...], "tags": {...}}]}

What it writes:

  * `map_locations`  — one row per OSM node (the seeded bbox is central
    Delhi NCR: lat 28.533759–28.7884243, lon 77.0007004–77.3194465).
  * `routing_edges` — one row per traversable direction between consecutive
    nodes of a way.

Direction matters: OSM ways are two-way unless they are tagged `oneway`.
The first version of this script only inserted the forward direction, which
made the router fail on half the street pairs (a route from the incident back
to the depot simply did not exist). Now each way produces both directions,
except:

    oneway=yes / true / 1  → forward direction only
    oneway=-1               → backward direction only (traffic runs against
                              the node order of the way)

`junction=roundabout` is one-way in OSM by definition and is treated as such.

Run from the repo root:

    python seed/seed_osm.py
"""

import asyncio
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5433/astra"
)
from app.core.database import get_session_factory  # noqa: E402
from app.models import MapLocation, RoutingEdge  # noqa: E402

BATCH = 20_000
# 13.89 m/s = 50 km/h — the default urban speed used for the travel time.
SPEED_MPS = 13.89

ONEWAY_FORWARD = {"yes", "true", "1"}
ONEWAY_BACKWARD = {"-1", "reverse"}


async def main():
    path = os.path.join(os.path.dirname(__file__), "..", "_delhi_roads.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    nodes = {e["id"]: e for e in data["elements"] if e["type"] == "node"}
    ways = [e for e in data["elements"] if e["type"] == "way"]

    factory = get_session_factory()
    async with factory() as db:
        # clear existing
        from sqlalchemy import delete

        await db.execute(delete(RoutingEdge))
        await db.execute(delete(MapLocation))
        await db.commit()

        # insert nodes
        batch = []
        for nid, n in nodes.items():
            batch.append(
                MapLocation(
                    id=str(nid),
                    osm_id=str(nid),
                    latitude=n["lat"],
                    longitude=n["lon"],
                    kind="junction",
                    name=None,
                )
            )
            if len(batch) >= BATCH:
                db.add_all(batch)
                await db.flush()
                batch = []
        if batch:
            db.add_all(batch)
            await db.flush()
        await db.commit()
        print(f"inserted {len(nodes)} nodes")

        # insert edges — both directions, unless OSM marks the way one-way
        edge_batch = []
        count = 0
        oneway_ways = 0

        def add_edge(a: int, b: int, name: str | None, distance: float) -> None:
            nonlocal count
            edge_batch.append(
                RoutingEdge(
                    from_location_id=str(a),
                    to_location_id=str(b),
                    name=name,
                    distance_m=distance,
                    travel_time_s=distance / SPEED_MPS,
                    is_closed=False,
                    traffic_factor=1.0,
                )
            )
            count += 1

        for w in ways:
            nds = w.get("nodes", [])
            tags = w.get("tags", {})
            name = tags.get("name")
            oneway = (tags.get("oneway") or "").strip().lower()
            if (tags.get("junction") or "").lower() == "roundabout":
                oneway = "yes"
            forward_only = oneway in ONEWAY_FORWARD
            backward_only = oneway in ONEWAY_BACKWARD
            if forward_only or backward_only:
                oneway_ways += 1

            for i in range(len(nds) - 1):
                a, b = nds[i], nds[i + 1]
                if a not in nodes or b not in nodes:
                    continue
                la, lo = nodes[a]["lat"], nodes[a]["lon"]
                lb, lo2 = nodes[b]["lat"], nodes[b]["lon"]
                d = math.hypot(
                    (la - lb) * 111000, (lo - lo2) * 111000 * math.cos(math.radians(la))
                )
                if not backward_only:
                    add_edge(a, b, name, d)
                if not forward_only:
                    add_edge(b, a, name, d)
                if len(edge_batch) >= BATCH:
                    db.add_all(edge_batch)
                    await db.flush()
                    edge_batch = []
        if edge_batch:
            db.add_all(edge_batch)
            await db.flush()
        await db.commit()
        print(f"inserted {count} edges ({oneway_ways} one-way ways)")


asyncio.run(main())
