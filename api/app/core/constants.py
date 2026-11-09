"""Shared domain constants (AD-13 NCR, AD-15 categories).

Single source of truth: the seed, form validation, and the assessment stub's
geo rule all import from here — never a second copy of these lists.
"""

# AD-15 — the 8 incident categories (report form picker + map styling).
CATEGORIES: frozenset[str] = frozenset(
    {
        "Fire",
        "Accident",
        "Flood/Waterlogging",
        "Structural collapse",
        "Medical emergency",
        "Crime/Safety",
        "Utility outage",
        "Hazard/Other",
    }
)

# Day 4: categories the officer verification queue treats as urgent
# (life-safety first). Change here, not in routers.
URGENT_CATEGORIES: frozenset[str] = frozenset(
    {"Fire", "Medical emergency", "Structural collapse", "Accident"}
)


# AD-13 — Delhi NCR regions ASTRA covers (the seed's regions + the two other
# major NCR cities). The assessment stub's geo rule treats any *given* region
# outside this set as outside coverage (vision.md §B: contradicting geo signal).
NCR_REGIONS: frozenset[str] = frozenset(
    {
        "Central Delhi",
        "South Delhi",
        "Old Delhi",
        "East Delhi",
        "North Delhi",
        "West Delhi",
        "Rohini",
        "Dwarka",
        "Yamuna Basin",
        "Airport",
        "Noida",
        "Gurugram",
        "Ghaziabad",
        "Faridabad",
    }
)

# Ordered mirror of NCR_REGIONS. The frozenset above is for membership tests;
# this tuple is for anything that has to *display* the regions in a stable,
# predictable order (alert targeting dropdowns, validation messages, docs).
NCR_REGION_TUPLE: tuple[str, ...] = (
    "Central Delhi",
    "South Delhi",
    "Old Delhi",
    "East Delhi",
    "North Delhi",
    "West Delhi",
    "Rohini",
    "Dwarka",
    "Yamuna Basin",
    "Airport",
    "Noida",
    "Gurugram",
    "Ghaziabad",
    "Faridabad",
)
NCR_REGION_SET: frozenset[str] = frozenset(NCR_REGION_TUPLE)

# Browser-location fallback when a report arrives without coordinates —
# the Day 3 form has no map picker yet (Day 6 adds real pinning).
NCR_CENTER_LAT = 28.61
NCR_CENTER_LON = 77.21

# AD-14 — the 7 response departments of Delhi NCR. This is the ONE list:
# the seed, the task API and the organisation directory all use these exact
# strings.
#
# Why it must be canonical: `users.department` and `response_tasks.department`
# are plain strings, so a typo ("Fire", "fire & rescue") silently creates a
# SECOND department. The directory rollup then shows a team with zero people
# next to a team with zero tasks, and nobody notices. The API rejects any
# department outside this list; the frontend mirrors it in
# web/src/lib/constants.ts.
DEPARTMENTS: tuple[str, ...] = (
    "Police",
    "Fire & Rescue",
    "Medical/EMS",
    "Transport & Roads",
    "Disaster Management",
    "Electricity/Utilities",
    "Water & Drainage",
)
DEPARTMENT_SET: frozenset[str] = frozenset(DEPARTMENTS)

# Geo-targeting: maps a department to the NCR regions it covers. Departments are
# city-wide responders (AD-14), so each covers every region ASTRA covers.
# A user with no department (a citizen) falls back to their own explicit
# alert preferences, and to broadcast-only ("*") alerts when they have none.
DEPARTMENT_REGIONS: dict[str, tuple[str, ...]] = {
    dept: NCR_REGION_TUPLE for dept in DEPARTMENTS
}

# "*" is the CAP-style broadcast marker: an alert every user must see.
BROADCAST_AREA = "*"

# AD-8 — evidence photos live in `api/uploads/`, served back statically.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
