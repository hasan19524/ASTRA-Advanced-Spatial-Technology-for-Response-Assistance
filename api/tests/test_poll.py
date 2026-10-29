"""Poll endpoints (AD-18 / Day 4): eligibility, vote, double-vote, rate limit,
audit. Runs against the real stack (Postgres + Redis via docker compose)."""

import uuid

from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import AuditLog, Incident, User

PW = "Str0ngPass!23"


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _report_fields(**overrides) -> dict:
    tag = uuid.uuid4().hex[:8]
    fields = {
        # unique title AND text per call — identical submissions group under
        # one parent (§D); tests need independent incidents
        "title": f"Fire near bus stand [{tag}]",
        "description": f"Thick smoke, two fire engines needed [{tag}]",
        "category": "Fire",
        "region": "Central Delhi",
    }
    fields.update(overrides)
    return fields


async def _make_user(email: str, role: str, department: str | None = None) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=email,
            full_name="Test Account",
            password_hash=hash_password(PW),
            role=role,
            department=department,
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


# ---------------------------------------------------------------- eligible path


async def test_poll_eligible_happy_path(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    r = await client.get(f"/api/v1/incidents/{incident_id}/poll", headers=_auth(tokens))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["eligible"] is True
    assert body["reason"] is None
    assert body["my_vote"] is None
    assert body["genuine"] == 0
    assert body["fake"] == 0
    assert body["percent_genuine"] == 0.0


async def test_poll_vote_updates_counts(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["my_vote"] == "genuine"
    assert body["genuine"] == 1
    assert body["fake"] == 0
    assert body["percent_genuine"] == 100.0

    # consistent on re-read
    r = await client.get(f"/api/v1/incidents/{incident_id}/poll", headers=_auth(tokens))
    assert r.status_code == 200
    assert r.json()["my_vote"] == "genuine"
    assert r.json()["percent_genuine"] == 100.0


async def test_poll_double_vote_is_409(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(tokens),
    )
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote",
        json={"vote": "fake"},
        headers=_auth(tokens),
    )
    assert r.status_code == 409, r.text
    assert "already voted" in r.json()["detail"]


# ---------------------------------------------------------------- ineligibility


async def test_poll_ineligible_df_report(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(
        client,
        tokens,
        title="Prank call lol asdf",
        description="prank lol asdf",  # rule 2 blacklist -> DF
    )

    # hidden from everyone without view_restricted
    r = await client.get(f"/api/v1/incidents/{incident_id}/poll", headers=_auth(tokens))
    assert r.status_code == 404, r.text

    # admins see it but it is not pollable
    admin = await _make_user("admin.poll@astra.dev", "CENTRAL_ADMIN")
    admin_tokens = await _login(client, admin.email)
    r = await client.get(
        f"/api/v1/incidents/{incident_id}/poll", headers=_auth(admin_tokens)
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["eligible"] is False
    assert "HIDDEN" in body["reason"]

    r = await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(admin_tokens),
    )
    assert r.status_code == 409, r.text


async def test_poll_ineligible_restricted_reason(client):
    # DB-insert a RESTRICTED incident (no public flow produces one)
    async with get_session_factory()() as s:
        inc = Incident(
            title="Restricted matter",
            description="Internal only",
            category="Crime/Safety",
            region="Central Delhi",
            latitude=28.61,
            longitude=77.21,
            sensitivity="RESTRICTED",
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)
        incident_id = inc.id

    vo = await _make_user("vo+poll@astra.dev", "VERIFICATION_OFFICER")
    tokens = await _login(client, vo.email)

    r = await client.get(f"/api/v1/incidents/{incident_id}/poll", headers=_auth(tokens))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["eligible"] is False
    assert "sensitivity" in body["reason"].lower()


# ---------------------------------------------------------------- auth / rate limit


async def test_poll_requires_auth(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    r = await client.get(f"/api/v1/incidents/{incident_id}/poll")
    assert r.status_code == 401, r.text
    r = await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote", json={"vote": "genuine"}
    )
    assert r.status_code == 401, r.text


async def test_poll_rate_limit_429(monkeypatch, client):
    monkeypatch.setattr(settings, "poll_rate_limit", 1)
    tokens = await _register(client, "citizen")
    incident_a = await _submit(client, tokens)
    incident_b = await _submit(client, tokens, title="Second fire report")

    r = await client.post(
        f"/api/v1/incidents/{incident_a}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(tokens),
    )
    assert r.status_code == 200, r.text

    r = await client.post(
        f"/api/v1/incidents/{incident_b}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(tokens),
    )
    assert r.status_code == 429, r.text


# ---------------------------------------------------------------- audit


async def test_poll_vote_is_audited(client):
    tokens = await _register(client, "citizen")
    incident_id = await _submit(client, tokens)

    await client.post(
        f"/api/v1/incidents/{incident_id}/poll/vote",
        json={"vote": "genuine"},
        headers=_auth(tokens),
    )

    async with get_session_factory()() as s:
        row = await s.scalar(
            select(AuditLog).where(
                AuditLog.action == "poll.vote",
                AuditLog.resource_id == incident_id,
            )
        )
    assert row is not None
    assert row.actor_role == "CITIZEN"
    assert row.method == "POST"
