"""Day 3 contract tests — incident report submission (AD-8 upload), list
(filters/pagination), detail (timeline), and the visibility rule:
RESTRICTED/HIDDEN rows exist only for `incident.view_restricted` roles.

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import uuid

import pytest

from app.core.constants import NCR_CENTER_LAT, NCR_CENTER_LON
from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import Incident, IncidentReport, User

PW = "Str0ngPass!23"
JPEG = b"\xff\xd8\xff\xe0test-jpeg-bytes"


# ---------------------------------------------------------------- helpers
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


async def _login(client, email: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
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


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _report_fields(**overrides) -> dict:
    fields = {
        "title": "Fire near bus stand",
        "description": "Thick smoke, two fire engines needed",
        "category": "Fire",
        "region": "Central Delhi",
    }
    fields.update(overrides)
    return fields


async def _db_incident(**overrides) -> str:
    """Insert an incident with axis states no public flow produces."""
    async with get_session_factory()() as s:
        inc = Incident(
            title=overrides.pop("title", "Seeded state"),
            category=overrides.pop("category", "Fire"),
            region=overrides.pop("region", "Central Delhi"),
            latitude=NCR_CENTER_LAT,
            longitude=NCR_CENTER_LON,
            **overrides,
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)
        return inc.id


# ---------------------------------------------------------------- task 1: submit
async def test_citizen_submits_report_with_defaults(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents", data=_report_fields(), headers=_auth(tokens)
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["grouped"] is False
    assert body["assessment_status"] == "MAYBE_TRUE"  # stub rule 4 ran on create
    assert body["visibility"] == "PUBLIC_UNVERIFIED"
    assert body["lifecycle"] == "OPEN"
    assert body["report_count"] == 1  # the submission itself is a report row
    assert body["latitude"] == pytest.approx(NCR_CENTER_LAT)  # coords optional
    assert body["longitude"] == pytest.approx(NCR_CENTER_LON)

    async with get_session_factory()() as s:
        from sqlalchemy import select

        report = await s.scalar(
            select(IncidentReport).where(IncidentReport.incident_id == body["id"])
        )
    assert report is not None and report.content.startswith("Thick smoke")


async def test_report_requires_token(client):
    r = await client.post("/api/v1/incidents", data=_report_fields())
    assert r.status_code == 401


async def test_report_rejects_bad_inputs(client):
    tokens = await _register(client, "citizen")
    # unknown category
    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(category="Alien invasion"),
        headers=_auth(tokens),
    )
    assert r.status_code == 422
    assert "Alien invasion" in r.json()["detail"]
    # missing title
    fields = _report_fields()
    del fields["title"]
    r = await client.post("/api/v1/incidents", data=fields, headers=_auth(tokens))
    assert r.status_code == 422


# ---------------------------------------------------------------- AD-8 upload
async def test_photo_upload_saved_and_served(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        # distinctive event text — identical texts would (correctly!) group
        data=_report_fields(
            title="Studio fire in Khan Market",
            description="Flames from the rooftop water tank area",
        ),
        files={"photo": ("smoke.jpg", JPEG, "image/jpeg")},
        headers=_auth(tokens),
    )
    assert r.status_code == 201, r.text
    incident_id = r.json()["id"]

    detail = await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(tokens))
    assert detail.status_code == 200
    media = detail.json()["reports"][0]["media_path"]
    assert media and media.startswith("/uploads/")
    assert detail.json()["reports"][0]["source"] == "PHOTO"

    import hashlib, hmac, time

    fname = media.removeprefix("/uploads/")
    exp = int(time.time()) + 60
    sig = hmac.new(
        # test mirrors the server-side secret; conftest sets JWT_SECRET=test-secret
        b"test-secret",
        f"{fname}:{exp}".encode(),
        hashlib.sha256,
    ).hexdigest()
    served = await client.get(f"{media}?exp={exp}&sig={sig}")
    assert served.status_code == 200
    assert served.content == JPEG

    # cleanup the dev uploads dir
    from app.services.incident_service import UPLOADS_DIR

    (UPLOADS_DIR / media.removeprefix("/uploads/")).unlink()


async def test_photo_validation_422(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(),
        files={"photo": ("evil.pdf", b"%PDF", "application/pdf")},
        headers=_auth(tokens),
    )
    assert r.status_code == 422 and "Photo must be" in r.json()["detail"]

    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(),
        files={"photo": ("huge.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")},
        headers=_auth(tokens),
    )
    assert r.status_code == 422 and "5 MB" in r.json()["detail"]


# ---------------------------------------------------------------- task 2: list/detail
async def test_list_filters_and_pagination(client):
    # direct inserts keep the count hermetic in the shared test DB, and a
    # unique region scopes the assertions no matter what other tests created
    zone = f"Zone-{uuid.uuid4().hex[:8]}"
    await _db_incident(title="Fire one", region=zone, category="Fire")
    fire_two = await _db_incident(title="Fire two", region=zone, category="Fire")
    await _db_incident(title="Pothole", region=zone, category="Accident")

    tokens = await _register(client, "citizen")
    r = await client.get(
        f"/api/v1/incidents?category=Fire&region={zone}&limit=1&offset=0",
        headers=_auth(tokens),
    )
    assert r.status_code == 200
    page = r.json()
    assert page["total"] == 2 and len(page["items"]) == 1
    assert page["items"][0]["category"] == "Fire"
    assert page["limit"] == 1 and page["offset"] == 0

    # newest first → offset=1 over the zone lands exactly on the 2nd fire
    r = await client.get(
        f"/api/v1/incidents?region={zone}&limit=1&offset=1", headers=_auth(tokens)
    )
    assert {item["id"] for item in r.json()["items"]} == {fire_two}

    assert (
        await client.get("/api/v1/incidents?limit=0", headers=_auth(tokens))
    ).status_code == 422
    assert (await client.get("/api/v1/incidents")).status_code == 401


async def test_detail_timeline_and_no_reporter_identity(client):
    tokens = await _register(client, "citizen")
    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(
            title="Crane collapse at Rajiv Chowk construction site",
            description="Tower crane boom fell onto the service road",
        ),
        files={"photo": ("one.jpg", JPEG, "image/jpeg")},
        headers=_auth(tokens),
    )
    detail = await client.get(
        f"/api/v1/incidents/{r.json()['id']}", headers=_auth(tokens)
    )
    assert detail.status_code == 200
    body = detail.json()
    assert body["report_count"] == len(body["reports"]) == 1
    # task 4: every submission carries one rules_stub assessment row
    assert len(body["assessments"]) == 1
    assert body["assessments"][0]["backend"] == "rules_stub"
    assert body["assessments"][0]["outcome"] == "MAYBE_TRUE"
    assert body["assessments"][0]["reason"]
    assert "reporter_id" not in body["reports"][0]  # privacy, contract
    assert "id" in body["reports"][0]


async def test_missing_incident_is_404(client):
    tokens = await _register(client, "citizen")
    r = await client.get(f"/api/v1/incidents/{uuid.uuid4()}", headers=_auth(tokens))
    assert r.status_code == 404


# ---------------------------------------------------------------- visibility rule
@pytest.mark.parametrize(
    ("kwargs", "expected_visible_to_citizen"),
    [
        ({"assessment_status": "DEFINITELY_FALSE", "visibility": "HIDDEN"}, False),
        ({"sensitivity": "RESTRICTED"}, False),
        ({}, True),  # plain public incident
    ],
)
async def test_visibility_rule_by_row_state(
    client, kwargs, expected_visible_to_citizen
):
    incident_id = await _db_incident(**kwargs)
    citizen = await _register(client, "citizen")
    officer = await _make_user(
        f"officer+{uuid.uuid4().hex[:8]}@test.example", "VERIFICATION_OFFICER"
    )
    off_tokens = await _login(client, officer.email)

    listed = await client.get("/api/v1/incidents?limit=100", headers=_auth(citizen))
    ids = {item["id"] for item in listed.json()["items"]}
    assert (incident_id in ids) is expected_visible_to_citizen

    detail = await client.get(
        f"/api/v1/incidents/{incident_id}", headers=_auth(citizen)
    )
    assert (detail.status_code == 200) is expected_visible_to_citizen
    if not expected_visible_to_citizen:
        assert detail.status_code == 404  # absence, never 403

    # the officer holds incident.view_restricted → sees every row
    off_listed = await client.get(
        "/api/v1/incidents?limit=100", headers=_auth(off_tokens)
    )
    assert incident_id in {item["id"] for item in off_listed.json()["items"]}
    assert (
        await client.get(f"/api/v1/incidents/{incident_id}", headers=_auth(off_tokens))
    ).status_code == 200


# ---------------------------------------------------------------- audit
async def test_report_submission_is_audited(client):
    tokens = await _register(client, "citizen")
    rid = f"rid-{uuid.uuid4().hex[:8]}"
    r = await client.post(
        "/api/v1/incidents",
        data=_report_fields(
            title="Neon sign fell in Karol Bagh",
            description="Broken signage blocking the footpath",
        ),
        headers={**_auth(tokens), "x-request-id": rid},
    )
    assert r.status_code == 201

    from sqlalchemy import select

    from app.models import AuditLog

    async with get_session_factory()() as s:
        row = await s.scalar(select(AuditLog).where(AuditLog.request_id == rid))
    assert row is not None and row.action == "incident.create"
    assert row.actor_id is not None and row.status_code == 201
