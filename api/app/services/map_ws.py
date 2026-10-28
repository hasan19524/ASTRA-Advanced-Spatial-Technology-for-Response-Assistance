"""Map channel service — Redis pub/sub fan-out for `/ws/map` (AD-10, AD-16).

Topic `incidents:map` carries one envelope shape, frozen in both Day 3 task
files:

    {"channel": "incidents:map", "type": "connected"}
    {"channel": "incidents:map", "type": "incident.created", "data": <IncidentOut>}

Publish rule (decision, Day 3): an incident goes out only while
`visibility=PUBLIC_UNVERIFIED AND sensitivity=PUBLIC` — the map is a live
public feed of unverified reports, not an archive of everything.
"""

import asyncio
import json
import logging
from contextlib import suppress

from fastapi import WebSocket, WebSocketDisconnect
from redis import asyncio as redis_asyncio
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_redis
from app.core.security import decode_access_token
from app.models import Incident, User
from app.schemas.incident import IncidentOut

logger = logging.getLogger(__name__)

CHANNEL = "incidents:map"
WS_PATH = "/ws/map"
WS_UNAUTHORIZED = 4401  # AD-10: custom close code, visible to the browser


def pool() -> redis_asyncio.Redis:
    """Shared lru_cached client from core.database — one per event loop; the
    test harness clears it between tests so no client outlives its loop."""
    return get_redis()


async def subscribe() -> redis_asyncio.client.PubSub:
    pubsub = pool().pubsub()
    await pubsub.subscribe(CHANNEL)
    return pubsub


async def publish_incident_created(incident: Incident) -> None:
    """Publish one `incident.created` envelope — never raises: a Redis hiccup
    must not fail the citizen's submission (WS is a live enhancement)."""
    out = IncidentOut.model_validate(incident)
    if out.visibility != "PUBLIC_UNVERIFIED" or out.sensitivity != "PUBLIC":
        return
    envelope = {
        "channel": CHANNEL,
        "type": "incident.created",
        "data": out.model_dump(mode="json"),
    }
    try:
        await pool().publish(CHANNEL, json.dumps(envelope))
    except (RedisError, OSError) as exc:
        logger.warning("map WS publish skipped: %s", exc)


async def authenticate_socket(db: AsyncSession, websocket: WebSocket) -> User | None:
    """AD-10: the JWT rides on the handshake query string (browsers can't set
    WebSocket headers), verified *before* accept. None = close 4401."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        claims = decode_access_token(token)
    except Exception:  # expired / garbage — indistinguishable on purpose
        return None
    user = await db.get(User, claims.get("sub", ""))
    return user if user is not None and user.is_active else None


async def serve_map_channel(websocket: WebSocket, pubsub) -> None:
    """Forward every `incidents:map` message to this one client until it
    disconnects. Waiting in `receive_text` is what *detects* the close —
    a browser that never sends anything still disconnects cleanly."""
    sent_connected = False

    async def forward() -> None:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])

    forwarder = asyncio.create_task(forward())
    try:
        await websocket.send_text(json.dumps({"channel": CHANNEL, "type": "connected"}))
        sent_connected = True
        while True:
            await websocket.receive_text()  # client traffic ignored; close raises
    except WebSocketDisconnect:
        pass
    finally:
        forwarder.cancel()
        with suppress(asyncio.CancelledError):
            await forwarder
        if not sent_connected:  # pragma: no cover - defensive
            logger.debug("map WS closed before the connected envelope")
