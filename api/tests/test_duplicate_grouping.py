"""Day 3 task 6 — duplicate grouping v1: a submission that describes an
already-open event files under its parent incident (vision.md §D) instead of
creating a duplicate row. Same region, ≤ 30 min old, ≥ 50% token overlap,
parent not DEFINITELY_FALSE.

Regions: Ghaziabad / Faridabad are NCR-allowlisted (stub rule 1 keeps the
reports MAYBE_TRUE) but unused by the seed — no cross-test collisions.

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import uuid

PW = "Str0ngPass!23"


async def _register(client, tag: str) -> dict:
    email = f"{tag}+{uuid.uuid4().hex[:8]}@test.example"
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reporter", "password": PW},
    )
    assert r.status_code == 201, r.text
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _post(client, tokens: dict, **fields) -> dict:
    r = await client.post("/api/v1/incidents", data=fields, headers=_auth(tokens))
    assert r.status_code == 201, r.text
    return r.json()


async def test_same_event_groups_under_one_parent(client):
    tokens = await _register(client, "dup")
    first = await _post(
        client,
        tokens,
        title="Fire near the bus depot",
        description="Thick smoke rising from the depot shed",
        category="Fire",
        region="Ghaziabad",
    )
    assert first["grouped"] is False and first["report_count"] == 1

    second = await _post(
        client,
        tokens,
        title="Fire near a bus depot",
        description="Thick smoke in the depot yard",
        category="Fire",
        region="Ghaziabad",
    )
    # one incident, two reports — the parent's id and axes come back
    assert second["grouped"] is True
    assert second["id"] == first["id"]
    assert second["report_count"] == 2

    listed = await client.get(
        "/api/v1/incidents?region=Ghaziabad&limit=100", headers=_auth(tokens)
    )
    assert listed.json()["total"] == 1  # no duplicate incident row ever

    detail = await client.get(f"/api/v1/incidents/{first['id']}", headers=_auth(tokens))
    assert len(detail.json()["reports"]) == 2  # both reports retained (§D)


async def test_different_event_gets_its_own_incident(client):
    tokens = await _register(client, "solo")
    first = await _post(
        client,
        tokens,
        title="Medical emergency at the Faridabad bus terminal",
        description="Patient collapsed near the ticket counter",
        category="Medical emergency",
        region="Faridabad",
    )
    second = await _post(
        client,
        tokens,
        title="Chimney fire at a Sector 9 factory",
        description="Flames from the rooftop kiln chimney",
        category="Fire",
        region="Faridabad",
    )
    assert second["grouped"] is False
    assert second["id"] != first["id"]
    assert second["report_count"] == 1

    listed = await client.get(
        "/api/v1/incidents?region=Faridabad&limit=100", headers=_auth(tokens)
    )
    assert listed.json()["total"] == 2


def test_token_overlap_pure_function():
    from app.services.incident_service import token_overlap

    assert token_overlap("fire at the bus depot", "fire at the bus depot") == 1.0
    # tokens are words ≥3 chars — no shared word means 0
    assert (
        token_overlap("fire at the bus depot", "waterlogging beneath a flooded flyover")
        == 0.0
    )
    assert token_overlap("anything", "") == 0.0  # empty submission never matches
