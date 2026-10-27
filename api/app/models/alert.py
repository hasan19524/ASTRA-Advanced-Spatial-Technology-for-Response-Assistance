"""Alerts shaped like CAP (docs/research-existing-apps.md §3): event, severity,
urgency, certainty, area — the field set behind IPAWS / India's NDMA SACHET."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event: Mapped[str] = mapped_column(String(64), nullable=False)  # CAP event type
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="MODERATE"
    )
    urgency: Mapped[str] = mapped_column(String(16), nullable=False, default="EXPECTED")
    certainty: Mapped[str] = mapped_column(String(16), nullable=False, default="LIKELY")
    # comma-separated NCR regions / "*" for all (geo-targeting à la CAP <area>)
    area: Mapped[str] = mapped_column(String(255), nullable=False, default="*")
    published_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class UserAlertPref(Base):
    """Per-user alert subscriptions (region / category)."""

    __tablename__ = "user_alert_prefs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)  # None = all
    category: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )  # None = all
    enabled: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
