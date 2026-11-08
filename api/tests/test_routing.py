"""Routing (AD-4) — the in-memory graph build and Dijkstra over it.

Phase 6 deployability: the production graph is 406k nodes / 475k edges, which
is why `routing_service` loads it in bounded chunks into flat arrays. These
tests cover the same code path on a mini graph: node indexing, closed-edge
handling, shortest-path selection and the honest error contract.
"""

import pytest

from app.core.database import get_session_factory
from app.models import MapLocation, RoutingEdge
from app.services import routing_service


@pytest.fixture(autouse=True)
def _fresh_graph_cache():
    routing_service.reset_graph_cache()
    yield
    routing_service.reset_graph_cache()


async def _seed_graph(closed: bool = False) -> None:
    """A miniature of the real OSM graph: two-way streets plus one one-way
    shortcut that can be closed (AD-4: `is_closed` = impassable)."""
    async with get_session_factory()() as db:
        for i in range(3):
            db.add(
                MapLocation(
                    id=f"node-{i}",
                    name=f"junction {i}",
                    latitude=28.60 + i * 0.01,
                    longitude=77.20,
                    kind="junction",
                )
            )

        def edge(eid: str, a: str, b: str, seconds: float, meters: float) -> None:
            db.add(
                RoutingEdge(
                    id=eid,
                    from_location_id=a,
                    to_location_id=b,
                    distance_m=meters,
                    travel_time_s=seconds,
                )
            )

        # 0 <-> 1 and 1 <-> 2, 10 s each way (two-way streets)
        edge("e-01", "node-0", "node-1", 10.0, 100.0)
        edge("e-10", "node-1", "node-0", 10.0, 100.0)
        edge("e-12", "node-1", "node-2", 10.0, 100.0)
        edge("e-21", "node-2", "node-1", 10.0, 100.0)
        # a slow direct road 0 -> 2
        edge("e-02", "node-0", "node-2", 100.0, 5000.0)
        if closed:
            # a fast one-way shortcut 2 -> 0 that is closed
            db.add(
                RoutingEdge(
                    id="e-closed",
                    from_location_id="node-2",
                    to_location_id="node-0",
                    distance_m=5000.0,
                    travel_time_s=1.0,
                    is_closed=True,
                )
            )
        await db.commit()


async def test_shortest_path_prefers_the_fastest_route():
    await _seed_graph()
    async with get_session_factory()() as db:
        result = await routing_service.shortest_path(db, "node-0", "node-2")
    assert result["distance_seconds"] == 20.0
    assert result["path"] == ["node-0", "node-1", "node-2"]
    assert result["from"] == "node-0" and result["to"] == "node-2"


async def test_closed_edge_is_not_traversed():
    """AD-4: `is_closed` = impassable, dropped when the graph is built."""
    await _seed_graph(closed=True)
    async with get_session_factory()() as db:
        result = await routing_service.shortest_path(db, "node-2", "node-0")
    # The direct node-2 -> node-0 edge is closed, so the route goes back
    # through node-1 (20 s) instead of the 1 s shortcut.
    assert result["distance_seconds"] == 20.0
    assert result["path"] == ["node-2", "node-1", "node-0"]


async def test_unknown_location_is_reported_not_guessed():
    await _seed_graph()
    async with get_session_factory()() as db:
        result = await routing_service.shortest_path(db, "node-0", "does-not-exist")
    assert result == {"error": "unknown location"}


async def test_graph_build_reports_readiness():
    await _seed_graph()
    async with get_session_factory()() as db:
        assert await routing_service.build_graph(db) is True
    assert routing_service.graph_ready() is True


async def test_route_endpoint_returns_a_real_path(client):
    """The HTTP contract: GET /api/v1/route?from_id=…&to_id=…"""
    from tests.test_incidents import _auth, _register

    await _seed_graph()
    tokens = await _register(client, "citizen")
    r = await client.get(
        "/api/v1/route?from_id=node-0&to_id=node-2", headers=_auth(tokens)
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["path"] == ["node-0", "node-1", "node-2"]
    assert body["distance_seconds"] == 20.0
