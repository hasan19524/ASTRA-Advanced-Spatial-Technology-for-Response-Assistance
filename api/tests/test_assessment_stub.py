"""Day 3 task 4 — the deterministic assessment stub (3 ordered rules),
end-to-end through POST /incidents:

  1. out-of-NCR region      → DEFINITELY_FALSE (axes flipped via task 3)
  2. blacklist keyword      → DEFINITELY_FALSE
  3. trusted reporter email → MAYBE_TRUE immediately
  4. else                   → MAYBE_TRUE (missing ≠ contradicting)

Every assessment row must carry backend="rules_stub" + a reason.

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import uuid

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import User

PW = "Str0ngPass!23"


async def _make_user(email: str, role: str) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=email,
            full_name="Test Account",
            password_hash=hash_password(PW),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _login(client, email: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()


async def _register(client, tag: str, email: str | None = None) -> dict:
    email = email or f"{tag}+{uuid.uuid4().hex[:8]}@test.example"
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reporter", "password": PW},
    )
    assert r.status_code == 201, r.text
    return await _login(client, email)


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_rule1_out_of_ncr_region_is_definitely_false(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        data={
            "title": "Fire at Marine Drive",
            "description": "Big flames near the sea",
            "category": "Fire",
            "region": "Mumbai",
        },
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["assessment_status"] == "DEFINITELY_FALSE"
    assert body["visibility"] == "HIDDEN"  # task 3 flipped it
    assert body["lifecycle"] == "CLOSED"

    # gone from the citizen's list, 404 by id, still auditable via officer
    listed = await client.get("/api/v1/incidents?limit=100", headers=_auth(tokens))
    assert body["id"] not in {i["id"] for i in listed.json()["items"]}
    assert (
        await client.get(f"/api/v1/incidents/{body['id']}", headers=_auth(tokens))
    ).status_code == 404

    officer = await _make_user(
        f"officer+{uuid.uuid4().hex[:8]}@test.example", "VERIFICATION_OFFICER"
    )
    off_tokens = await _login(client, officer.email)
    detail = await client.get(
        f"/api/v1/incidents/{body['id']}", headers=_auth(off_tokens)
    )
    assert detail.status_code == 200
    assessment = detail.json()["assessments"][0]
    assert assessment["backend"] == "rules_stub"
    assert assessment["outcome"] == "DEFINITELY_FALSE"
    assert "outside the Delhi-NCR" in assessment["reason"]


async def test_rule2_blacklist_keyword_is_definitely_false(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        data={
            "title": "PRANK call — dragon invasion at the mall",
            "description": "definitely a joke",
            "category": "Hazard/Other",
            "region": "South Delhi",
        },
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["assessment_status"] == "DEFINITELY_FALSE"
    assert body["visibility"] == "HIDDEN" and body["lifecycle"] == "CLOSED"

    officer = await _make_user(
        f"officer+{uuid.uuid4().hex[:8]}@test.example", "VERIFICATION_OFFICER"
    )
    off_tokens = await _login(client, officer.email)
    assessment = (
        await client.get(f"/api/v1/incidents/{body['id']}", headers=_auth(off_tokens))
    ).json()["assessments"][0]
    assert assessment["backend"] == "rules_stub"
    assert "blacklist keyword" in assessment["reason"]


async def test_rule3_trusted_reporter_is_maybe_true(client):
    # register with the whitelisted official-feed address (stub rule 3)
    tokens = await _register(client, "trusted", email="control@ndrf.gov.in")
    r = await client.post(
        "/api/v1/incidents",
        data={
            "title": "Bridge partial collapse, Yamuna Basin",
            "description": "NDRF field unit on scene",
            "category": "Structural collapse",
            "region": "Yamuna Basin",
        },
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["assessment_status"] == "MAYBE_TRUE"
    assert body["visibility"] == "PUBLIC_UNVERIFIED"
    assert body["lifecycle"] == "OPEN"

    detail = await client.get(f"/api/v1/incidents/{body['id']}", headers=_auth(tokens))
    assessment = detail.json()["assessments"][0]
    assert assessment["backend"] == "rules_stub"
    assert assessment["outcome"] == "MAYBE_TRUE"
    assert "trusted-source whitelist" in assessment["reason"]


async def test_rule4_plain_report_is_maybe_true_and_absence_is_not_evidence(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        data={
            "title": "Fire near bus stand",
            "description": "Thick smoke, two fire engines needed",
            "category": "Fire",
            # NOTE: no region at all — missing information must never be
            # treated as contradicting evidence (vision §B)
        },
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["assessment_status"] == "MAYBE_TRUE"
    assert body["visibility"] == "PUBLIC_UNVERIFIED" and body["lifecycle"] == "OPEN"

    detail = await client.get(f"/api/v1/incidents/{body['id']}", headers=_auth(tokens))
    assessment = detail.json()["assessments"][0]
    assert assessment["backend"] == "rules_stub"
    assert assessment["confidence"] == 0.5
    assert "missing evidence is not counter-evidence" in assessment["reason"]
