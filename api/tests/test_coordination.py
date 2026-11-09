"""Coordination router tests — phase ladder, close, reopen-closed.

Previously zero coverage (audit finding). Also pins the P0 fix that moved
the lifecycle reopen off the shadowed POST /incidents/{id}/reopen path.
"""

import uuid

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import Incident, User

PW = "Str0ngPass!23"


async def _admin() -> User:
    async with get_session_factory()() as s:
        u = User(
            email=f"admin+{uuid.uuid4().hex[:8]}@test.example",
            full_name="Coordination Admin",
            password_hash=hash_password(PW),
            role="CENTRAL_ADMIN",
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _token(client, user: User) -> str:
    r = await client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": PW}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _seed_incident(**overrides) -> str:
    async with get_session_factory()() as s:
        inc = Incident(
            title=overrides.pop("title", "Coordination test fire"),
            category=overrides.pop("category", "Fire"),
            region=overrides.pop("region", "Central Delhi"),
            latitude=28.6139,
            longitude=77.2090,
            **overrides,
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)
        return inc.id


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_phase_ladder_strict_forward_only(client):
    """NONE -> COORDINATING -> ACTIVE -> RESOLVED; skipping/backwards -> 409."""
    inc_id = await _seed_incident()
    admin = await _admin()
    token = await _token(client, admin)

    r = await client.post(
        f"/api/v1/incidents/{inc_id}/phase",
        json={"phase": "ACTIVE"},
        headers=_auth(token),
    )
    assert r.status_code == 409, "skipping NONE->ACTIVE must be refused"

    for phase in ("COORDINATING", "ACTIVE", "RESOLVED"):
        r = await client.post(
            f"/api/v1/incidents/{inc_id}/phase",
            json={"phase": phase},
            headers=_auth(token),
        )
        assert r.status_code == 200, f"{phase}: {r.text}"

    # backwards from RESOLVED -> refused
    r = await client.post(
        f"/api/v1/incidents/{inc_id}/phase",
        json={"phase": "ACTIVE"},
        headers=_auth(token),
    )
    assert r.status_code == 409


async def test_citizen_cannot_set_phase_or_close(client):
    inc_id = await _seed_incident()
    from app.core.security import hash_password as hp

    async with get_session_factory()() as s:
        c = User(
            email=f"citizen+{uuid.uuid4().hex[:8]}@test.example",
            full_name="Plain Citizen",
            password_hash=hp(PW),
            role="CITIZEN",
        )
        s.add(c)
        await s.commit()
        await s.refresh(c)
    token = await _token(client, c)

    r = await client.post(
        f"/api/v1/incidents/{inc_id}/phase",
        json={"phase": "COORDINATING"},
        headers=_auth(token),
    )
    assert r.status_code == 403
    r = await client.post(
        f"/api/v1/incidents/{inc_id}/close", json={}, headers=_auth(token)
    )
    assert r.status_code == 403


async def test_close_then_reopen_closed(client):
    """CLOSED -> reopen-closed -> OPEN (the formerly-shadowed lifecycle path)."""
    inc_id = await _seed_incident()
    admin = await _admin()
    token = await _token(client, admin)

    r = await client.post(
        f"/api/v1/incidents/{inc_id}/close", json={}, headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["lifecycle"] == "CLOSED"

    r = await client.post(
        f"/api/v1/incidents/{inc_id}/reopen-closed", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["lifecycle"] == "OPEN"


async def test_definitely_false_cannot_be_reopened(client):
    """I1: a DEFINITELY_FALSE report stays HIDDEN+CLOSED — reopen refused."""
    inc_id = await _seed_incident(
        assessment_status="DEFINITELY_FALSE",
        visibility="HIDDEN",
        lifecycle="CLOSED",
    )
    admin = await _admin()
    token = await _token(client, admin)
    r = await client.post(
        f"/api/v1/incidents/{inc_id}/reopen-closed", headers=_auth(token)
    )
    assert r.status_code == 409, r.text
