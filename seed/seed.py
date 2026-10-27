"""ASTRA demo-world seed — re-runnable (idempotent: existing rows are skipped).

Usage (from repo root `code/`):
    api\\.venv\\Scripts\\python.exe seed\\seed.py

Creates:
  * 26 accounts — 1 admin, 1 verification officer, 7 department heads, 14 response
    team members (2 per department, AD-14), 3 citizens. ONE password for all
    (demo simplicity): astra-demo-2026
  * Headline demo logins: admin@ / dephead@ / team@ / officer@ / citizen@ astra.dev
  * 12 incidents across all 8 categories (AD-15), Delhi NCR (AD-13), mixed states
    across the five axes (architecture.md §3) — including one DEFINITELY_FALSE→HIDDEN
    and one RESTRICTED that never reaches the public map.
  * Reports, assessment history, verification events, poll votes, response tasks,
    assignments, task updates, 2 CAP-shaped alerts, alert prefs.
"""

import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "api"))

from sqlalchemy import func, select  # noqa: E402

from app.core.database import get_session_factory  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Alert,
    Assessment,
    Assignment,
    Incident,
    IncidentReport,
    PollVote,
    ResponseTask,
    TaskUpdate,
    User,
    UserAlertPref,
    VerificationEvent,
)

PASSWORD = "astra-demo-2026"

# AD-14 — the seven departments, exact strings used everywhere (scoping compares them)
POLICE = "Police"
FIRE = "Fire & Rescue"
EMS = "Medical/EMS"
ROADS = "Transport & Roads"
DISASTER = "Disaster Management"
ELECTRIC = "Electricity/Utilities"
WATER = "Water & Drainage"
DEPARTMENTS = [POLICE, FIRE, EMS, ROADS, DISASTER, ELECTRIC, WATER]

# role, department (None for non-departmental accounts)
USERS = [
    ("admin", "CENTRAL_ADMIN", None),
    ("officer", "VERIFICATION_OFFICER", None),
    # headline demo dept head + team member live in Fire & Rescue
    ("dephead", "DEPARTMENT_HEAD", FIRE),
    ("team", "RESPONSE_TEAM", FIRE),
    ("team.fire.2", "RESPONSE_TEAM", FIRE),
    # the remaining roster (AD-14: every department has 1 head + 2 members)
    ("head.police", "DEPARTMENT_HEAD", POLICE),
    ("head.medical", "DEPARTMENT_HEAD", EMS),
    ("head.roads", "DEPARTMENT_HEAD", ROADS),
    ("head.disaster", "DEPARTMENT_HEAD", DISASTER),
    ("head.electric", "DEPARTMENT_HEAD", ELECTRIC),
    ("head.water", "DEPARTMENT_HEAD", WATER),
    ("team.police.1", "RESPONSE_TEAM", POLICE),
    ("team.police.2", "RESPONSE_TEAM", POLICE),
    ("team.medical.1", "RESPONSE_TEAM", EMS),
    ("team.medical.2", "RESPONSE_TEAM", EMS),
    ("team.roads.1", "RESPONSE_TEAM", ROADS),
    ("team.roads.2", "RESPONSE_TEAM", ROADS),
    ("team.disaster.1", "RESPONSE_TEAM", DISASTER),
    ("team.disaster.2", "RESPONSE_TEAM", DISASTER),
    ("team.electric.1", "RESPONSE_TEAM", ELECTRIC),
    ("team.electric.2", "RESPONSE_TEAM", ELECTRIC),
    ("team.water.1", "RESPONSE_TEAM", WATER),
    ("team.water.2", "RESPONSE_TEAM", WATER),
    ("citizen", "CITIZEN", None),
    ("citizen2", "CITIZEN", None),
    ("citizen3", "CITIZEN", None),
]

# 12 incidents — all 8 categories, NCR coordinates, mixed axis states.
# keys: cat, region, lat, lon, axes: (assessment, visibility, verification,
# response_phase, lifecycle), sensitivity, plus seed extras
INCIDENTS = [
    dict(
        title="Fire at Connaught Place market complex",
        desc="Shop fitting material ablaze; smoke on second floor. Shoppers evacuated.",
        cat="Fire",
        region="Central Delhi",
        lat=28.6315,
        lon=77.2167,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "VERIFIED", "ACTIVE", "OPEN"),
        sens="PUBLIC",
        tasks=[
            (FIRE, "Contain and extinguish fire", "DONE", ["team"]),
            (POLICE, "Cordon ring road intersection", "IN_PROGRESS", ["team.police.1"]),
        ],
    ),
    dict(
        title="Multi-vehicle pileup on NH-48, Gurugram",
        desc="Six-vehicle collision near Cyber City flyover, ambulance required.",
        cat="Accident",
        region="Gurugram",
        lat=28.4950,
        lon=77.0890,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "VERIFIED", "ACTIVE", "OPEN"),
        sens="PUBLIC",
        tasks=[
            (
                EMS,
                "Triage and transport injured",
                "IN_PROGRESS",
                ["team.medical.1", "team.medical.2"],
            ),
            (
                ROADS,
                "Clear wrecked vehicles from carriageway",
                "OPEN",
                ["team.roads.1"],
            ),
        ],
    ),
    dict(
        title="Waterlogging under IIT underpass, South Delhi",
        desc="Underpass submerged 3 feet after overnight rain; two cars stalled.",
        cat="Flood/Waterlogging",
        region="South Delhi",
        lat=28.5482,
        lon=77.1955,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "COORDINATING", "OPEN"),
        sens="PUBLIC",
        tasks=[(WATER, "Deploy pumps at underpass", "IN_PROGRESS", ["team.water.1"])],
    ),
    dict(
        title="Suspected gas leak smell near Nehru Place metro",
        desc="Strong odour reported by commuters; no visible leak found yet.",
        cat="Hazard/Other",
        region="South Delhi",
        lat=28.5491,
        lon=77.2533,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "NONE", "OPEN"),
        sens="PUBLIC",
        tasks=[],
    ),
    dict(
        title="Vehicle theft complaint — Chandni Chowk",
        desc="Complainant reports stolen motorcycle outside metro gate 4.",
        cat="Crime/Safety",
        region="Old Delhi",
        lat=28.6562,
        lon=77.2325,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "NONE", "OPEN"),
        sens="RESTRICTED",  # AD-15 addendum: filtered out of the public map by sensitivity
        tasks=[],
    ),
    dict(
        title="Structural crack reported in Rohini Sector 5 tower",
        desc="Residents report widening crack on B-block staircase wall.",
        cat="Structural collapse",
        region="Rohini",
        lat=28.7495,
        lon=77.0565,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "VERIFIED", "COORDINATING", "OPEN"),
        sens="PUBLIC",
        tasks=[
            (
                DISASTER,
                "Structural safety assessment by engineer",
                "OPEN",
                ["team.disaster.1"],
            )
        ],
    ),
    dict(
        title="Power outage across Dwarka Sector 12",
        desc="14 blocks without supply since 05:40; substation relay tripped.",
        cat="Utility outage",
        region="Dwarka",
        lat=28.5921,
        lon=77.0460,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "VERIFIED", "ACTIVE", "OPEN"),
        sens="PUBLIC",
        tasks=[
            (ELECTRIC, "Restore substation feed", "IN_PROGRESS", ["team.electric.1"]),
            (ELECTRIC, "Coordinate temporary DG sets", "OPEN", ["team.electric.2"]),
        ],
    ),
    dict(
        title="Medical emergency at Nehru Place office park",
        desc="Cardiac episode at canteen; bystander CPR in progress.",
        cat="Medical emergency",
        region="South Delhi",
        lat=28.5245,
        lon=77.2066,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "VERIFIED", "RESOLVED", "OPEN"),
        sens="PUBLIC",
        tasks=[(EMS, "Patient transport to AIIMS", "DONE", ["team.medical.1"])],
    ),
    dict(
        title="Flood warning — Yamuna crosses danger mark",
        desc="Upstream discharge advisory for riverside ghats and low-lying camps.",
        cat="Flood/Waterlogging",
        region="Yamuna Basin",
        lat=28.6562,
        lon=77.2410,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "COORDINATING", "OPEN"),
        sens="PUBLIC",
        tasks=[
            (
                DISASTER,
                "Shift riverside camp dwellers to shelters",
                "IN_PROGRESS",
                ["team.disaster.1", "team.disaster.2"],
            )
        ],
    ),
    dict(
        title="Ambulance stuck in Noida Sector 18 traffic",
        desc="Gridlock during festival shopping; ambulance delayed 12 minutes.",
        cat="Accident",
        region="Noida",
        lat=28.5700,
        lon=77.3200,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "NONE", "OPEN"),
        sens="PUBLIC",
        tasks=[],
    ),
    dict(
        title="Drone spotted over IGI Airport restricted zone",
        desc="Unidentified drone inside 2 km perimeter; ATC holding departures.",
        cat="Hazard/Other",
        region="Airport",
        lat=28.5562,
        lon=77.1000,
        axes=("MAYBE_TRUE", "PUBLIC_UNVERIFIED", "UNVERIFIED", "NONE", "OPEN"),
        sens="RESTRICTED",  # filtered from the public map by sensitivity, axis stays pure
        tasks=[],
    ),
    dict(
        title="Viral 'meteor strike at India Gate' claim",
        desc="Viral social post claims a meteor impact at India Gate — no seismic "
        "activity or satellite confirmation exists. Assessment: definitely false.",
        cat="Fire",
        region="Central Delhi",
        lat=28.6129,
        lon=77.2295,
        axes=("DEFINITELY_FALSE", "HIDDEN", "REJECTED", "NONE", "CLOSED"),
        sens="PUBLIC",
        tasks=[],
    ),
]

ALERTS = [
    dict(
        event="Flood/Warning",
        title="Yamuna above danger mark — avoid riverfront",
        body="Discharge advisory in force. Move away from ghats and low-lying areas; "
        "shelters activated in East Delhi.",
        severity="SEVERE",
        urgency="IMMEDIATE",
        certainty="LIKELY",
        area="Yamuna Basin,Central Delhi,East Delhi",
    ),
    dict(
        event="Fire/Advisory",
        title="Market fire — Connaught Place cordon in place",
        body="Avoid Connaught Place inner circle. Traffic diverted via Barakhamba Road.",
        severity="MODERATE",
        urgency="EXPECTED",
        certainty="OBSERVED",
        area="Central Delhi",
    ),
]


async def main() -> None:
    factory = get_session_factory()
    async with factory() as db:
        # ---------------------------------------------------------- users
        existing_emails = set((await db.scalars(select(User.email))).all())
        pw = hash_password(PASSWORD)
        created = 0
        for local, role, dept in USERS:
            email = f"{local}@astra.dev"
            if email in existing_emails:
                continue
            db.add(
                User(
                    email=email,
                    full_name=local.replace(".", " ").title(),
                    password_hash=pw,
                    role=role,
                    department=dept,
                )
            )
            created += 1
        await db.commit()
        if created:
            print(f"users: created {created} new accounts (password: {PASSWORD})")
        else:
            print(f"users: all {len(USERS)} accounts already present — nothing to do")

        # ------------------------------------------------------- incidents
        count = await db.scalar(select(func.count()).select_from(Incident)) or 0
        if count:
            print(f"incidents: already seeded ({count} rows) — skipping")
        else:
            users = {u.email: u for u in (await db.scalars(select(User))).all()}

            def uid(local: str) -> str:
                return users[f"{local}@astra.dev"].id

            for spec in INCIDENTS:
                assessment, visibility, verification, phase, lifecycle = spec["axes"]
                inc = Incident(
                    title=spec["title"],
                    description=spec["desc"],
                    category=spec["cat"],
                    region=spec["region"],
                    sensitivity=spec["sens"],
                    assessment_status=assessment,
                    visibility=visibility,
                    verification=verification,
                    response_phase=phase,
                    lifecycle=lifecycle,
                    latitude=spec["lat"],
                    longitude=spec["lon"],
                    location_text=f"{spec['region']}, Delhi NCR",
                    reported_by=uid("citizen"),
                )
                db.add(inc)
                await db.flush()

                # at least one citizen report per incident
                db.add(
                    IncidentReport(
                        incident_id=inc.id,
                        reporter_id=uid("citizen"),
                        content=spec["desc"],
                        source="TEXT",
                        sensitivity=spec["sens"],
                    )
                )

                # assessment history (only where the AI actually ran)
                if assessment != "UNASSESSED":
                    db.add(
                        Assessment(
                            incident_id=inc.id,
                            backend="RULE",
                            outcome=assessment,
                            confidence=0.92 if assessment == "MAYBE_TRUE" else 0.97,
                            model="keyword-geo-rules-v1",
                            reason=(
                                "Corroborated by 2+ independent reports at this location"
                                if assessment == "MAYBE_TRUE"
                                else "Single uncorroborated claim, contradicted by "
                                "seismic + official feeds"
                            ),
                        )
                    )

                # officer decision history
                if verification in ("VERIFIED", "REJECTED"):
                    db.add(
                        VerificationEvent(
                            incident_id=inc.id,
                            officer_id=uid("officer"),
                            action=verification,
                            reason=(
                                "Cross-checked with department control room and photos"
                                if verification == "VERIFIED"
                                else "Claim cannot be substantiated; sources disagree"
                            ),
                        )
                    )

                # response tasks + assignments + progress
                for dept, title, status, assignees in spec.get("tasks", []):
                    task = ResponseTask(
                        incident_id=inc.id,
                        title=title,
                        department=dept,
                        status=status,
                    )
                    db.add(task)
                    await db.flush()
                    for local in assignees:
                        db.add(
                            Assignment(
                                task_id=task.id,
                                assignee_id=uid(local),
                                assigned_by=uid("dephead")
                                if dept == FIRE
                                else uid("admin"),
                            )
                        )
                    db.add(
                        TaskUpdate(
                            task_id=task.id,
                            author_id=uid("dephead") if dept == FIRE else uid("admin"),
                            status=status,
                            note=f"Seeded status: {status}",
                        )
                    )

                # poll votes — public UNVERIFIED incidents only (AD-18), never
                # for RESTRICTED and never for DEFINITELY_FALSE
                if (
                    spec["sens"] == "PUBLIC"
                    and verification == "UNVERIFIED"
                    and assessment == "MAYBE_TRUE"
                ):
                    for local, choice in (
                        ("citizen", True),
                        ("citizen2", True),
                        ("citizen3", False),
                    ):
                        db.add(
                            PollVote(
                                incident_id=inc.id,
                                voter_id=uid(local),
                                vote=choice,
                            )
                        )

            for a in ALERTS:
                db.add(
                    Alert(
                        event=a["event"],
                        title=a["title"],
                        body=a["body"],
                        severity=a["severity"],
                        urgency=a["urgency"],
                        certainty=a["certainty"],
                        area=a["area"],
                        published_by=uid("admin"),
                    )
                )

            db.add(UserAlertPref(user_id=uid("citizen"), region=None, category=None))
            await db.commit()
            print(
                f"incidents: created {len(INCIDENTS)} across "
                f"{len({i['cat'] for i in INCIDENTS})} categories, "
                f"{len(ALERTS)} alerts, tasks + votes + prefs"
            )

    print("seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
