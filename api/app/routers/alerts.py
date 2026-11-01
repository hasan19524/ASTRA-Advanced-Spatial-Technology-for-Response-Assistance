"""Alerts router — Phase 2: publish + subscribe + preferences + WS channel."""

from fastapi import APIRouter, Depends, Path, WebSocket, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models import User
from app.schemas.alert import (
    AlertCreateIn,
    AlertOut,
    AlertPrefIn,
    AlertPrefOut,
)
from app.services import alert_service as svc

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertOut]:
    alerts = await svc.list_alerts(db, user)
    return [AlertOut.model_validate(a) for a in alerts]


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreateIn,
    user: User = Depends(require_permission("alert.manage")),
    db: AsyncSession = Depends(get_db),
) -> AlertOut:
    alert = await svc.create_alert(db, user, payload)
    return AlertOut.model_validate(alert)


@router.get("/preferences", response_model=list[AlertPrefOut])
async def list_prefs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertPrefOut]:
    prefs = await svc.list_prefs(db, user)
    return [AlertPrefOut.model_validate(p) for p in prefs]


@router.post(
    "/preferences", response_model=AlertPrefOut, status_code=status.HTTP_201_CREATED
)
async def upsert_pref(
    payload: AlertPrefIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlertPrefOut:
    pref = await svc.upsert_pref(
        db, user, payload.region, payload.category, payload.enabled
    )
    return AlertPrefOut.model_validate(pref)


@router.delete("/preferences/{pref_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pref(
    pref_id: str = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await svc.delete_pref(db, user, pref_id)


# --- WS channel (mirrors /ws/map pattern) ---
ws_router = APIRouter()


@ws_router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket, db: AsyncSession = Depends(get_db)) -> None:
    from app.services.map_ws import authenticate_socket

    user = await authenticate_socket(db, websocket)
    if user is None:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    import asyncio
    import json
    from contextlib import suppress


    from app.core.database import get_redis

    pubsub = get_redis().pubsub()
    await pubsub.subscribe("alerts")

    async def forward():
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])

    forwarder = asyncio.create_task(forward())
    try:
        await websocket.send_text(
            json.dumps({"channel": "alerts", "type": "connected"})
        )
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        forwarder.cancel()
        with suppress(asyncio.CancelledError):
            await forwarder
        await pubsub.aclose()
