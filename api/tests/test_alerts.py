"""Alert geo-targeting + archive tests (P1 security fix).

The old geo-target compared `user.department` ("Fire & Rescue") against
`Alert.area` ("Central Delhi"). Different namespaces, so the comparison never
matched: a department head saw *no* region alerts, only broadcasts. These
tests pin the corrected behaviour:

  * explicit alert preference (citizen's only opt-in) -> that region
  * department (city-wide responder, AD-14) -> every NCR region
  * neither -> broadcasts only ("*")

Plus the two write-path guards:
  * an unknown `area` is rejected at 422 instead of creating an alert that is
    silently invisible to every user
  * expired alerts are ARCHIVED (expired_at stamped), never deleted
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import Alert, User

PW = "Str0ngPass!23"


async def _make_user(role: str = "CITIZEN", department: str | None = None) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=f"{role.lower()}+{uuid.uuid4().hex[:8]}@test.example",
            full_name=f"Test {role}",
            password_hash=hash_password(PW),
            role=role,
            department=department,
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


async def _seed_alert(area: str, **overrides) -> str:
    async with get_session_factory()() as s:
        alert = Alert(
            event="Test event",
            title="Test alert",
            body="Test body",
            severity="MODERATE",
            urgency="EXPECTED",
            certainty="LIKELY",
            area=area,
            published_by=None,
            **overrides,
        )
        s.add(alert)
        await s.commit()
        await s.refresh(alert)
        return alert.id


async def _list(client, token: str) -> list[str]:
    r = await client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return [a["area"] for a in r.json()]


# --- geo-targeting -----------------------------------------------------------


async def test_citizen_without_pref_sees_only_broadcasts(client):
    """A citizen who never set a preference gets '*' alerts and nothing else."""
    citizen = await _make_user()
    await _seed_alert("*")
    await _seed_alert("Central Delhi")

    token = await _token(client, citizen)
    areas = await _list(client, token)
    assert areas == ["*"], areas


async def test_citizen_with_pref_sees_that_region_only(client):
    """The citizen's own preference is the opt-in that actually works."""
    citizen = await _make_user()
    await _seed_alert("South Delhi")
    await _seed_alert("Central Delhi")
    await _seed_alert("*")

    r = await client.post(
        "/api/v1/alerts/preferences",
        json={"region": "South Delhi", "enabled": True},
        headers={"Authorization": f"Bearer {await _token(client, citizen)}"},
    )
    assert r.status_code == 201, r.text

    areas = await _list(client, await _token(client, citizen))
    assert sorted(areas) == ["*", "South Delhi"], areas


async def test_disabled_preference_is_ignored(client):
    citizen = await _make_user()
    await _seed_alert("South Delhi")

    token = await _token(client, citizen)
    r = await client.post(
        "/api/v1/alerts/preferences",
        json={"region": "South Delhi", "enabled": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text

    areas = await _list(client, token)
    assert areas == [], areas


async def test_department_head_sees_region_alerts(client):
    """The P0 bug: a department head saw NO region-targeted alert."""
    dep_head = await _make_user("DEPARTMENT_HEAD", "Fire & Rescue")
    await _seed_alert("Central Delhi")
    await _seed_alert("Noida")

    areas = await _list(client, await _token(client, dep_head))
    assert sorted(areas) == ["Central Delhi", "Noida"], areas


async def test_department_head_and_citizen_preferences_combine(client):
    """A department head's coverage is the union of their prefs and dept."""
    dep_head = await _make_user("DEPARTMENT_HEAD", "Fire & Rescue")
    await _seed_alert("Central Delhi")

    token = await _token(client, dep_head)
    r = await client.post(
        "/api/v1/alerts/preferences",
        json={"region": "South Delhi", "enabled": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text

    areas = await _list(client, token)
    assert areas == ["Central Delhi"], areas


async def test_central_admin_sees_every_region_alert(client):
    """Central command publishes the alerts -- it must see all of them.

    Without this, an admin publishes a "Central Delhi" alert and it never
    appears in their own list.
    """
    admin = await _make_user("CENTRAL_ADMIN")
    await _seed_alert("Central Delhi")
    await _seed_alert("Noida")

    areas = await _list(client, await _token(client, admin))
    assert sorted(areas) == ["Central Delhi", "Noida"], areas


async def test_verification_officer_without_prefs_sees_broadcasts_only(client):
    """Non-operational roles are not city-wide responders."""
    officer = await _make_user("VERIFICATION_OFFICER")
    await _seed_alert("Central Delhi")
    await _seed_alert("*")

    areas = await _list(client, await _token(client, officer))
    assert areas == ["*"], areas


async def test_comma_separated_area_matches_any_region(client):
    citizen = await _make_user()
    await _seed_alert("South Delhi, Noida")

    token = await _token(client, citizen)
    r = await client.post(
        "/api/v1/alerts/preferences",
        json={"region": "Noida", "enabled": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text

    areas = await _list(client, token)
    assert areas == ["South Delhi, Noida"], areas


# --- write-path guards -------------------------------------------------------


async def test_create_alert_rejects_unknown_area(client):
    admin = await _make_user("CENTRAL_ADMIN")
    r = await client.post(
        "/api/v1/alerts",
        json={"event": "e", "title": "t", "body": "b", "area": "Mars"},
        headers={"Authorization": f"Bearer {await _token(client, admin)}"},
    )
    assert r.status_code == 422, r.text


async def test_create_alert_rejects_lowercase_region(client):
    """'central delhi' is a typo, not a region -> 422, not a silent black hole."""
    admin = await _make_user("CENTRAL_ADMIN")
    r = await client.post(
        "/api/v1/alerts",
        json={"event": "e", "title": "t", "body": "b", "area": "central delhi"},
        headers={"Authorization": f"Bearer {await _token(client, admin)}"},
    )
    assert r.status_code == 422, r.text


async def test_create_alert_accepts_valid_regions(client):
    admin = await _make_user("CENTRAL_ADMIN")
    r = await client.post(
        "/api/v1/alerts",
        json={
            "event": "flood",
            "title": "Waterlogging",
            "body": "Road submerged",
            "area": "South Delhi, Noida",
        },
        headers={"Authorization": f"Bearer {await _token(client, admin)}"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["area"] == "South Delhi,Noida", r.text


async def test_preference_rejects_unknown_region(client):
    citizen = await _make_user()
    r = await client.post(
        "/api/v1/alerts/preferences",
        json={"region": "Atlantis", "enabled": True},
        headers={"Authorization": f"Bearer {await _token(client, citizen)}"},
    )
    assert r.status_code == 422, r.text


async def test_citizen_cannot_create_alert(client):
    citizen = await _make_user()
    r = await client.post(
        "/api/v1/alerts",
        json={"event": "e", "title": "t", "body": "b", "area": "*"},
        headers={"Authorization": f"Bearer {await _token(client, citizen)}"},
    )
    assert r.status_code == 403, r.text


# --- expiry: archive, never delete -------------------------------------------


async def test_expired_alerts_are_archived_not_deleted(client):
    """The sweeper must stamp expired_at -- the row has to survive."""
    from app.services import alert_service

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    alert_id = await _seed_alert("*", expires_at=past)

    async with get_session_factory()() as s:
        archived = await alert_service.archive_expired_alerts(s)
    assert archived == 1

    async with get_session_factory()() as s:
        row = await s.get(Alert, alert_id)
        assert row is not None, "expired alert was DELETED -- it must be archived"
        assert row.expired_at is not None, "expired_at was not stamped"
        # the content survives for the audit trail
        assert row.title == "Test alert"


async def test_archived_alert_is_not_listed(client):
    from app.services import alert_service

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    await _seed_alert("*", expires_at=past)
    async with get_session_factory()() as s:
        await alert_service.archive_expired_alerts(s)

    citizen = await _make_user()
    areas = await _list(client, await _token(client, citizen))
    assert areas == [], areas


async def test_live_alert_is_not_archived(client):
    from app.services import alert_service

    future = datetime.now(timezone.utc) + timedelta(hours=1)
    await _seed_alert("*", expires_at=future)
    async with get_session_factory()() as s:
        archived = await alert_service.archive_expired_alerts(s)
    assert archived == 0


async def test_alert_without_expiry_is_never_archived(client):
    from app.services import alert_service

    await _seed_alert("*", expires_at=None)
    async with get_session_factory()() as s:
        archived = await alert_service.archive_expired_alerts(s)
    assert archived == 0
