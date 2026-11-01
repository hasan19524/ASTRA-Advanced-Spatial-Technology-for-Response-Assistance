"""Assistant service — Phase 4 (chat storage + LLM)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AssistConversation, AssistMessage
from app.services.assessment_backend import build_multi_llm_backend


async def create_conversation(
    db: AsyncSession, user_id: str, language: str = "en-IN", title: str | None = None
) -> AssistConversation:
    conv = AssistConversation(user_id=user_id, language=language, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def list_conversations(
    db: AsyncSession, user_id: str
) -> list[AssistConversation]:
    from sqlalchemy import select

    rows = (
        await db.scalars(
            select(AssistConversation)
            .where(AssistConversation.user_id == user_id)
            .order_by(AssistConversation.created_at.desc())
        )
    ).all()
    return list(rows)


async def get_messages(db: AsyncSession, conversation_id: str) -> list[AssistMessage]:
    from sqlalchemy import select

    rows = (
        await db.scalars(
            select(AssistMessage)
            .where(AssistMessage.conversation_id == conversation_id)
            .order_by(AssistMessage.created_at.asc())
        )
    ).all()
    return list(rows)


async def chat(
    db: AsyncSession, conversation_id: str, user_text: str, language: str = "en-IN"
) -> str:
    # store user msg
    db.add(
        AssistMessage(conversation_id=conversation_id, role="user", content=user_text)
    )
    await db.flush()
    # build reply via multi-provider LLM
    backend = build_multi_llm_backend()
    reply = "I'm unable to respond right now."
    if backend is not None:
        try:
            # reuse the LlmBackend chat style
            provider = backend.providers[0]
            import httpx

            async with httpx.AsyncClient(timeout=provider.timeout_seconds) as client:
                resp = await client.post(
                    f"{provider.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {provider.api_key}"},
                    json={
                        "model": provider.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": f"You are ASTRA's assistant. Reply in {language}.",
                            },
                            {"role": "user", "content": user_text},
                        ],
                        "temperature": 0.3,
                    },
                )
                resp.raise_for_status()
                reply = resp.json()["choices"][0]["message"]["content"]
        except Exception:
            reply = "Service temporarily unavailable. Please try again."
    db.add(
        AssistMessage(conversation_id=conversation_id, role="assistant", content=reply)
    )
    await db.commit()
    return reply
