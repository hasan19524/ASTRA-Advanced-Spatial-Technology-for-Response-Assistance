"""Audit writer + HTTP middleware (AD-9, vision.md §4).

Every mutating request (POST/PUT/PATCH/DELETE) lands exactly once in `audit_logs`
— who (JWT claim when present, login email otherwise), what, when, from where,
and the outcome. Append-only: no code path ever updates or deletes these rows.

Design notes:
  * Pure-ASGI middleware with a recording `receive` — we can read the login body
    for `actor_label` WITHOUT stealing it from FastAPI (messages pass straight
    through; we just keep a copy).
  * The audit write happens after the response is sent and can never break a
    request: best-effort, exceptions swallowed (availability > completeness here).
"""

import json
import uuid
from typing import Any, Awaitable, Callable, Iterable, MutableMapping

from app.core.database import get_session_factory
from app.core.security import decode_access_token
from app.models import AuditLog

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]

MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# never audited even when mutating (framework noise)
SKIP_PREFIXES = ("/health", "/docs", "/redoc", "/openapi.json")

# path suffix -> stable action name (nice to filter/group in the audit view)
_ACTIONS = (
    ("/auth/login", "auth.login"),
    ("/auth/register", "auth.register"),
    ("/auth/refresh", "auth.refresh"),
    ("/auth/logout", "auth.logout"),
)


def _headers(scope: Scope) -> dict[str, str]:
    return {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in scope.get("headers", [])
    }


def _actor(scope: Scope) -> tuple[str | None, str | None]:
    """(user_id, role) from a valid access token — None if absent/invalid."""
    auth = _headers(scope).get("authorization", "")
    if not auth.startswith("Bearer "):
        return None, None
    try:
        claims = decode_access_token(auth.removeprefix("Bearer "))
        return claims.get("sub"), claims.get("role")
    except (
        Exception
    ):  # expired / refresh-as-access / garbage — still audited, just anonymous
        return None, None


def _action_for(method: str, path: str) -> str:
    for suffix, name in _ACTIONS:
        if path.endswith(suffix):
            return name
    return f"{method} {path}"


def _resource_id(path: str) -> str | None:
    """UUID-shaped final segment = the object the request touched."""
    last = path.rstrip("/").rsplit("/", 1)[-1]
    return last if len(last) == 36 and last.count("-") == 4 else None


def _label_for(path: str, raw_body: bytes) -> str | None:
    """Email on login/register — the actor before any token exists."""
    if not path.endswith(("/auth/login", "/auth/register")):
        return None
    try:
        data = json.loads(raw_body.decode("utf-8") or "{}")
        email = data.get("email")
        return str(email) if email else None
    except Exception:
        return None


async def record_request(
    scope: Scope,
    method: str,
    path: str,
    status_code: int,
    raw_body: bytes,
) -> None:
    actor_id, actor_role = _actor(scope)
    hdrs = _headers(scope)
    client = scope.get("client") or (None, None)
    row = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        actor_label=_label_for(path, raw_body),
        action=_action_for(method, path),
        method=method,
        path=path,
        resource_id=_resource_id(path),
        status_code=status_code,
        request_id=hdrs.get("x-request-id") or str(uuid.uuid4()),
        ip=client[0],
    )
    async with get_session_factory()() as session:
        session.add(row)
        await session.commit()


class AuditMiddleware:
    """ASGI middleware: wrap every mutating request, write one audit row."""

    def __init__(self, app: Callable) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        method = scope.get("method", "")
        path = scope.get("path", "")
        if (
            scope.get("type") != "http"
            or method not in MUTATING_METHODS
            or path.startswith(SKIP_PREFIXES)
        ):
            await self.app(scope, receive, send)
            return

        body = bytearray()

        async def recording_receive() -> Message:
            message = await receive()
            if message.get("type") == "http.request":
                body.extend(message.get("body") or b"")
            return message

        status_code = 500

        async def capturing_send(message: Message) -> None:
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = int(message.get("status", 500))
            await send(message)

        # NOTE: pass the *functions*, never `recording_receive()` — downstream
        # calls receive() itself; handing it a coroutine raises "not callable".
        await self.app(scope, recording_receive, capturing_send)

        try:
            await record_request(scope, method, path, status_code, bytes(body))
        except Exception:
            pass  # auditing must never break the request it observes


def iter_audit_writers() -> Iterable[Callable]:  # pragma: no cover - documentation aid
    """The only two writers of `audit_logs`: this middleware and explicit calls
    to `record_request`. Nothing else may touch the table."""
    return (record_request,)
