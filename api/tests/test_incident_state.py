"""Day 3 task 3 — incident state machine: every legal transition passes,
every illegal one is refused with the rule that caught it
(vision.md §B/§C/§E/§F + AD-18).

Run:  cd api && .venv\\Scripts\\python.exe -m pytest -q
"""

import pytest

from app.models import Incident, User
from app.services import incident_state as state


def _incident(**axes) -> Incident:
    # column defaults (OPEN/UNVERIFIED/NONE) only materialize at INSERT time,
    # so a bare ORM instance must be seeded with them explicitly; caller axes
    # override the defaults
    fields = dict(
        title="t",
        category="Fire",
        latitude=28.61,
        longitude=77.21,
        verification="UNVERIFIED",
        response_phase="NONE",
        lifecycle="OPEN",
    )
    fields.update(axes)
    return Incident(**fields)


def _user(role: str) -> User:
    return User(email=f"{role.lower()}@t.dev", full_name="T", role=role)


# ---------------------------------------------------------------- legal paths
def test_apply_assessment_maybe_true_keeps_it_public():
    inc = _incident()
    row = state.apply_assessment(
        inc, "MAYBE_TRUE", backend="rules_stub", reason="no signal", confidence=0.5
    )
    assert inc.assessment_status == "MAYBE_TRUE"
    assert inc.visibility == "PUBLIC_UNVERIFIED"  # §B: public status UNVERIFIED
    assert inc.lifecycle == "OPEN"
    state.assert_invariants(inc)
    assert row.backend == "rules_stub" and row.reason == "no signal"


def test_apply_assessment_definitely_false_flips_three_axes():
    inc = _incident()
    row = state.apply_assessment(
        inc, "DEFINITELY_FALSE", backend="rules_stub", reason="outside NCR"
    )
    assert inc.assessment_status == "DEFINITELY_FALSE"
    assert inc.visibility == "HIDDEN"  # §B: not published
    assert inc.lifecycle == "CLOSED"  # §B: no poll, no dispatch
    state.assert_invariants(inc)
    assert row.outcome == "DEFINITELY_FALSE"


def test_officer_verifies_and_admin_closes():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    state.set_verification(inc, _user("VERIFICATION_OFFICER"), "VERIFIED")
    assert inc.verification == "VERIFIED"
    state.set_lifecycle(inc, _user("CENTRAL_ADMIN"), "CLOSED")
    assert inc.lifecycle == "CLOSED"
    state.assert_invariants(inc)


def test_poll_eligibility_truth_table():
    eligible = _incident(
        assessment_status="MAYBE_TRUE",
        visibility="PUBLIC_UNVERIFIED",
        sensitivity="PUBLIC",
    )
    assert state.poll_eligible(eligible) is True
    assert (
        state.poll_eligible(
            _incident(
                assessment_status="MAYBE_TRUE",
                visibility="PUBLIC_UNVERIFIED",
                sensitivity="RESTRICTED",
            )
        )
        is False
    )  # restricted reports never poll
    assert (
        state.poll_eligible(
            _incident(
                assessment_status="DEFINITELY_FALSE",
                visibility="HIDDEN",
                lifecycle="CLOSED",
            )
        )
        is False
    )  # DF never polls (AD-18)


# ---------------------------------------------------------------- illegal paths
def test_illegal_non_admin_closes():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    for role in ("CITIZEN", "DEPARTMENT_HEAD", "RESPONSE_TEAM", "VERIFICATION_OFFICER"):
        with pytest.raises(state.InvariantError, match="I6"):
            state.set_lifecycle(inc, _user(role), "CLOSED")
    assert inc.lifecycle == "OPEN"  # refused change leaves the axis untouched


def test_illegal_non_officer_verifies():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    with pytest.raises(state.InvariantError, match="I5"):
        state.set_verification(inc, _user("CITIZEN"), "VERIFIED")
    assert inc.verification == "UNVERIFIED"


def test_illegal_verification_is_one_way():
    inc = _incident(
        assessment_status="MAYBE_TRUE",
        visibility="PUBLIC_UNVERIFIED",
        verification="VERIFIED",
    )
    with pytest.raises(state.InvariantError, match="I5"):
        state.set_verification(inc, _user("VERIFICATION_OFFICER"), "UNVERIFIED")


def test_illegal_df_left_public():
    # a DEFINITELY_FALSE report that someone marked PUBLIC_UNVERIFIED breaks I1
    inc = _incident(
        assessment_status="DEFINITELY_FALSE",
        visibility="PUBLIC_UNVERIFIED",
        lifecycle="CLOSED",
    )
    with pytest.raises(state.InvariantError, match="I1"):
        state.assert_invariants(inc)


def test_illegal_hidden_without_df_cause():
    # HIDDEN can only ever be the product of a DEFINITELY_FALSE assessment
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="HIDDEN")
    with pytest.raises(state.InvariantError, match="I2"):
        state.assert_invariants(inc)


def test_illegal_reopening_a_df_report():
    inc = _incident(
        assessment_status="DEFINITELY_FALSE", visibility="HIDDEN", lifecycle="CLOSED"
    )
    with pytest.raises(state.InvariantError, match="I1"):
        state.set_lifecycle(inc, _user("CENTRAL_ADMIN"), "OPEN")
    assert inc.lifecycle == "CLOSED"  # rollback kept the legal state


def test_illegal_assessment_outcome():
    with pytest.raises(state.InvariantError, match="two vision categories"):
        state.apply_assessment(_incident(), "MAYBE_FAKE", backend="x", reason="y")


# ---------------------------------------------------------------- Day 4 (AD-23)
def test_officer_can_reject():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    state.set_verification(inc, _user("VERIFICATION_OFFICER"), "REJECTED")
    assert inc.verification == "REJECTED"


def test_reopen_after_reject_is_legal():
    inc = _incident(
        assessment_status="MAYBE_TRUE",
        visibility="PUBLIC_UNVERIFIED",
        verification="REJECTED",
    )
    state.set_verification(inc, _user("VERIFICATION_OFFICER"), "UNVERIFIED")
    assert inc.verification == "UNVERIFIED"


def test_verified_is_terminal_refuses_reject():
    inc = _incident(
        assessment_status="MAYBE_TRUE",
        visibility="PUBLIC_UNVERIFIED",
        verification="VERIFIED",
    )
    with pytest.raises(state.InvariantError, match="terminal"):
        state.set_verification(inc, _user("VERIFICATION_OFFICER"), "REJECTED")
    assert inc.verification == "VERIFIED"


def test_noop_change_is_refused():
    inc = _incident(verification="UNVERIFIED")
    with pytest.raises(state.InvariantError, match="already UNVERIFIED"):
        state.set_verification(inc, _user("VERIFICATION_OFFICER"), "UNVERIFIED")
    assert inc.verification == "UNVERIFIED"


def test_citizen_cannot_change_verification_axis():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    with pytest.raises(state.InvariantError, match="I5"):
        state.set_verification(inc, _user("CITIZEN"), "REJECTED")
    assert inc.verification == "UNVERIFIED"


def test_unknown_status_is_refused():
    inc = _incident(assessment_status="MAYBE_TRUE", visibility="PUBLIC_UNVERIFIED")
    with pytest.raises(state.InvariantError, match="unknown verification status"):
        state.set_verification(inc, _user("VERIFICATION_OFFICER"), "MAYBE_TRUE")
    assert inc.verification == "UNVERIFIED"
