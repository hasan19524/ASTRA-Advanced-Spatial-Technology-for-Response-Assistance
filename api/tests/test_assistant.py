"""Assistant contract — Phase 6 (PL-17 provider chain).

The assistant must:

  * report WHICH engine produced the reply, so the UI never presents a
    deterministic string as if a language model had written it;
  * degrade to the rules stub instead of failing when no provider is
    reachable.

No network calls happen here: the provider chain is patched out.
"""

import uuid

from app.core.database import get_session_factory
from app.core.security import hash_password
from app.models import User

PW = "Str0ngPass!23"


async def _user() -> User:
    async with get_session_factory()() as s:
        u = User(
            email=f"citizen+{uuid.uuid4().hex[:8]}@test.example",
            full_name="Chat User",
            password_hash=hash_password(PW),
            role="CITIZEN",
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u


async def _login(client, user: User) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": PW},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def test_chat_reports_the_provider(client, monkeypatch):
    """A working provider is named in the response."""
    from app.services import assistant_service as svc

    class _Backend:
        async def chat(self, *, text, language, system=None):
            assert "ASTRA" in (system or "")
            return "A routed answer.", "llm:test-model"

    monkeypatch.setattr(svc, "build_multi_llm_backend", lambda: _Backend())

    user = await _user()
    token = await _login(client, user)
    conv = await client.post(
        "/api/v1/assistant/conversations",
        json={"title": None, "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert conv.status_code == 201, conv.text
    conv_id = conv.json()["id"]

    r = await client.post(
        f"/api/v1/assistant/conversations/{conv_id}/chat",
        json={"text": "How do I close an incident?", "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"] == "A routed answer."
    assert body["provider"] == "llm:test-model"


async def test_chat_degrades_to_the_rules_stub(client, monkeypatch):
    """With no reachable provider the answer is honest about it."""
    from app.services import assistant_service as svc

    class _Broken:
        async def chat(self, *, text, language, system=None):
            raise RuntimeError("all providers down")

    monkeypatch.setattr(svc, "build_multi_llm_backend", lambda: _Broken())

    user = await _user()
    token = await _login(client, user)
    conv = await client.post(
        "/api/v1/assistant/conversations",
        json={"title": None, "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    conv_id = conv.json()["id"]

    r = await client.post(
        f"/api/v1/assistant/conversations/{conv_id}/chat",
        json={"text": "route me to a hospital", "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "rules_stub"
    # The reply must SAY it came from the deterministic stub.
    assert "rules stub" in body["reply"].lower()


async def test_chat_without_any_provider_configured(client, monkeypatch):
    """No provider configured at all -> rules stub, still 200."""
    from app.services import assistant_service as svc

    monkeypatch.setattr(svc, "build_multi_llm_backend", lambda: None)

    user = await _user()
    token = await _login(client, user)
    conv = await client.post(
        "/api/v1/assistant/conversations",
        json={"title": None, "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    conv_id = conv.json()["id"]

    r = await client.post(
        f"/api/v1/assistant/conversations/{conv_id}/chat",
        json={"text": "hello", "language": "en-IN"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["provider"] == "rules_stub"
