"""Stats service — Phase 2 (PL-10 role-scoped, PL-11 poll participation).

Every number here is COUNTED FROM THE DATABASE. The analytics screen used to
show hard-coded fixtures ("128 total incidents", "94% poll agreement"), which
made the product look alive while saying nothing true. There is no fixture
path left: if a number cannot be computed, the API reports it as null and the
UI shows an honest dash.
"""

from sqlalchemy import Integer, func, select
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import permissions_for
from app.models import Alert, Incident, PollVote, ResponseTask, User, VerificationEvent
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

    # --- analytics block (the Reports & Analytics screen) ------------------
    # Every value below is derived from the rows the caller may already see,
    # so the analytics screen can never leak a restricted incident.

    # incidents per category
    by_category: dict[str, int] = {}
    for row in rows:
        by_category[row.category] = by_category.get(row.category, 0) + 1

    # 7-day window vs the 7 days before it → a REAL delta, not a fixture
    week_ago = now - timedelta(days=7)
    fortnight_ago = now - timedelta(days=14)
    current_7d = sum(1 for i in rows if i.created_at >= week_ago)
    previous_7d = sum(1 for i in rows if fortnight_ago <= i.created_at < week_ago)

    # average verification time: incident created → first VERIFIED/REJECTED
    verified_ids = [i.id for i in rows if i.verification in ("VERIFIED", "REJECTED")]
    avg_verify_minutes: float | None = None
    if verified_ids:
        first_decision = (
            select(
                VerificationEvent.incident_id,
                func.min(VerificationEvent.created_at).label("decided_at"),
            )
            .where(
                VerificationEvent.incident_id.in_(verified_ids),
                VerificationEvent.action.in_(("VERIFIED", "REJECTED")),
            )
            .group_by(VerificationEvent.incident_id)
            .subquery()
        )
        decision_rows = (
            await db.execute(
                select(
                    Incident.id,
                    Incident.created_at,
                    first_decision.c.decided_at,
                ).join(first_decision, first_decision.c.incident_id == Incident.id)
            )
        ).all()
        deltas = [
            (decided_at - created_at).total_seconds() / 60.0
            for _id, created_at, decided_at in decision_rows
            if decided_at is not None and created_at is not None
        ]
        if deltas:
            avg_verify_minutes = round(sum(deltas) / len(deltas), 1)

    # poll vs officer agreement: on incidents that were both polled AND
    # verified, did the majority of citizens agree with the officer?
    # `None` when there is no such incident yet — the UI shows a dash.
    poll_agreement: float | None = None
    if verified_ids:
        vote_rows = (
            await db.execute(
                select(
                    PollVote.incident_id,
                    func.sum(func.cast(PollVote.vote, Integer)).label("genuine"),
                    func.count(PollVote.id).label("total"),
                )
                .where(PollVote.incident_id.in_(verified_ids))
                .group_by(PollVote.incident_id)
            )
        ).all()
        incident_by_id = {i.id: i for i in rows}
        agree = 0
        compared = 0
        for inc_id, genuine, total_votes in vote_rows:
            incident = incident_by_id.get(inc_id)
            if incident is None or not total_votes:
                continue
            majority_genuine = (genuine or 0) * 2 > total_votes
            officer_genuine = incident.verification == "VERIFIED"
            compared += 1
            if majority_genuine == officer_genuine:
                agree += 1
        if compared:
            poll_agreement = round(agree / compared * 100, 1)

    # recent closures (most recently updated closed incidents first)
    recent_closures = [
        {
            "id": i.id,
            "title": i.title,
            "category": i.category,
            "region": i.region,
            "closed_at": i.updated_at.isoformat(),
        }
        for i in sorted(
            (i for i in rows if i.lifecycle == "CLOSED"),
            key=lambda i: i.updated_at,
            reverse=True,
        )[:8]
    ]

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
        "by_category": by_category,
        "incidents_7d": current_7d,
        "incidents_previous_7d": previous_7d,
        "avg_verify_minutes": avg_verify_minutes,
        "poll_officer_agreement": poll_agreement,
        "recent_closures": recent_closures,
    }
