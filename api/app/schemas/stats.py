"""Stats schemas."""

from pydantic import BaseModel


class StatsOut(BaseModel):
    total_incidents: int = 0
    open_incidents: int = 0
    closed_incidents: int = 0
    verified_incidents: int = 0
    rejected_incidents: int = 0
    public_unverified_incidents: int = 0
    hidden_incidents: int = 0
    restricted_incidents: int = 0
    active_tasks: int = 0
    done_tasks: int = 0
    poll_participation_rate: float = 0.0
    active_alerts: int = 0
