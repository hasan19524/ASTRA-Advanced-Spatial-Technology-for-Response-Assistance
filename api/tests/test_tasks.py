"""Response tasks — the role-scoped task list (GET /api/v1/tasks).

Scope rules (mirrors the single-task read):
  * CENTRAL_ADMIN   → every task
  * DEPARTMENT_HEAD → tasks of their own department
  * RESPONSE_TEAM   → only tasks they are assigned to
"""

import uuid

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import Incident, ResponseTask, User

PW = "Str0ngPass!23"


async def _user(email: str, role: str, department: str | None = None) -> User:
    async with get_session_factory()() as s:
        u = User(
            email=email,
            full_name=f"User {role}",
            password_hash=hash_password(PW),
            role=role,
            department=department,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _incident(title: str) -> str:
    async with get_session_factory()() as s:
        inc = Incident(
            title=title,
            description="task scope fixture",
            category="Fire",
            region="Central Delhi",
            latitude=28.61,
            longitude=77.21,
            sensitivity="PUBLIC",
            assessment_status="MAYBE_TRUE",
            visibility="PUBLIC",
            verification="UNVERIFIED",
            response_phase="NONE",
            lifecycle="OPEN",
        )
        s.add(inc)
        await s.commit()
        await s.refresh(inc)
        return inc.id


async def _task(incident_id: str, title: str, department: str) -> str:
    async with get_session_factory()() as s:
        t = ResponseTask(
            incident_id=incident_id,
            title=title,
            description="scope fixture",
            department=department,
            status="OPEN",
        )
        s.add(t)
        await s.commit()
        await s.refresh(t)
        return t.id


async def _assign(task_id: str, user_id: str) -> None:
    from app.models import Assignment

    async with get_session_factory()() as s:
        s.add(Assignment(task_id=task_id, assignee_id=user_id, assigned_by=user_id))
        await s.commit()


async def _login(client, email: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200, r.text
    return r.json()


async def test_admin_sees_every_task(client):
    admin = await _user(f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN")
    incident = await _incident("scope admin")
    await _task(incident, "Fire dept task", "Fire & Rescue")
    await _task(incident, "Police dept task", "Police")

    tokens = await _login(client, admin.email)
    r = await client.get(
        "/api/v1/tasks", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 200, r.text
    assert len(r.json()) == 2


async def test_department_head_sees_only_own_department(client):
    head = await _user(
        f"head+{uuid.uuid4().hex[:8]}@test.example", "DEPARTMENT_HEAD", "Fire & Rescue"
    )
    incident = await _incident("scope head")
    await _task(incident, "Fire dept task", "Fire & Rescue")
    await _task(incident, "Police dept task", "Police")

    tokens = await _login(client, head.email)
    r = await client.get(
        "/api/v1/tasks", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    assert body[0]["department"] == "Fire & Rescue"


async def test_response_team_sees_only_assigned_tasks(client):
    member = await _user(
        f"team+{uuid.uuid4().hex[:8]}@test.example", "RESPONSE_TEAM", "Fire & Rescue"
    )
    incident = await _incident("scope team")
    mine = await _task(incident, "Assigned to me", "Fire & Rescue")
    await _task(incident, "Not assigned", "Fire & Rescue")
    await _assign(mine, member.id)

    tokens = await _login(client, member.email)
    r = await client.get(
        "/api/v1/tasks", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    assert body[0]["title"] == "Assigned to me"


async def test_citizen_cannot_list_tasks(client):
    citizen = await _user(f"civ+{uuid.uuid4().hex[:8]}@test.example", "CITIZEN")
    tokens = await _login(client, citizen.email)
    r = await client.get(
        "/api/v1/tasks", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 403, r.text


async def test_status_filter_is_applied(client):
    admin = await _user(f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN")
    incident = await _incident("scope filter")
    task_id = await _task(incident, "Open task", "Fire & Rescue")

    async with get_session_factory()() as s:
        t = await s.get(ResponseTask, task_id)
        t.status = "IN_PROGRESS"
        await s.commit()

    tokens = await _login(client, admin.email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await client.get("/api/v1/tasks?status=IN_PROGRESS", headers=auth)
    assert r.status_code == 200, r.text
    assert [t["status"] for t in r.json()] == ["IN_PROGRESS"]
    r = await client.get("/api/v1/tasks?status=DONE", headers=auth)
    assert r.json() == []


async def test_invalid_status_filter_is_rejected(client):
    admin = await _user(f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN")
    tokens = await _login(client, admin.email)
    r = await client.get(
        "/api/v1/tasks?status=NOT_A_STATUS",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code == 422, r.text


async def test_unknown_department_is_refused(client):
    """AD-14: the 7 departments are a closed list. A typo would otherwise
    silently create a SECOND department ("Fire" vs "Fire & Rescue")."""
    admin = await _user(f"admin+{uuid.uuid4().hex[:8]}@test.example", "CENTRAL_ADMIN")
    incident = await _incident("scope department validation")
    tokens = await _login(client, admin.email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}

    r = await client.post(
        f"/api/v1/incidents/{incident}/tasks",
        json={"title": "Typo department", "department": "Fire"},
        headers=auth,
    )
    assert r.status_code == 422, r.text
    assert "Fire & Rescue" in r.json()["detail"]

    r = await client.post(
        f"/api/v1/incidents/{incident}/tasks",
        json={"title": "Valid department", "department": "Fire & Rescue"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["department"] == "Fire & Rescue"
