"""`/ws/map` — the live map channel (AD-10 auth, AD-16 fan-out).

Mounted WITHOUT the `/api/v1` prefix (frozen contract): browsers can't set
headers on a WebSocket handshake, so the JWT rides on the query string.
"""

from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.services import map_ws

router = APIRouter()


@router.websocket(map_ws.WS_PATH)
async def ws_map(websocket: WebSocket, db: AsyncSession = Depends(get_db)) -> None:
    user = await map_ws.authenticate_socket(db, websocket)
    if user is None:
        # AD-10: never accept an unauthenticated socket — close before it opens
        await websocket.close(code=map_ws.WS_UNAUTHORIZED)
        return
    await websocket.accept()
    pubsub = await map_ws.subscribe()
    try:
        await map_ws.serve_map_channel(websocket, pubsub)
    finally:
        await pubsub.aclose()
