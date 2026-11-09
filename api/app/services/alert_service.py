"""Alerts service — Phase 2 (CAP-shaped, adapted to the Alert model)."""

from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BROADCAST_AREA, DEPARTMENT_REGIONS, NCR_REGION_TUPLE
from app.models import Alert, User, UserAlertPref
from app.schemas.alert import AlertCreateIn


def _split_area(area: str) -> list[str]:
    """Split a CAP-style area string into individual regions."""
    return [x.strip() for x in area.split(",") if x.strip()]


async def _user_regions(db: AsyncSession, user: User) -> list[str] | None:
    """Return the NCR regions a user may see, or None for broadcast-only.

    Precedence:
      1. CENTRAL_ADMIN is central command: they publish the alerts, so they
         must be able to see every one of them. Without this an admin
         publishes a "Central Delhi" alert and it is invisible in their own
         list -- the worst possible failure mode for the operator.
      2. A department head / response team member is a city-wide responder
         (AD-14), so their department maps to every NCR region.
      3. Explicit alert preferences are the citizen's only opt-in. A disabled
         preference is ignored.
      4. Nobody -> broadcasts only ("*").

    The old code compared `user.department` ("Fire & Rescue") directly
    against `Alert.area` ("Central Delhi"). Those are different namespaces,
    so the comparison never matched: department heads saw *no* region
    alerts, only broadcasts.
    """
    regions: set[str] = set()

    if getattr(user, "role", None) == "CENTRAL_ADMIN":
        return list(NCR_REGION_TUPLE)

    # (3) explicit preferences
    pref_rows = (
        await db.scalars(
            select(UserAlertPref).where(
                UserAlertPref.user_id == user.id,
                UserAlertPref.enabled.is_(True),
                UserAlertPref.region.is_not(None),
            )
        )
    ).all()
    for pref in pref_rows:
        if pref.region:
            regions.update(_split_area(pref.region))

    # (2) department coverage
    dept = getattr(user, "department", None)
    if dept:
        mapped = DEPARTMENT_REGIONS.get(dept)
        if mapped:
            regions.update(r for r in mapped if r)

    return sorted(regions) if regions else None


async def archive_expired_alerts(db: AsyncSession) -> int:
    """Stamp `expired_at` on alerts whose `expires_at` has passed.

    The sweeper used to `DELETE` expired rows. That destroyed the audit
    trail: an alert that fired and expired left no record that it ever
    existed, so "what did we warn about last Tuesday?" was unanswerable.
    Archiving keeps the row and its content; `list_alerts` filters on
    `expired_at IS NULL`, so the archive is invisible to the UI.

    Returns the number of rows archived.
    """
    from sqlalchemy import update

    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(Alert)
        .where(
            Alert.expires_at.is_not(None),
            Alert.expires_at < now,
            Alert.expired_at.is_(None),
        )
        .values(expired_at=now)
    )
    await db.commit()
    return int(result.rowcount or 0)


async def list_alerts(db: AsyncSession, user: User) -> list[Alert]:
    now = datetime.now(timezone.utc)
    stmt = select(Alert).where(
        ((Alert.expires_at.is_(None)) | (Alert.expires_at > now)),
        Alert.expired_at.is_(None),
    )
    rows = (await db.scalars(stmt.order_by(Alert.created_at.desc()))).all()
    # geo-target: broadcasts ("*") always visible; region-targeted alerts only
    # when the user opted into (or is covered for) that region.
    regions = await _user_regions(db, user)
    out = []
    for a in rows:
        if a.area == BROADCAST_AREA:
            out.append(a)
            continue
        if regions:
            alert_regions = _split_area(a.area)
            if any(r in alert_regions for r in regions):
                out.append(a)
    return out


async def create_alert(db: AsyncSession, user: User, payload: AlertCreateIn) -> Alert:
    alert = Alert(
        event=payload.event,
        title=payload.title,
        body=payload.body,
        severity=payload.severity,
        urgency=payload.urgency,
        certainty=payload.certainty,
        area=payload.area,
        expires_at=payload.expires_at,
        published_by=user.id,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    # publish to redis channel
    try:
        import json

        from app.core.database import get_redis

        r = get_redis()
        await r.publish(
            "alerts",
            json.dumps(
                {
                    "type": "alert.created",
                    "data": {"id": alert.id, "title": alert.title},
                }
            ),
        )
    except Exception:
        pass
    return alert


async def list_prefs(db: AsyncSession, user: User) -> list[UserAlertPref]:
    rows = (
        await db.scalars(select(UserAlertPref).where(UserAlertPref.user_id == user.id))
    ).all()
    return list(rows)


async def upsert_pref(
    db: AsyncSession, user: User, region, category, enabled
) -> UserAlertPref:
    # find existing
    existing = await db.scalar(
        select(UserAlertPref).where(
            UserAlertPref.user_id == user.id,
            UserAlertPref.region == region,
            UserAlertPref.category == category,
        )
    )
    if existing:
        existing.enabled = enabled
        await db.commit()
        await db.refresh(existing)
        return existing
    pref = UserAlertPref(
        user_id=user.id, region=region, category=category, enabled=enabled
    )
    db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


async def delete_pref(db: AsyncSession, user: User, pref_id: str) -> None:
    pref = await db.get(UserAlertPref, pref_id)
    if pref is None or pref.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found"
        )
    await db.delete(pref)
    await db.commit()
