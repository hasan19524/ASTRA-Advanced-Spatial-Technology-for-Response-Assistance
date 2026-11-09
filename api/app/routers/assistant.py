"""Assistant router — Phase 4."""

from fastapi import APIRouter, Depends, Path, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models import User
from app.services import assistant_service as svc

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ConvIn(BaseModel):
    title: str | None = None
    language: str = "en-IN"


class MsgIn(BaseModel):
    text: str
    language: str = "en-IN"


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conv(
    payload: ConvIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await svc.create_conversation(db, user.id, payload.language, payload.title)
    return {
        "id": c.id,
        "language": c.language,
        "title": c.title,
        "created_at": c.created_at.isoformat(),
    }


@router.get("/conversations")
async def list_convs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cs = await svc.list_conversations(db, user.id)
    return [
        {
            "id": c.id,
            "language": c.language,
            "title": c.title,
            "created_at": c.created_at.isoformat(),
        }
        for c in cs
    ]


@router.get("/conversations/{conv_id}/messages")
async def messages(
    conv_id: str = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msgs = await svc.get_messages(db, conv_id, user.id)
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


@router.post("/conversations/{conv_id}/chat")
async def chat(
    conv_id: str = Path(...),
    payload: MsgIn = ...,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reply, provider = await svc.chat(
        db, conv_id, user.id, payload.text, payload.language
    )
    # The provider label is part of the contract: the UI must be able to
    # say WHICH engine answered (and when it was the rules stub).
    return {"reply": reply, "provider": provider}
