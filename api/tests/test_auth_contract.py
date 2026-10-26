"""Auth contract tests (AD-12: ruff + pytest gate).

Mirrors scripts/verify-auth.ps1 so the same guarantees run in CI:
register/login/refresh/me, no user enumeration, token-type separation,
and backend-enforced RBAC permission sets (vision.md §4).
"""

import uuid

PW = "Str0ngPass!23"


def _email(tag: str = "cit") -> str:
    return f"{tag}+{uuid.uuid4().hex[:12]}@example.com"


async def _register(
    client, email: str | None = None, payload_extra: dict | None = None
):
    body = {"email": email or _email(), "full_name": "Test Citizen", "password": PW}
    if payload_extra:
        body.update(payload_extra)
    return await client.post("/api/v1/auth/register", json=body)


async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_register_returns_201_with_tokens_and_citizen_role(client):
    r = await _register(client)
    assert r.status_code == 201
    data = r.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"] and data["refresh_token"]
    assert data["user"]["role"] == "CITIZEN"
    assert "report.create" in data["user"]["permissions"]


async def test_register_duplicate_email_409(client):
    email = _email()
    assert (await _register(client, email)).status_code == 201
    again = await _register(client, email)
    assert again.status_code == 409
    assert again.json()["detail"] == "Email already registered"


async def test_register_cannot_self_assign_staff_role(client):
    """AD-7 / vision.md §3: staff roles are seeded, never self-selected."""
    r = await _register(client, payload_extra={"role": "CENTRAL_ADMIN"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "CITIZEN"


async def test_register_short_password_422(client):
    r = await _register(client, payload_extra={"password": "short"})
    assert r.status_code == 422


async def test_login_then_me(client):
    email = _email()
    await _register(client, email)
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    assert r.status_code == 200
    tokens = r.json()

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == email
    assert profile["role"] == "CITIZEN"
    # RBAC: citizen can report, must NOT be able to close incidents
    assert "report.create" in profile["permissions"]
    assert "incident.close" not in profile["permissions"]


async def test_login_wrong_password_401(client):
    email = _email()
    await _register(client, email)
    r = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Wr0ngPass!23"}
    )
    assert r.status_code == 401


async def test_login_unknown_email_gives_same_error_as_wrong_password(client):
    """No user enumeration: identical detail for unknown email vs bad password."""
    email = _email()
    await _register(client, email)
    wrong_pw = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Wr0ngPass!23"}
    )
    unknown = await client.post(
        "/api/v1/auth/login",
        json={"email": _email("nobody"), "password": PW},
    )
    assert wrong_pw.status_code == unknown.status_code == 401
    assert (
        wrong_pw.json()["detail"] == unknown.json()["detail"] == "Invalid credentials"
    )


async def test_me_without_token_401(client):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


async def test_refresh_token_rejected_as_access_token(client):
    r = await _register(client)
    refresh = r.json()["refresh_token"]
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"}
    )
    assert me.status_code == 401
    assert me.json()["detail"] == "Not an access token"


async def test_tampered_token_401(client):
    r = await _register(client)
    token = r.json()["access_token"]
    tampered = token[:-2] + "xx"
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered}"}
    )
    assert me.status_code == 401
    assert me.json()["detail"] == "Invalid token"


async def test_refresh_issues_working_pair(client):
    r = await _register(client)
    refresh = r.json()["refresh_token"]
    fresh = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert fresh.status_code == 200
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {fresh.json()['access_token']}"},
    )
    assert me.status_code == 200


async def test_refresh_with_garbage_401(client):
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-jwt"})
    assert r.status_code == 401


async def test_logout_204(client):
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 204
