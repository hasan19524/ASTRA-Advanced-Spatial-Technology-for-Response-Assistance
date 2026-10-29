"""Verification axis (Day 4, AD-23): verify / reject / reopen, the detail-page
events (citizen-stripped), the officer queue, and the `incident.updated` WS
envelope. Runs against the real stack (Postgres + Redis via docker compose)."""

import asyncio
import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.main import app
from app.models import User

PW = "Str0ngPass!23"


@pytest.fixture()
def tc():
    """ONE portal for the whole test (see test_map_ws.py — portal-per-request
    closes the lru_cached pool's loop)."""
    with TestClient(app) as client:
        yield client


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _report_fields(**overrides) -> dict:
    tag = uuid.uuid4().hex[:8]
    fields = {
        "title": f"Fire near bus stand [{tag}]",
        "description": f"Thick smoke [{tag}]",
        "category": "Fire",
        "region": "Central Delhi",
    }
    fields.update(overrides)
    return fields


async def _make_user(email: str, role: str) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=email,
            full_name="Verification Officer",
            password_hash=hash_password(PW),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _login(client, email: str, password: str = PW) -> dict:
    r = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert r.status_code == 200, r.text
    return r.json()


async def _register(client, tag: str) -> dict:
    email = f"{tag}+{uuid.uuid4().hex[:8]}@test.example"
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reporter", "password": PW},
    )
    assert r.status_code == 201, r.text
    return await _login(client, email)


async def _submit(client, tokens, **overrides) -> str:
    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(**overrides),
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------- verify / reject


async def test_verify_happy_path(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    vo = await _make_user("vo.verify@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "Looks genuine after site visit"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "VERIFIED"

    d = await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(vtokens))
    assert d.status_code == 200
    events = d.json()["verification_events"]
    assert len(events) == 1
    assert events[0]["action"] == "VERIFIED"
    assert events[0]["reason"] == "Looks genuine after site visit"
    assert events[0]["officer"] is not None


async def test_verify_citizen_is_403(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED"},
        headers=_auth(tokens),
    )
    assert r.status_code == 403, r.text


async def test_reject_requires_reason(client):
    vo = await _make_user("vo.reject@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "REJECTED"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 422, r.text


async def test_reject_then_direct_verify_is_refused(client):
    """AD-23: REJECTED -> VERIFIED directly is refused (two auditable events)."""
    vo = await _make_user("vo.reject2@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "REJECTED", "reason": "looks staged"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 200, r.text

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "changed my mind"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 409, r.text  # terminal — must reopen first

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/reopen",
        json={"reason": "new evidence surfaced"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "REOPENED"

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "now confirmed"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 200, r.text


async def test_double_verify_is_409(client):
    """No-op changes are refused (a double click is not a second decision)."""
    vo = await _make_user("vo.double@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "ok"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 200, r.text

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "ok again"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 409, r.text


async def test_reopen_from_unverified_is_409(client):
    vo = await _make_user("vo.reopen1@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/reopen",
        json={"reason": "nothing"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 409, r.text


async def test_reopen_from_verified_is_409(client):
    """VERIFIED is terminal."""
    vo = await _make_user("vo.reopen2@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "ok"},
        headers=_auth(vtokens),
    )
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/reopen",
        json={"reason": "nothing"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 409, r.text


async def test_verify_hidden_df_report_is_409(client):
    """DEFINITELY_FALSE is HIDDEN + CLOSED — verification does not apply."""
    tokens = await _register(client, "citizen")
    incident_id = await _submit(
        client, tokens, title="Prank call lol asdf", description="prank lol asdf"
    )
    vo = await _make_user("vo.df@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "whatever"},
        headers=_auth(vtokens),
    )
    assert r.status_code == 409, r.text


# ---------------------------------------------------------------- detail page


async def test_detail_events_stripped_for_citizen(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    vo = await _make_user("vo.strip@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "REJECTED", "reason": "staged prank"},
        headers=_auth(vtokens),
    )

    d = await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(tokens))
    assert d.status_code == 200
    events = d.json()["verification_events"]
    assert len(events) == 1
    assert events[0]["action"] == "REJECTED"
    assert events[0]["reason"] is None  # stripped for citizens
    assert events[0]["officer"] is None  # stripped for citizens
    assert events[0]["id"] is not None
    assert events[0]["created_at"] is not None


async def test_detail_events_full_for_officer(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)
    vo = await _make_user("vo.full@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    await client.post(
        f"/api/v1/incidents/{incident_id}/verify",
        json={"verdict": "VERIFIED", "reason": "confirmed on site"},
        headers=_auth(vtokens),
    )

    d = await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(vtokens))
    assert d.status_code == 200
    events = d.json()["verification_events"]
    assert len(events) == 1
    assert events[0]["reason"] == "confirmed on site"
    assert events[0]["officer"] == "Verification Officer"


# ---------------------------------------------------------------- officer queue


async def test_verification_queue(client):
    vo = await _make_user("vo.queue@astra.dev", "VERIFICATION_OFFICER")
    vtokens = await _login(client, vo.email)
    tokens = await _register(client, "citizen")

    a = await _submit(client, tokens)  # Fire, MAYBE_TRUE, unverified
    b = await _submit(client, tokens, category="Utility outage")  # unverified
    await _submit(
        client, tokens, title="Prank stuff lol asdf", description="prank stuff lol asdf"
    )  # DF -> hidden, never in queue

    async def queue_ids(**params):
        r = await client.get(
            "/api/v1/verification/queue", params=params, headers=_auth(vtokens)
        )
        assert r.status_code == 200, r.text
        return {item["id"] for item in r.json()["items"]}

    assert await queue_ids() == {a, b}  # both unverified, DF excluded
    assert await queue_ids(urgency=True) == {a}  # Fire urgent; Utility outage not
    assert await queue_ids(assessment="MAYBE_TRUE") == {a, b}

    # verify A -> it leaves the queue
    await client.post(
        f"/api/v1/incidents/{a}/verify",
        json={"verdict": "VERIFIED", "reason": "confirmed"},
        headers=_auth(vtokens),
    )
    assert await queue_ids() == {b}
    assert await queue_ids(urgency=True) == set()  # B is Utility outage

    # reject B -> REJECTED stays in the queue
    await client.post(
        f"/api/v1/incidents/{b}/verify",
        json={"verdict": "REJECTED", "reason": "staged"},
        headers=_auth(vtokens),
    )
    assert await queue_ids() == {b}

    # queue requires the verify permission
    citizen_tokens = await _register(client, "citizen2")
    r = await client.get("/api/v1/verification/queue", headers=_auth(citizen_tokens))
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------- WS fan-out


def _create_user_async(email: str, role: str) -> None:
    async def go() -> None:
        async with get_session_factory()() as s:
            s.add(
                User(
                    email=email,
                    full_name="WS Officer",
                    password_hash=hash_password(PW),
                    role=role,
                )
            )
            await s.commit()

    asyncio.run(go())


def test_ws_incident_updated_fanout(tc):
    """Verifying an incident publishes `incident.updated` on incidents:map."""
    email = f"wsvo+{uuid.uuid4().hex[:8]}@test.example"
    _create_user_async(email, "VERIFICATION_OFFICER")

    r = tc.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    tokens = r.json()

    r = tc.post(
        "/api/v1/incidents",
        data=_report_fields(),
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    incident_id = r.json()["id"]

    with tc.websocket_connect(f"/ws/map?token={tokens['access_token']}") as ws:
        first = json.loads(ws.receive_text())
        assert first == {"channel": "incidents:map", "type": "connected"}

        r = tc.post(
            f"/api/v1/incidents/{incident_id}/verify",
            json={"verdict": "VERIFIED", "reason": "WS smoke test"},
            headers=_auth(tokens),
        )
        assert r.status_code == 200, r.text

        msg = json.loads(ws.receive_text())
        assert msg["channel"] == "incidents:map"
        assert msg["type"] == "incident.updated"
        assert msg["data"]["id"] == incident_id
        assert msg["data"]["verification"] == "VERIFIED"
