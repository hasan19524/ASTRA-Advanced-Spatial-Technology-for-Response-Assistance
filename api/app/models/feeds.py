"""Cache for external feeds (Open-Meteo weather, ReliefWeb events, ...).

Real feeds are fetched server-side and parked here so the demo is repeatable —
never a blocked call mid-pitch (see docs/research-existing-apps.md §9).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ExternalFeedCache(Base):
    __tablename__ = "external_feeds_cache"
    __table_args__ = (UniqueConstraint("feed", "key", name="uq_feed_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    feed: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # open_meteo | reliefweb
    key: Mapped[str] = mapped_column(
        String(128), nullable=False
    )  # e.g. "ncr:28.6,77.2"
    payload: Mapped[str] = mapped_column(Text, nullable=False)  # JSON as received
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
