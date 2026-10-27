"""SQLAlchemy models package (AD-9). Import every model here so Alembic
autogenerate sees the full metadata."""

from app.models.alert import Alert, UserAlertPref
from app.models.assistant import AssistConversation, AssistMessage
from app.models.audit import AuditLog
from app.models.feeds import ExternalFeedCache
from app.models.graph import MapLocation, RoutingEdge
from app.models.incident import (
    Assessment,
    Incident,
    IncidentReport,
    PollVote,
    VerificationEvent,
)
from app.models.simulation import SimRun
from app.models.task import Assignment, ResponseTask, TaskUpdate
from app.models.user import Base, User

__all__ = [
    "Alert",
    "Assessment",
    "AssistConversation",
    "AssistMessage",
    "Assignment",
    "AuditLog",
    "Base",
    "ExternalFeedCache",
    "Incident",
    "IncidentReport",
    "MapLocation",
    "PollVote",
    "ResponseTask",
    "RoutingEdge",
    "SimRun",
    "TaskUpdate",
    "User",
    "UserAlertPref",
    "VerificationEvent",
]
