"""Assistant service — Phase 4 (chat storage + LLM)."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException
from sqlalchemy import select

from app.models import AssistConversation, AssistMessage
from app.services.assessment_backend import build_multi_llm_backend

logger = logging.getLogger(__name__)

# The assistant's operating manual. Without this the model answers from
# generic ITSM knowledge ("change the status to Resolved, notify
# stakeholders") instead of ASTRA's actual rules. The rules below are the
# ones the backend enforces — architecture.md AD-7, AD-8, AD-9, AD-14.
_SYSTEM_PROMPT = """You are ASTRA's operational assistant for Delhi NCR emergency \
response. Answer using ASTRA's actual rules, never generic IT-service-management \
advice.

ASTRA's incident lifecycle:
- A citizen submits a report. It is assessed automatically (MAYBE_TRUE or \
DEFINITELY_FALSE) and, until an officer verifies it, is shown publicly as \
PUBLIC_UNVERIFIED. Only a Verification Officer can set VERIFIED or REJECTED.
- Citizen polls are separate from verification. A poll records how many \
distinct voters agree; it never changes the verification status.
- A Central Admin coordinates the response. The response phase moves strictly \
NONE -> COORDINATING -> ACTIVE -> RESOLVED, and may never go backwards.
- Only the Central Admin may close an incident, and only when every response \
task on it is DONE. Task status moves OPEN -> IN_PROGRESS -> DONE, or straight \
OPEN -> DONE. Moving a task backwards is refused.
- The seven response departments are: Police, Fire & Rescue, Medical/EMS, \
Transport & Roads, Disaster Management, Electricity/Utilities, Water & Drainage.

What each role can do:
- Central Admin: full control, closes incidents, creates and assigns tasks.
- Department Head: sees and manages tasks for their own department.
- Response Team: sees only tasks assigned to them.
- Verification Officer: owns the verification queue.
- Citizen: reports incidents, votes on polls, reads public alerts.

Routing: ASTRA routes over a real OpenStreetMap road graph of Delhi NCR \
(406,154 nodes, 879,902 directed edges) using Dijkstra on travel time. \
98.8% of the nodes are connected; isolated OSM fragments have no route. \
The Live Map geocodes places with Nominatim and draws the computed route.

The simulation centre runs a documented heuristic model (PL-14), not a \
forecast: it turns scenario, category, radius and intensity into an affected \
area, an affected-population estimate, a key-infrastructure count and a \
damage estimate, and it never touches a live incident.

Be concise and operational. Give the concrete next step. If you do not know \
something, say so plainly instead of inventing a detail."""


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


async def get_messages(
    db: AsyncSession, conversation_id: str, user_id: str
) -> list[AssistMessage]:
    """Return messages for a conversation, but only if it belongs to `user_id`."""
    from sqlalchemy import select

    # Verify conversation ownership first — existence stays secret (404,
    # not an empty list that leaks that the conversation exists).
    conv = await db.scalar(
        select(AssistConversation).where(
            AssistConversation.id == conversation_id,
            AssistConversation.user_id == user_id,
        )
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    rows = (
        await db.scalars(
            select(AssistMessage)
            .where(AssistMessage.conversation_id == conversation_id)
            .order_by(AssistMessage.created_at.asc())
        )
    ).all()
    return list(rows)


async def chat(
    db: AsyncSession,
    conversation_id: str,
    user_id: str,
    user_text: str,
    language: str = "en-IN",
) -> tuple[str, str]:
    """Answer a chat message. Returns `(reply, provider_label)`.

    The conversation must belong to `user_id`; otherwise 404 (existence stays
    secret, same pattern as incident reads).
    """
    # Verify conversation ownership before touching any data.
    conv = await db.scalar(
        select(AssistConversation).where(
            AssistConversation.id == conversation_id,
            AssistConversation.user_id == user_id,
        )
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # store user msg
    db.add(
        AssistMessage(conversation_id=conversation_id, role="user", content=user_text)
    )
    await db.flush()

    reply = ""
    provider = "rules_stub"
    backend = build_multi_llm_backend()
    if backend is not None:
        try:
            reply, provider = await backend.chat(
                text=user_text, language=language, system=_SYSTEM_PROMPT
            )
        except Exception:
            logger.warning("all LLM providers failed; degrading to rules_stub")
            reply = ""

    if not reply:
        reply = _rules_reply(user_text, language)
        provider = "rules_stub"

    db.add(
        AssistMessage(conversation_id=conversation_id, role="assistant", content=reply)
    )
    await db.commit()
    return reply, provider


# Deterministic fallback answers. Deliberately NOT pretending to be an LLM:
# they route the question to the right part of the platform and say what
# the user should do next.
_RULES_HINTS = (
    ("route", "navigation", "distance"),
    ("nearest", "hospital", "police station", "fire station"),
    ("task", "assign", "dispatch", "team"),
    ("poll", "vote", "agree", "confirm"),
    ("weather", "rain", "flood", "temperature"),
    ("report", "incident", "emergency"),
)


def _rules_reply(user_text: str, language: str = "en-IN") -> str:
    """A deterministic, honest answer when no LLM provider is reachable."""
    lowered = user_text.lower()
    hit = next(
        (h for group in _RULES_HINTS for h in group if h in lowered),
        None,
    )
    if hit:
        return (
            "No language-model provider is reachable right now, so this answer "
            "comes from the rules stub — a deterministic fallback, not a "
            "model. Your question looks like a "
            f"{hit} question — open the Live Map to see incidents and compute "
            "a route, or the Task Board for dispatch. Reopen the assistant "
            "later for a full answer."
        )
    return (
        "No language-model provider is reachable right now — this answer "
        "comes from the rules stub, a deterministic fallback, not a model. "
        "You can still use the Live Map for incidents and routing, the "
        "Incident list to report or track events, and the Alerts centre for "
        "advisories."
    )
