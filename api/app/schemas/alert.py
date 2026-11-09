"""Alert schemas (CAP-shaped, adapted to the existing Alert model)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.core.constants import BROADCAST_AREA, NCR_REGION_SET


def _validate_areas(value: str | None, *, allow_none: bool) -> str | None:
    """Validate a CAP-style area string: '*' (broadcast) or NCR region names.

    Without this, `area="Mars"` or a typo like "central delhi" creates an
    alert that is silently invisible to every user -- the row exists, the
    geo-target filter drops it, and nobody notices. A 422 at write time is
    the honest failure.
    """
    if value is None:
        if allow_none:
            return None
        raise ValueError("area is required")
    parts = [x.strip() for x in value.split(",") if x.strip()]
    if not parts:
        raise ValueError("area must not be empty")
    for part in parts:
        if part == BROADCAST_AREA:
            continue
        if part not in NCR_REGION_SET:
            raise ValueError(
                f"unknown area '{part}'. Use '*' for a broadcast alert or one of: "
                + ", ".join(sorted(NCR_REGION_SET))
            )
    return ",".join(parts)


class AlertCreateIn(BaseModel):
    event: str
    title: str
    body: str
    severity: str = "MODERATE"
    urgency: str = "EXPECTED"
    certainty: str = "LIKELY"
    area: str = "*"
    expires_at: datetime | None = None

    @field_validator("area")
    @classmethod
    def _check_area(cls, v: str) -> str:
        return _validate_areas(v, allow_none=False) or BROADCAST_AREA


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
    expired_at: datetime | None = None
    created_at: datetime


class AlertPrefIn(BaseModel):
    region: str | None = None
    category: str | None = None
    enabled: bool = True

    @field_validator("region")
    @classmethod
    def _check_region(cls, v: str | None) -> str | None:
        return _validate_areas(v, allow_none=True)


class AlertPrefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    region: str | None = None
    category: str | None = None
    enabled: bool
    created_at: datetime
