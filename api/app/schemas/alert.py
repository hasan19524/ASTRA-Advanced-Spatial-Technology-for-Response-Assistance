"""Alert schemas (CAP-shaped, adapted to the existing Alert model)."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AlertCreateIn(BaseModel):
    event: str
    title: str
    body: str
    severity: str = "MODERATE"
    urgency: str = "EXPECTED"
    certainty: str = "LIKELY"
    area: str = "*"
    expires_at: datetime | None = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event: str
    title: str
    body: str
    severity: str
    urgency: str
    certainty: str
    area: str
    published_by: str | None = None
    expires_at: datetime | None = None
    created_at: datetime


class AlertPrefIn(BaseModel):
    region: str | None = None
    category: str | None = None
    enabled: bool = True


class AlertPrefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    region: str | None = None
    category: str | None = None
    enabled: bool
    created_at: datetime
