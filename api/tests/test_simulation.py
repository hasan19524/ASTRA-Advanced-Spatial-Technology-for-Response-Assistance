"""Simulation authorization tests — P0 fix C4.

Non-admins must only read PUBLIC simulation runs; OPERATIONAL runs are
Central Admin only. User B must not read User A's runs.
"""

import uuid

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import SimRun, User

PW = "Str0ngPass!23"


async def _make_user(email: str, role: str) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=email,
            full_name="Sim User",
            password_hash=hash_password(PW),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _login(client, email: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _seed_run(db_tag: str, mode: str = "PUBLIC") -> str:
    async with get_session_factory()() as s:
        run = SimRun(
            id=f"sim-{db_tag}",
            mode=mode,
            scenario="fire",
            params='{"radius_km": 5}',
            status="DONE",
            summary={"note": "test"},
            created_by="admin-id",
            created_at=__import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ),
        )
        s.add(run)
        await s.commit()
        return run.id


async def test_citizen_cannot_read_operational_run(client):
    """A citizen who guesses an OPERATIONAL run id gets 404, not 200."""
    admin = await _make_user(
        f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN"
    )
    citizen = await _make_user(
        f"citizen+{uuid.uuid4().hex[:8]}@test.example", "CITIZEN"
    )
    admin_token = await _login(client, admin.email)

    run_id = await _seed_run("op", mode="OPERATIONAL")

    r = await client.get(
        f"/api/v1/simulations/{run_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.text

    citizen_token = await _login(client, citizen.email)
    r = await client.get(
        f"/api/v1/simulations/{run_id}",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


async def test_citizen_can_read_public_run(client):
    """A citizen can read a PUBLIC simulation run."""
    citizen = await _make_user(
        f"citizen2+{uuid.uuid4().hex[:8]}@test.example", "CITIZEN"
    )
    citizen_token = await _login(client, citizen.email)

    run_id = await _seed_run("pub", mode="PUBLIC")

    r = await client.get(
        f"/api/v1/simulations/{run_id}",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["mode"] == "PUBLIC"


async def test_nonexistent_run_is_404(client):
    admin = await _make_user(
        f"admin3+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN"
    )
    admin_token = await _login(client, admin.email)

    r = await client.get(
        f"/api/v1/simulations/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404
