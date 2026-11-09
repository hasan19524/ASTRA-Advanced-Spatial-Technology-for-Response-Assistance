"""Security: unauthorized access to weather/geocode endpoints (P1)."""

import uuid

PW = "Str0ngPass!23"


async def _register(client, tag="cit"):
    email = f"{tag}+{uuid.uuid4().hex[:12]}@example.com"
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Test Citizen", "password": PW},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_weather_current_requires_auth(client):
    r = await client.get("/api/v1/weather/current")
    assert r.status_code == 401


async def test_weather_delhi_requires_auth(client):
    r = await client.get("/api/v1/weather/delhi")
    assert r.status_code == 401


async def test_geocode_search_requires_auth(client):
    r = await client.get("/api/v1/geocode/search", params={"q": "Delhi"})
    assert r.status_code == 401


async def test_weather_current_rejects_bad_token(client):
    r = await client.get(
        "/api/v1/weather/current",
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert r.status_code == 401


async def test_geocode_search_rejects_bad_token(client):
    r = await client.get(
        "/api/v1/geocode/search",
        params={"q": "Delhi"},
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert r.status_code == 401


async def test_weather_current_ok_with_auth(client):
    tokens = await _register(client)
    r = await client.get(
        "/api/v1/weather/current",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    # weather may fail upstream (502) but must not be 401
    assert r.status_code != 401


async def test_geocode_search_ok_with_auth(client):
    tokens = await _register(client)
    r = await client.get(
        "/api/v1/geocode/search",
        params={"q": "Delhi"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code != 401
