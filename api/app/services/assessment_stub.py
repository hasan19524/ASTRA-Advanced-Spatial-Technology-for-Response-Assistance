"""Deterministic assessment stub — the 3 ordered rules decided on Day 3.

Every submission gets exactly one rules-based outcome; every decision row
carries `backend="rules_stub"` + a human-readable reason. Rule order, first
match wins (vision §B: the reason must distinguish *contradicting* evidence
from merely missing evidence — absence is never grounds for False):

  1. region given but outside the Delhi-NCR allowlist → DEFINITELY_FALSE
     (contradicting geography: ASTRA covers Delhi NCR only)
  2. keyword blacklist (prank/fake starter set) in title+description
     → DEFINITELY_FALSE
  3. trusted source (whitelisted reporter email / official feed) → MAYBE_TRUE
  4. else → MAYBE_TRUE (no contradicting signal)

The lists below are pinned by tests — changing them is a contract change.
"""

from app.core.constants import NCR_REGIONS

# Rule 2 — prank-report starter set (substring, case-insensitive). Pinned by
# tests; grown as new spam patterns appear.
BLACKLIST_KEYWORDS: frozenset[str] = frozenset({"prank", "joke", "fake", "lol", "asdf"})

# Rule 3 — official feeds that may file directly (whitelist decided Day 3).
TRUSTED_REPORTER_EMAILS: frozenset[str] = frozenset(
    {"control@ndrf.gov.in", "ops@fire.delhi.gov.in"}
)


def assess_submission(
    *,
    title: str,
    description: str | None,
    region: str | None,
    reporter_email: str,
) -> tuple[str, str, float]:
    """(outcome, reason, confidence) for one submission — pure, no I/O."""
    text = f"{title} {description or ''}".lower()

    if region and region not in NCR_REGIONS:
        return (
            "DEFINITELY_FALSE",
            f"Region {region!r} lies outside the Delhi-NCR coverage map (rule 1: contradicting geography)",
            0.9,
        )

    hit = next((k for k in sorted(BLACKLIST_KEYWORDS) if k in text), None)
    if hit:
        return (
            "DEFINITELY_FALSE",
            f"Report text contains blacklist keyword {hit!r} (rule 2: prank/fake starter set)",
            0.8,
        )

    if reporter_email.lower() in TRUSTED_REPORTER_EMAILS:
        return (
            "MAYBE_TRUE",
            "Reporter is on the trusted-source whitelist (rule 3: official feed)",
            0.95,
        )

    return (
        "MAYBE_TRUE",
        "No contradicting signal found (rule 4: missing evidence is not counter-evidence)",
        0.5,
    )
