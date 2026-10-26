"""Role → permission matrix (AD-7: one role per account; permissions derive from role).

Backend-enforced: this table is the only source of authorization truth (vision.md §4).
"""

from enum import StrEnum


class Role(StrEnum):
    CITIZEN = "CITIZEN"
    CENTRAL_ADMIN = "CENTRAL_ADMIN"
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"
    RESPONSE_TEAM = "RESPONSE_TEAM"
    VERIFICATION_OFFICER = "VERIFICATION_OFFICER"


# --- permission vocabulary (extend as features land, never silently) ---
P = {
    # citizen surface
    "report.create": "Submit an incident report",
    "poll.vote": "Vote on a public poll",
    "map.view_public": "See public map layer",
    "assistant.use": "Use AI Assistance",
    "navigation.use": "Use routing / voice navigation",
    "simulation.public": "Run public simulations",
    # verification officer
    "incident.verify": "Mark an incident VERIFIED / REJECTED",
    "incident.view_restricted": "View sensitivity=RESTRICTED reports",
    # department head
    "department.view_own": "View own department's incidents/resources",
    "task.assign": "Assign response teams to tasks",
    "progress.update": "Report progress to Central Admin",
    # response team
    "task.update": "Update own assigned task status",
    "assignment.view": "View own assignments, routes, instructions",
    # central admin
    "incident.coordinate": "Coordinate incidents across departments",
    "incident.close": "Close an incident overall",
    "alert.manage": "Publish alerts and notifications",
    "analytics.operational": "Access operational/historical analytics",
    "audit.read": "Read audit logs",
    "simulation.operational": "Run operational-mode simulations",
    # shared operational visibility
    "map.view_operational": "See response-team locations and operational layers",
}

CITIZEN_PERMS = {
    "report.create",
    "poll.vote",
    "map.view_public",
    "assistant.use",
    "navigation.use",
    "simulation.public",
}

ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.CITIZEN: CITIZEN_PERMS,
    Role.VERIFICATION_OFFICER: CITIZEN_PERMS
    | {
        "incident.verify",
        "incident.view_restricted",
        "map.view_public",
        "analytics.operational",
    },
    Role.DEPARTMENT_HEAD: CITIZEN_PERMS
    | {
        "department.view_own",
        "task.assign",
        "progress.update",
        "map.view_operational",
        "analytics.operational",
    },
    Role.RESPONSE_TEAM: CITIZEN_PERMS
    | {
        "task.update",
        "assignment.view",
        "map.view_operational",
    },
    Role.CENTRAL_ADMIN: CITIZEN_PERMS
    | {
        "incident.verify",  # admin may view verification, officers still own the action
        "incident.view_restricted",
        "department.view_own",
        "task.assign",
        "progress.update",
        "incident.coordinate",
        "incident.close",
        "alert.manage",
        "analytics.operational",
        "audit.read",
        "simulation.operational",
        "map.view_operational",
    },
}


def permissions_for(role: str) -> list[str]:
    try:
        return sorted(ROLE_PERMISSIONS[Role(role)])
    except ValueError:
        return []
