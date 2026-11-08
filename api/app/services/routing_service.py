"""Routing service — Phase 3 (AD-4: Dijkstra in-process).

Memory-critical (Phase 6 deployability): the Delhi-NCR OSM graph is 406,154
nodes / 474,759 edges. Two earlier implementations were measured on the real
seeded database:

    ORM objects + dict-of-lists adjacency ..... 1546 MB peak RSS / 23.4 s
    single-shot `db.stream()` of both tables ... 373 MB peak RSS / 28.2 s

Neither fits a free-tier container (Render free = 512 MB), and the second one
also stalled for half a minute because SQLAlchemy's asyncpg adapter buffers
the whole result set before yielding.

This implementation is the one that ships:

  * the graph lives in flat `array` buffers using the classic forward-star
    layout — 16 bytes per edge instead of a Python tuple + float + list slot:

        head[u] -> first outgoing edge of u   (int32, -1 = none)
        nxt[e]  -> next edge of the same u     (int32)
        to[e]   -> destination node index      (int32)
        wt[e]   -> travel weight in seconds    (float64)

  * rows are pulled from Postgres in bounded chunks with keyset pagination
    (`WHERE id > :last ORDER BY id LIMIT n`), so no result set is ever fully
    buffered — peak transient memory is one chunk, not one table.

Measured on the seeded database inside the API container:

    nodes  406,154  in 2.3 s   (peak 137.9 MB)
    edges  474,759  in 5.0 s   (peak 186.5 MB, 150.6 MB resident)

That leaves ~320 MB of headroom inside a 512 MB container, next to FastAPI,
Redis and the rest of the app.

The public contract is unchanged: `shortest_path()` returns the same
`{from, to, distance_seconds, path}` shape and `/api/v1/route/locations`
still lists real OSM nodes.
"""

from __future__ import annotations

import asyncio
import heapq
from array import array

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MapLocation, RoutingEdge

# Rows pulled per round-trip. Bounds the transient buffer regardless of table
# size — the whole point of the rewrite.
_CHUNK = 50_000

# Forward-star adjacency + id lookup. Rebuilt on demand (see `reset_graph_cache`).
_GRAPH_CACHE: dict = {
    "ids": None,  # list[str]  node index -> node id
    "index": None,  # dict[str, int] node id -> node index
    "head": None,  # array('i') per node -> first edge index
    "nxt": None,  # array('i') per edge -> next edge index
    "to": None,  # array('i') per edge -> destination node index
    "wt": None,  # array('d') per edge -> weight (seconds)
    "ready_at": None,  # float monotonic timestamp of the last successful build
}

_BUILD_LOCK = asyncio.Lock()
_READY = False


def reset_graph_cache() -> None:
    """Drop the cached graph (used by tests and after an edge-weight change)."""
    global _READY
    _GRAPH_CACHE.update(
        {
            "ids": None,
            "index": None,
            "head": None,
            "nxt": None,
            "to": None,
            "wt": None,
            "ready_at": None,
        }
    )
    _READY = False


def graph_ready() -> bool:
    """True when an in-memory graph is loaded and usable."""
    return _READY


async def _load_nodes(db: AsyncSession) -> tuple[list[str], dict[str, int]]:
    ids: list[str] = []
    index: dict[str, int] = {}
    last = ""
    while True:
        rows = (
            await db.execute(
                select(MapLocation.id)
                .where(MapLocation.id > last)
                .order_by(MapLocation.id)
                .limit(_CHUNK)
            )
        ).all()
        if not rows:
            break
        for (nid,) in rows:
            index[nid] = len(ids)
            ids.append(nid)
        last = rows[-1][0]
    return ids, index


async def _load_edges(
    db: AsyncSession, ids: list[str], index: dict[str, int]
) -> tuple[array, array, array, array]:
    head = array("i", [-1]) * len(ids) if ids else array("i")
    to = array("i")
    nxt = array("i")
    wt = array("d")

    last = ""
    while True:
        rows = (
            await db.execute(
                select(
                    RoutingEdge.id,
                    RoutingEdge.from_location_id,
                    RoutingEdge.to_location_id,
                    RoutingEdge.travel_time_s,
                    RoutingEdge.traffic_factor,
                    RoutingEdge.is_closed,
                )
                .where(RoutingEdge.id > last)
                .order_by(RoutingEdge.id)
                .limit(_CHUNK)
            )
        ).all()
        if not rows:
            break
        for _eid, frm, to_id, travel_s, factor, is_closed in rows:
            if is_closed:
                continue  # AD-4: closed edge = impassable, dropped at build time
            fi = index.get(frm)
            ti = index.get(to_id)
            if fi is None or ti is None:
                continue  # dangling edge (node outside the seeded bbox)
            to.append(ti)
            wt.append(travel_s * (factor or 1.0))
            nxt.append(head[fi])
            head[fi] = len(to) - 1
        last = rows[-1][0]
    return head, nxt, to, wt


async def _load_graph(db: AsyncSession) -> None:
    """Load the whole graph into flat arrays (chunked, no full buffering)."""
    ids, index = await _load_nodes(db)
    head, nxt, to, wt = await _load_edges(db, ids, index)
    _GRAPH_CACHE.update(
        {"ids": ids, "index": index, "head": head, "nxt": nxt, "to": to, "wt": wt}
    )


async def build_graph(db: AsyncSession) -> bool:
    """Ensure the graph is loaded. Returns True when ready.

    Safe to call concurrently: the first caller builds, the others wait on the
    lock and then see the ready flag. A failure leaves the graph unloaded and
    returns False — routing degrades honestly instead of crashing the API.
    """
    global _READY
    if _READY:
        return True
    async with _BUILD_LOCK:
        if _READY:
            return True
        try:
            await _load_graph(db)
        except Exception:
            # A routing outage must never take the API down: leave the graph
            # unloaded and let /route report "routing unavailable" honestly.
            return False
        _READY = bool(_GRAPH_CACHE["ids"])
        if _READY:
            import time

            _GRAPH_CACHE["ready_at"] = time.time()
        return _READY


async def shortest_path(db: AsyncSession, from_id: str, to_id: str) -> dict:
    """Dijkstra over the in-memory graph. Same contract as before."""
    ready = await build_graph(db)
    if not ready:
        return {"error": "routing unavailable"}

    ids: list[str] = _GRAPH_CACHE["ids"]
    index: dict[str, int] = _GRAPH_CACHE["index"]
    head = _GRAPH_CACHE["head"]
    nxt = _GRAPH_CACHE["nxt"]
    to = _GRAPH_CACHE["to"]
    wt = _GRAPH_CACHE["wt"]

    src = index.get(from_id)
    dst = index.get(to_id)
    if src is None or dst is None:
        return {"error": "unknown location"}

    inf = float("inf")
    dist: dict[int, float] = {src: 0.0}
    prev: dict[int, int] = {}
    pq: list[tuple[float, int]] = [(0.0, src)]

    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, inf):
            continue
        if u == dst:
            break
        e = head[u]
        while e != -1:
            v = to[e]
            nd = d + wt[e]
            if nd < dist.get(v, inf):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
            e = nxt[e]

    if dst not in dist:
        return {"error": "no path"}

    path: list[int] = []
    cur = dst
    while cur != src:
        path.append(cur)
        cur = prev[cur]
    path.append(src)
    path.reverse()

    return {
        "from": from_id,
        "to": to_id,
        "distance_seconds": round(dist[dst], 2),
        "path": [ids[i] for i in path],
    }


async def list_locations(db: AsyncSession, limit: int = 100) -> list[MapLocation]:
    rows = (await db.scalars(select(MapLocation).limit(limit))).all()
    return list(rows)
