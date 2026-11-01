"""Routing service — Phase 3 (AD-4: Dijkstra in-process)."""

from __future__ import annotations

import heapq

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MapLocation, RoutingEdge


async def build_graph(db: AsyncSession):
    nodes = (await db.scalars(select(MapLocation))).all()
    edges = (await db.scalars(select(RoutingEdge))).all()
    adj: dict[str, list[tuple[str, float]]] = {n.id: [] for n in nodes}
    for e in edges:
        if e.is_closed:
            continue
        w = e.travel_time_s * (e.traffic_factor or 1.0)
        adj.setdefault(e.from_location_id, []).append((e.to_location_id, w))
        # undirected? treat as directed per OSM; add reverse if needed
    return nodes, adj


async def shortest_path(db: AsyncSession, from_id: str, to_id: str) -> dict:
    nodes, adj = await build_graph(db)
    if from_id not in adj or to_id not in adj:
        return {"error": "unknown location"}
    # Dijkstra
    dist = {from_id: 0.0}
    prev = {}
    pq = [(0.0, from_id)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, float("inf")):
            continue
        if u == to_id:
            break
        for v, w in adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if to_id not in dist:
        return {"error": "no path"}
    # reconstruct
    path = []
    cur = to_id
    while cur != from_id:
        path.append(cur)
        cur = prev[cur]
    path.append(from_id)
    path.reverse()
    return {
        "from": from_id,
        "to": to_id,
        "distance_seconds": round(dist[to_id], 2),
        "path": path,
    }


async def list_locations(db: AsyncSession, limit: int = 100) -> list[MapLocation]:
    rows = (await db.scalars(select(MapLocation).limit(limit))).all()
    return list(rows)
