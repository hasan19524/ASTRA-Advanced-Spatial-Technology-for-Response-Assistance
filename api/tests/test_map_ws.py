"""Day 3 task 5 — `/ws/map` live channel: AD-10 handshake auth (close 4401),
the `connected` envelope, and `incident.created` fan-out over Redis pub/sub
on topic `incidents:map`.

The sync TestClient runs the app on its own event loop while Redis carries
publish→subscribe — the same cross-loop topology production has.

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import json
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app

PW = "Str0ngPass!23"


@pytest.fixture()
def tc():
    # ONE portal for the whole test: every request + the websocket share a
    # single event loop, so the lru_cached asyncpg pool stays valid. A bare
    # TestClient recycles the portal per request and the pool then points at
    # closed loops ("Event loop is closed" on the 2nd request).
    with TestClient(app) as client:
        yield client


def _register(tc: TestClient, tag: str = "ws") -> dict:
    email = f"{tag}+{uuid.uuid4().hex[:8]}@test.example"
    r = tc.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "WS Tester", "password": PW},
    )
    assert r.status_code == 201, r.text
    r = tc.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()


async def test_ws_closes_4401_without_valid_token(tc):
    # garbage token
    with pytest.raises(WebSocketDisconnect) as exc:
        with tc.websocket_connect("/ws/map?token=not-a-jwt"):
            pass
    assert exc.value.code == 4401

    # no token at all
    with pytest.raises(WebSocketDisconnect) as exc:
        with tc.websocket_connect("/ws/map"):
            pass
    assert exc.value.code == 4401


async def test_ws_connected_then_incident_created_fanout(tc):
    tokens = _register(tc)

    with tc.websocket_connect(f"/ws/map?token={tokens['access_token']}") as ws:
        first = json.loads(ws.receive_text())
        assert first == {"channel": "incidents:map", "type": "connected"}

        r = tc.post(
            "/api/v1/incidents",
            data={
                "title": "Live fire on the map",
                "description": "Visible to every map client",
                "category": "Fire",
                "region": "Central Delhi",
            },
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert r.status_code == 201, r.text

        msg = json.loads(ws.receive_text())
        assert msg["channel"] == "incidents:map"
        assert msg["type"] == "incident.created"
        assert msg["data"]["id"] == r.json()["id"]
        assert msg["data"]["title"] == "Live fire on the map"
        # the map payload IS the frozen IncidentOut contract
        for field in ("sensitivity", "assessment_status", "visibility", "created_at"):
            assert field in msg["data"]


async def test_ws_publish_suppressed_for_restricted_rows(tc, monkeypatch):
    """RESTRICTED rows never reach the public map topic (publish rule)."""
    from app.models import Incident
    from app.services import map_ws
    from app.core.database import get_session_factory

    async with get_session_factory()() as s:
        inc = Incident(
            title="Restricted meeting",
            category="Crime/Safety",
            region="Central Delhi",
            latitude=28.61,
            longitude=77.21,
            sensitivity="RESTRICTED",
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)

    published: list[str] = []

    async def spy(channel: str, message: str) -> None:
        published.append(message)

    monkeypatch.setattr(map_ws.pool(), "publish", spy)
    await map_ws.publish_incident_created(inc)
    assert published == []  # suppressed — not PUBLIC
