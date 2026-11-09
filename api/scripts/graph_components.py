"""Measure the connected components of the seeded OSM routing graph.

Run inside the API container (it needs DATABASE_URL)::

    docker compose exec -T api python scripts/graph_components.py

Prints the size of every component and the node count that is NOT in the
largest one. A large "orphan" count means the seeded extract is fragmented
and the router will answer "no path" for perfectly ordinary Delhi trips.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models import MapLocation, RoutingEdge  # noqa: E402


class DSU:
    def __init__(self, n: int) -> None:
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        p = self.parent
        while p[x] != x:
            p[x] = p[p[x]]
            x = p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


async def main() -> None:
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(settings.database_url)
    async with AsyncSession(engine) as db:
        ids: list[str] = []
        index: dict[str, int] = {}
        last = ""
        while True:
            rows = (
                await db.execute(
                    select(MapLocation.id)
                    .where(MapLocation.id > last)
                    .order_by(MapLocation.id)
                    .limit(50_000)
                )
            ).all()
            if not rows:
                break
            for (nid,) in rows:
                index[nid] = len(ids)
                ids.append(nid)
            last = rows[-1][0]
        print(f"nodes: {len(ids)}", flush=True)

        dsu = DSU(len(ids))
        last = ""
        edges = 0
        while True:
            rows = (
                await db.execute(
                    select(
                        RoutingEdge.id,
                        RoutingEdge.from_location_id,
                        RoutingEdge.to_location_id,
                        RoutingEdge.is_closed,
                    )
                    .where(RoutingEdge.id > last)
                    .order_by(RoutingEdge.id)
                    .limit(50_000)
                )
            ).all()
            if not rows:
                break
            for _eid, frm, to_id, is_closed in rows:
                if is_closed:
                    continue
                fi = index.get(frm)
                ti = index.get(to_id)
                if fi is None or ti is None:
                    continue
                dsu.union(fi, ti)
                edges += 1
            last = rows[-1][0]
        print(f"edges (open): {edges}", flush=True)

        sizes: dict[int, int] = {}
        for i in range(len(ids)):
            root = dsu.find(i)
            sizes[root] = sizes.get(root, 0) + 1

        ordered = sorted(sizes.values(), reverse=True)
        total = len(ids)
        print(f"components: {len(ordered)}", flush=True)
        print(
            f"largest component: {ordered[0]} nodes ({ordered[0] * 100 / total:.1f}%)"
        )
        print(f"nodes outside the largest: {total - ordered[0]}")
        print("top 10 component sizes:", ordered[:10])
        if len(ordered) > 1:
            singletons = sum(1 for s in ordered if s == 1)
            print(f"singleton components: {singletons}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
