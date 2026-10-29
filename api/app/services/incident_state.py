"""Incident state machine — the one gate every axis change passes through.

Invariants encoded here (vision.md §B/§C/§E/§F + §10, AD-18):

  I1  assessment=DEFINITELY_FALSE ⇒ visibility=HIDDEN ∧ lifecycle=CLOSED
      (not on the public map, no poll, no dispatch — §B)
  I2  visibility=HIDDEN ⇒ assessment=DEFINITELY_FALSE
      (HIDDEN has exactly one legal cause; auditors can trust it)
  I3  assessment=MAYBE_TRUE ⇒ visibility=PUBLIC_UNVERIFIED
      (MT reports stay on the map as UNVERIFIED — §B/§10)
  I4  poll eligibility ⇔ PUBLIC_UNVERIFIED ∧ sensitivity=PUBLIC ∧ MAYBE_TRUE
      (AD-18; a DF report never gets a poll — §C)
  I5  verification moves UNVERIFIED → VERIFIED|REJECTED, and REJECTED can be
      reopened to UNVERIFIED (Day 4, AD-23); only an `incident.verify` holder
      may change the axis (events stay append-only — §E; the matrix grants
      the permission to officers and Central Admin)
  I6  lifecycle closes/opens only under a Central Admin decision (§F)

Nothing mutates an incident's axes outside apply_assessment() /
set_verification() / set_lifecycle() — a raise here means the change is
refused BEFORE commit, with the rule that caught it.
"""

from app.core.permissions import permissions_for
from app.models import Assessment, Incident, User


def _holds(user: User, permission: str) -> bool:
    return permission in permissions_for(user.role)


class InvariantError(ValueError):
    """Illegal axis combination or unauthorized actor — refused, not corrected."""


def assert_invariants(incident: Incident) -> None:
    """Pure check — call after any axis change; raises the first broken rule."""
    if incident.assessment_status == "DEFINITELY_FALSE":
        if incident.visibility != "HIDDEN":
            raise InvariantError(
                "I1: a DEFINITELY_FALSE report must be HIDDEN (never on the public map)"
            )
        if incident.lifecycle != "CLOSED":
            raise InvariantError(
                "I1: a DEFINITELY_FALSE report is CLOSED (no poll, no dispatch)"
            )
    if (
        incident.visibility == "HIDDEN"
        and incident.assessment_status != "DEFINITELY_FALSE"
    ):
        raise InvariantError(
            "I2: HIDDEN visibility is only legal for DEFINITELY_FALSE reports"
        )
    if incident.assessment_status == "MAYBE_TRUE" and incident.visibility == "HIDDEN":
        raise InvariantError(
            "I3: a MAYBE_TRUE report must stay PUBLIC_UNVERIFIED on the map"
        )


def poll_eligible(incident: Incident) -> bool:
    """AD-18 + §C: which incidents may open a public poll."""
    return (
        incident.visibility == "PUBLIC_UNVERIFIED"
        and incident.sensitivity == "PUBLIC"
        and incident.assessment_status == "MAYBE_TRUE"
    )


def apply_assessment(
    incident: Incident,
    outcome: str,
    *,
    backend: str,
    reason: str,
    confidence: float | None = None,
    model: str | None = None,
) -> Assessment:
    """Set the assessment axis + its derived axes; return the history row.

    Caller owns the session: add the returned row and commit. The incident
    must already be flushed (assessment rows key off its id). `model` records
    the LLM model name when an LLM backend decided (Day 4, AD-24).
    """
    if outcome not in ("DEFINITELY_FALSE", "MAYBE_TRUE"):
        raise InvariantError(
            f"assessment outcome must be one of the two vision categories, got {outcome!r}"
        )
    previous = (incident.visibility, incident.lifecycle)
    incident.assessment_status = outcome
    if outcome == "DEFINITELY_FALSE":
        incident.visibility = "HIDDEN"  # §B: not published
        incident.lifecycle = "CLOSED"  # §B: no poll, no dispatch
    else:
        incident.visibility = "PUBLIC_UNVERIFIED"  # §B: public status UNVERIFIED
    try:
        assert_invariants(incident)
    except InvariantError:
        incident.visibility, incident.lifecycle = previous
        raise
    return Assessment(
        incident_id=incident.id,
        backend=backend,
        outcome=outcome,
        confidence=confidence,
        reason=reason,
        model=model,
    )


# I5 (Day 4, AD-23): legal verification-axis transitions. VERIFIED is terminal;
# REJECTED can be REOPENED back to UNVERIFIED (reason required at the endpoint);
# REJECTED -> VERIFIED directly is refused — that must be two auditable events.
VERIFICATION_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        ("UNVERIFIED", "VERIFIED"),
        ("UNVERIFIED", "REJECTED"),
        ("REJECTED", "UNVERIFIED"),
    }
)


def set_verification(incident: Incident, user: User, new_status: str) -> None:
    """I5: `incident.verify` holders only (verification officers per vision §E;
    the matrix is the authorization truth). Day 4 (AD-23) extends the axis with
    REJECTED + reopen — the legal pairs live in VERIFICATION_TRANSITIONS;
    VERIFIED stays terminal and no-op changes are refused (a double-click would
    otherwise look like two decisions in the audit trail)."""
    if new_status not in ("UNVERIFIED", "VERIFIED", "REJECTED"):
        raise InvariantError(f"unknown verification status {new_status!r}")
    if not _holds(user, "incident.verify"):
        raise InvariantError(
            "I5: only ASTRA Verification Officers may change the verification axis"
        )
    current = incident.verification
    if current == new_status:
        raise InvariantError(
            f"I5: verification is already {new_status} — no-op changes are refused"
        )
    if (current, new_status) not in VERIFICATION_TRANSITIONS:
        if current == "VERIFIED":
            raise InvariantError(
                "I5: verification is terminal (append-only) — VERIFIED cannot "
                f"become {new_status}"
            )
        raise InvariantError(
            f"I5: illegal verification transition {current} -> {new_status} "
            "(UNVERIFIED -> VERIFIED|REJECTED, REJECTED -> UNVERIFIED)"
        )
    incident.verification = new_status
    assert_invariants(incident)


def set_lifecycle(incident: Incident, user: User, new_lifecycle: str) -> None:
    """I6: `incident.close` (Central Admin) decides closure — nobody else (§F)."""
    if new_lifecycle not in ("OPEN", "CLOSED"):
        raise InvariantError(f"unknown lifecycle {new_lifecycle!r}")
    if not _holds(user, "incident.close"):
        raise InvariantError(
            "I6: only the Central Admin may open or close an incident (vision §F)"
        )
    if new_lifecycle == "OPEN" and incident.assessment_status == "DEFINITELY_FALSE":
        raise InvariantError(
            "I1: reopening is illegal — the report is DEFINITELY_FALSE (stays HIDDEN)"
        )
    previous = incident.lifecycle
    incident.lifecycle = new_lifecycle
    try:
        assert_invariants(incident)
    except InvariantError:
        incident.lifecycle = previous
        raise
