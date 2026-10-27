"""Day 2 contract tests — schema completeness (task 1), audit middleware (task 3),
object-level scoping (task 4), seed idempotency (task 2).

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import importlib.util
import pathlib
import uuid

import pytest

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import AuditLog, Base, Incident, ResponseTask, User

PW = "Str0ngPass!23"

EXPECTED_TABLES = {
    "users",
    # incident core
    "incidents",
    "incident_reports",
    "assessments",
    "poll_votes",
    "verification_events",
    # response coordination
    "response_tasks",
    "task_updates",
    "assignments",
    # alerts / audit / assistant
    "alerts",
    "user_alert_prefs",
    "audit_logs",
    "assist_conversations",
    "assist_messages",
    # simulation (AD-3) + graph (AD-4) + feeds
    "sim_runs",
    "map_locations",
    "routing_edges",
    "external_feeds_cache",
}

SEED_CATEGORIES = {
    "Fire",
    "Accident",
    "Flood/Waterlogging",
    "Structural collapse",
    "Medical emergency",
    "Crime/Safety",
    "Utility outage",
    "Hazard/Other",
}


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


async def _seed_task(incident_id: str, department: str) -> ResponseTask:
    async with get_session_factory()() as s:
        t = ResponseTask(
            incident_id=incident_id,
            title=f"{department} task",
            department=department,
            status="OPEN",
        )
        s.add(t)
        await s.commit()
        await s.refresh(t)
        return t


async def _seed_incident() -> Incident:
    async with get_session_factory()() as s:
        inc = Incident(
            title="Scoped test incident",
            category="Fire",
            region="Testville",
            latitude=28.6,
            longitude=77.2,
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)
        return inc


async def _audit_row(request_id: str) -> AuditLog | None:
    from sqlalchemy import select

    async with get_session_factory()() as s:
        return await s.scalar(select(AuditLog).where(AuditLog.request_id == request_id))


# ---------------------------------------------------------------- task 1: schema
def test_all_day2_tables_exist_in_metadata():
    """The full core schema must be modelled — no lazy omissions (task 1)."""
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_sim_tables_have_no_foreign_keys_into_live_tables():
    """AD-3 is structural, not aspirational: `sim_*` declares zero FKs."""
    for table_name in ("sim_runs",):
        fks = Base.metadata.tables[table_name].foreign_keys
        assert not fks, f"{table_name} must not reference live tables, got {fks}"


# ---------------------------------------------------------------- task 3: audit
async def test_successful_login_writes_audit_row(client):
    email = f"audit+{uuid.uuid4().hex[:8]}@test.example"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Audit User", "password": PW},
    )
    rid = f"rid-{uuid.uuid4().hex[:8]}"
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PW},
        headers={"x-request-id": rid},
    )
    assert r.status_code == 200

    row = await _audit_row(rid)
    assert row is not None, "successful login must be audited"
    assert row.action == "auth.login"
    assert row.method == "POST"
    assert row.path == "/api/v1/auth/login"
    assert row.status_code == 200
    assert row.actor_label == email  # actor known even before a token exists
    assert row.actor_id is None  # login has no bearer token yet


async def test_failed_login_writes_audit_row_with_401(client):
    rid = f"rid-{uuid.uuid4().hex[:8]}"
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@test.example", "password": "whatever123"},
        headers={"x-request-id": rid},
    )
    assert r.status_code == 401
    row = await _audit_row(rid)
    assert row is not None, "failed logins must be audited too"
    assert row.status_code == 401
    assert row.actor_label == "nobody@test.example"


async def test_authenticated_mutation_records_actor(client):
    """record_request extracts (id, role) from the bearer token when present."""
    from app.core.audit import record_request

    user = await _make_user(
        f"actor+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN"
    )
    tokens = await _login(client, user.email)
    rid = f"rid-{uuid.uuid4().hex[:8]}"
    touched = str(uuid.uuid4())  # resource_id only captures UUID-shaped segments
    scope = {
        "type": "http",
        "headers": [
            (b"authorization", f"Bearer {tokens['access_token']}".encode()),
            (b"x-request-id", rid.encode()),
        ],
        "client": ("10.0.0.7", 4242),
    }
    await record_request(scope, "POST", f"/api/v1/incidents/{touched}", 200, b"{}")

    row = await _audit_row(rid)
    assert row is not None
    assert row.actor_id == user.id
    assert row.actor_role == "CENTRAL_ADMIN"
    assert row.ip == "10.0.0.7"
    assert row.resource_id == touched  # UUID-shaped segment captured


async def test_non_mutating_requests_are_not_audited(client):
    before = await _audit_count()
    await client.get("/health")
    assert await _audit_count() == before


async def _audit_count() -> int:
    from sqlalchemy import func, select

    async with get_session_factory()() as s:
        return int(await s.scalar(select(func.count()).select_from(AuditLog)) or 0)


# ---------------------------------------------------------------- task 4: scoping
async def test_scoping_right_department_200_wrong_department_404(client):
    """Role gate passes for both heads — object scope decides the rest (404, not 403)."""
    inc = await _seed_incident()
    fire_task = await _seed_task(inc.id, "Fire & Rescue")
    police_task = await _seed_task(inc.id, "Police")

    head_fire = await _make_user(
        f"head.fire+{uuid.uuid4().hex[:8]}@test.example",
        "DEPARTMENT_HEAD",
        "Fire & Rescue",
    )
    head_police = await _make_user(
        f"head.police+{uuid.uuid4().hex[:8]}@test.example",
        "DEPARTMENT_HEAD",
        "Police",
    )
    tok_fire = await _login(client, head_fire.email)
    tok_police = await _login(client, head_police.email)

    own = await client.get(
        f"/api/v1/tasks/{fire_task.id}",
        headers={"Authorization": f"Bearer {tok_fire['access_token']}"},
    )
    assert own.status_code == 200
    assert own.json()["department"] == "Fire & Rescue"

    cross = await client.get(
        f"/api/v1/tasks/{police_task.id}",
        headers={"Authorization": f"Bearer {tok_fire['access_token']}"},
    )
    assert cross.status_code == 404, "cross-department must look nonexistent"
    assert cross.json()["detail"] == "Not found"

    mirrored = await client.get(
        f"/api/v1/tasks/{fire_task.id}",
        headers={"Authorization": f"Bearer {tok_police['access_token']}"},
    )
    assert mirrored.status_code == 404


async def test_scoping_response_team_sees_own_department_only(client):
    inc = await _seed_incident()
    fire_task = await _seed_task(inc.id, "Fire & Rescue")
    medic = await _make_user(
        f"team+{uuid.uuid4().hex[:8]}@test.example", "RESPONSE_TEAM", "Medical/EMS"
    )
    tok = await _login(client, medic.email)
    r = await client.get(
        f"/api/v1/tasks/{fire_task.id}",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 404


async def test_scoping_central_admin_sees_everything(client):
    inc = await _seed_incident()
    police_task = await _seed_task(inc.id, "Police")
    admin = await _make_user(
        f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN"
    )
    tok = await _login(client, admin.email)
    r = await client.get(
        f"/api/v1/tasks/{police_task.id}",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 200


async def test_citizen_lacks_task_permission_403(client):
    """Permission gate fires BEFORE scope: citizen has no `task.view` at all."""
    inc = await _seed_incident()
    fire_task = await _seed_task(inc.id, "Fire & Rescue")
    email = f"citizen+{uuid.uuid4().hex[:8]}@test.example"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Plain Citizen", "password": PW},
    )
    tok = await _login(client, email)
    r = await client.get(
        f"/api/v1/tasks/{fire_task.id}",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 403
    assert "task.view" in r.json()["detail"]


async def test_missing_task_404_for_authorized_user(client):
    admin = await _make_user(
        f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN"
    )
    tok = await _login(client, admin.email)
    r = await client.get(
        f"/api/v1/tasks/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {tok['access_token']}"},
    )
    assert r.status_code == 404


# ---------------------------------------------------------------- task 2: seed
async def test_seed_is_idempotent_and_consistent():
    """`seed/seed.py` twice → no duplicates, all 8 categories, axis invariants hold."""
    from sqlalchemy import func, select, text

    path = pathlib.Path(__file__).resolve().parents[2] / "seed" / "seed.py"
    spec = importlib.util.spec_from_file_location("astra_seed", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # scoping tests above already inserted incidents, and seed (by design) skips
    # incident creation when any exist — clear them so the real seeding runs.
    async with get_session_factory()() as s:
        await s.execute(text("TRUNCATE incidents CASCADE"))
        await s.commit()

    async def counts() -> tuple[int, int]:
        async with get_session_factory()() as s:
            users = int(
                await s.scalar(
                    select(func.count())
                    .select_from(User)
                    .where(User.email.like("%@astra.dev"))
                )
                or 0
            )
            incidents = int(
                await s.scalar(select(func.count()).select_from(Incident)) or 0
            )
            return users, incidents

    await mod.main()
    first = await counts()
    await mod.main()
    second = await counts()

    assert first[0] == second[0] == 26, "26 seeded accounts, no duplicates on re-run"
    assert second[1] >= 12, "12 incidents exist (>= lets other tests add more)"

    async with get_session_factory()() as s:
        cats = set((await s.scalars(select(Incident.category))).all())
        hidden_false = int(
            await s.scalar(
                select(func.count())
                .select_from(Incident)
                .where(
                    Incident.assessment_status == "DEFINITELY_FALSE",
                    Incident.visibility == "HIDDEN",
                )
            )
            or 0
        )
        restricted_visible = int(
            await s.scalar(
                select(func.count())
                .select_from(Incident)
                .where(
                    Incident.sensitivity == "RESTRICTED",
                    Incident.visibility == "HIDDEN",
                )
            )
            or 0
        )

    assert SEED_CATEGORIES <= cats, f"missing categories: {SEED_CATEGORIES - cats}"
    assert hidden_false >= 1, "the definitely-false incident must be HIDDEN"
    assert restricted_visible == 0, (
        "RESTRICTED keeps the visibility axis pure (public query filters "
        "sensitivity separately)"
    )


@pytest.mark.parametrize("role", ["CENTRAL_ADMIN", "VERIFICATION_OFFICER"])
async def test_seed_roles_can_login_with_shared_password(client, role):
    """The demo password works for every seeded role (this is what you type on stage)."""
    local = {
        "CENTRAL_ADMIN": "admin",
        "VERIFICATION_OFFICER": "officer",
    }[role]
    # ensure the account exists regardless of test order
    await mod_seed_once()
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": f"{local}@astra.dev", "password": "astra-demo-2026"},
    )
    assert r.status_code == 200
    assert r.json()["user"]["role"] == role


async def mod_seed_once() -> None:
    """Run the seed once per test session (idempotent, cheap after first run)."""
    global _SEED_DONE
    if _SEED_DONE:
        return
    path = pathlib.Path(__file__).resolve().parents[2] / "seed" / "seed.py"
    spec = importlib.util.spec_from_file_location("astra_seed_once", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    await mod.main()
    _SEED_DONE = True


_SEED_DONE = False
