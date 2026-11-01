"""Stats service — Phase 2 (PL-10 role-scoped, PL-11 poll participation)."""

from sqlalchemy import func, select
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import permissions_for
from app.models import Alert, Incident, PollVote, ResponseTask, User
from app.services import incident_state


def _can_see_restricted(user: User) -> bool:
    return "incident.view_restricted" in permissions_for(user.role)


async def overview(db: AsyncSession, user: User) -> dict:
    restricted = _can_see_restricted(user)
    # incident visibility predicate
    if restricted:
        inc_stmt = select(Incident)
    else:
        inc_stmt = select(Incident).where(
            Incident.sensitivity == "PUBLIC", Incident.visibility != "HIDDEN"
        )

    rows = (await db.scalars(inc_stmt)).all()
    total = len(rows)
    open_inc = sum(1 for i in rows if i.lifecycle == "OPEN")
    closed_inc = sum(1 for i in rows if i.lifecycle == "CLOSED")
    verified = sum(1 for i in rows if i.verification == "VERIFIED")
    rejected = sum(1 for i in rows if i.verification == "REJECTED")
    public_unverified = sum(1 for i in rows if i.visibility == "PUBLIC_UNVERIFIED")
    hidden = sum(1 for i in rows if i.visibility == "HIDDEN") if restricted else 0
    restricted_cnt = (
        sum(1 for i in rows if i.sensitivity == "RESTRICTED") if restricted else 0
    )

    # tasks
    if user.role == "CENTRAL_ADMIN":
        task_stmt = select(ResponseTask)
    elif user.role in ("DEPARTMENT_HEAD", "RESPONSE_TEAM"):
        task_stmt = select(ResponseTask).where(
            ResponseTask.department == user.department
        )
    else:
        task_stmt = None
    if task_stmt is not None:
        tasks = (await db.scalars(task_stmt)).all()
        active_tasks = sum(1 for t in tasks if t.status != "DONE")
        done_tasks = sum(1 for t in tasks if t.status == "DONE")
    else:
        active_tasks = 0
        done_tasks = 0

    # poll participation rate (PL-11): distinct voters / eligible-incident count
    eligible_incidents = [i for i in rows if incident_state.poll_eligible(i)]
    eligible_count = len(eligible_incidents)
    if eligible_count:
        eligible_ids = [i.id for i in eligible_incidents]
        distinct_voters = await db.scalar(
            select(func.count(func.distinct(PollVote.voter_id))).where(
                PollVote.incident_id.in_(eligible_ids)
            )
        )
        rate = (distinct_voters or 0) / eligible_count
    else:
        rate = 0.0

    # active alerts
    now = datetime.now(timezone.utc)
    active_alerts = await db.scalar(
        select(func.count())
        .select_from(Alert)
        .where((Alert.expires_at.is_(None)) | (Alert.expires_at > now))
    )

    return {
        "total_incidents": total,
        "open_incidents": open_inc,
        "closed_incidents": closed_inc,
        "verified_incidents": verified,
        "rejected_incidents": rejected,
        "public_unverified_incidents": public_unverified,
        "hidden_incidents": hidden,
        "restricted_incidents": restricted_cnt,
        "active_tasks": active_tasks,
        "done_tasks": done_tasks,
        "poll_participation_rate": round(rate, 4),
        "active_alerts": int(active_alerts or 0),
    }
