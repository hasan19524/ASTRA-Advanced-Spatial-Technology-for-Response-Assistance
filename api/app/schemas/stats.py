"""Stats schemas."""

from pydantic import BaseModel


class RecentClosure(BaseModel):
    """One closed incident, for the analytics screen's closure list."""

    id: str
    title: str
    category: str
    region: str | None = None
    closed_at: str


class StatsOut(BaseModel):
    # No defaults on purpose: every field is always present on the wire, so
    # the contract (and the generated TypeScript) can treat them as required
    # instead of "number | undefined" everywhere.
    total_incidents: int
    open_incidents: int
    closed_incidents: int
    verified_incidents: int
    rejected_incidents: int
    public_unverified_incidents: int
    hidden_incidents: int
    restricted_incidents: int
    active_tasks: int
    done_tasks: int
    poll_participation_rate: float
    active_alerts: int

    # --- analytics block (all computed from the DB, never a fixture) ---
    by_category: dict[str, int]
    incidents_7d: int
    incidents_previous_7d: int
    # None = not computable yet (no verified incident / no poll to compare).
    # The UI shows a dash rather than inventing a number.
    avg_verify_minutes: float | None
    poll_officer_agreement: float | None
    recent_closures: list[RecentClosure]
