"""Measure the peak memory of the routing-graph build (deployability check).

The free-tier API container has 512 MB of RAM, so the graph build (406k nodes
/ 880k edges) has to fit inside it. This script reports the numbers that
justify the design in `app/services/routing_service.py`.

Run it INSIDE the API container (it reads Linux /proc for RSS):

    docker compose exec -T api python /app/scripts/measure_graph_memory.py

Expected output on the seeded database (2026-11-08):

    baseline peak=56.2 MB rss=56.2 MB
    build_graph ok=True in 4.83s  nodes=406154 edges=879902
    peak=199.9 MB rss=167.0 MB
"""

import asyncio
import resource
import time

from sqlalchemy import select

from app.core.database import get_session_factory
from app.models import RoutingEdge
from app.services import routing_service


def peak_mb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0


def rss_mb() -> float:
    with open("/proc/self/status") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024.0
    return 0.0


async def main() -> None:
    print(f"baseline peak={peak_mb():.1f} MB rss={rss_mb():.1f} MB")
    t0 = time.perf_counter()
    async with get_session_factory()() as db:
        ok = await routing_service.build_graph(db)
        elapsed = time.perf_counter() - t0
        cache = routing_service._GRAPH_CACHE
        print(
            f"build_graph ok={ok} in {elapsed:.2f}s  "
            f"nodes={len(cache['ids'])} edges={len(cache['to'])}"
        )
        print(f"peak={peak_mb():.1f} MB rss={rss_mb():.1f} MB")

        edge = (
            await db.execute(
                select(RoutingEdge.from_location_id, RoutingEdge.to_location_id)
                .where(RoutingEdge.is_closed.is_(False))
                .limit(1)
            )
        ).first()
        fwd = await routing_service.shortest_path(db, edge[0], edge[1])
        rev = await routing_service.shortest_path(db, edge[1], edge[0])
        print(
            f"forward: {fwd.get('distance_seconds')} s "
            f"({len(fwd.get('path', []))} nodes) {fwd.get('error', '')}"
        )
        print(
            f"reverse: {rev.get('distance_seconds')} s "
            f"({len(rev.get('path', []))} nodes) {rev.get('error', '')}"
        )
        print(f"peak={peak_mb():.1f} MB rss={rss_mb():.1f} MB")


asyncio.run(main())
