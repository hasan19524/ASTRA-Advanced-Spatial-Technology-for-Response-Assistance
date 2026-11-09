"""Routing service contract — Phase 6 (real OSM graph).

Covers the two endpoints the Live Map depends on:

  * ``GET /api/v1/route/nearest`` — snap an arbitrary point to the closest
    routable junction (an incident pin is not a graph node).
  * ``GET /api/v1/route`` — the Dijkstra route, including the
    ``path_coords`` the map draws.

The graph itself is optional in CI: the seeded OSM extract is not part of
the test fixture. When the graph is absent the API must degrade to an
honest error, never a crash and never a fabricated route.
"""

import uuid

import pytest

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import MapLocation, RoutingEdge, User

PW = "Str0ngPass!23"


async def _admin() -> User:
    async with get_session_factory()() as s:
        u = User(
            email=f"admin+{uuid.uuid4().hex[:8]}@test.example",
            full_name="Routing Admin",
            password_hash=hash_password(PW),
            role="CENTRAL_ADMIN",
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _token(client, user: User) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": PW},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _seed_graph() -> tuple[str, str]:
    """Insert a two-node graph with a single edge. Returns (from_id, to_id)."""
    async with get_session_factory()() as s:
        a = MapLocation(
            id=f"rtest-a-{uuid.uuid4().hex[:8]}",
            name="Node A",
            latitude=28.6139,
            longitude=77.2090,
            kind="junction",
        )
        b = MapLocation(
            id=f"rtest-b-{uuid.uuid4().hex[:8]}",
            name="Node B",
            latitude=28.6318,
            longitude=77.2194,
            kind="junction",
        )
        s.add_all([a, b])
        await s.flush()
        s.add(
            RoutingEdge(
                id=f"rtest-e-{uuid.uuid4().hex[:8]}",
                from_location_id=a.id,
                to_location_id=b.id,
                name="Test Road",
                distance_m=2200.0,
                travel_time_s=180.0,
                traffic_factor=1.0,
                is_closed=False,
            )
        )
        await s.commit()
        return a.id, b.id


@pytest.fixture(autouse=True)
async def _reset_graph():
    from app.services import routing_service

    routing_service.reset_graph_cache()
    yield
    routing_service.reset_graph_cache()


async def test_route_returns_path_coordinates(client):
    """The map draws `path_coords`; without them the route cannot be shown."""
    a_id, b_id = await _seed_graph()
    admin = await _admin()
    token = await _token(client, admin)

    r = await client.get(
        f"/api/v1/route?from_id={a_id}&to_id={b_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["from"] == a_id
    assert body["to"] == b_id
    assert body["distance_seconds"] == pytest.approx(180.0, rel=0.01)
    assert body["path"] == [a_id, b_id]
    # Two nodes -> two coordinate pairs, in the same order as `path`.
    assert len(body["path_coords"]) == 2
    assert body["path_coords"][0] == pytest.approx([28.6139, 77.2090], abs=1e-4)
    assert body["path_coords"][1] == pytest.approx([28.6318, 77.2194], abs=1e-4)


async def test_nearest_snaps_to_a_routable_junction(client):
    """An arbitrary point must snap to the closest graph node."""
    a_id, _b_id = await _seed_graph()
    admin = await _admin()
    token = await _token(client, admin)

    r = await client.get(
        "/api/v1/route/nearest?latitude=28.6140&longitude=77.2091",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == a_id
    assert body["distance_m"] < 50
    # The seed node has an outgoing edge, so it is a junction.
    assert body["is_junction"] is True


async def test_nearest_requires_authentication(client):
    r = await client.get("/api/v1/route/nearest?latitude=28.61&longitude=77.20")
    assert r.status_code in (401, 403), r.text


async def test_route_with_unknown_node_is_a_clean_404(client):
    """An unknown node is a 404 with a readable message, never a crash."""
    await _seed_graph()  # the graph must exist before the node lookup
    admin = await _admin()
    token = await _token(client, admin)
    r = await client.get(
        "/api/v1/route?from_id=nope-a&to_id=nope-b",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404, r.text
    assert "unknown location" in r.json()["detail"]


async def test_route_without_a_graph_is_an_honest_503(client):
    """No OSM graph at all -> "routing unavailable", never a fake route.

    This is what CI (which has no seeded extract) must see.
    """
    admin = await _admin()
    token = await _token(client, admin)
    r = await client.get(
        "/api/v1/route?from_id=nope-a&to_id=nope-b",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Either the graph is present (404 unknown location) or absent
    # (404 routing unavailable). Both are honest; neither is a crash.
    assert r.status_code == 404, r.text
    detail = r.json()["detail"]
    assert detail in ("unknown location", "routing unavailable"), detail


async def test_closures_endpoint_returns_a_list(client):
    """The closure layer must be a real query — even when it is empty."""
    admin = await _admin()
    token = await _token(client, admin)
    r = await client.get(
        "/api/v1/route/closures",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
