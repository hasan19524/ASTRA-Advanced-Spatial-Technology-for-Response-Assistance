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

# Browser-location fallback when a report arrives without coordinates —
# the Day 3 form has no map picker yet (Day 6 adds real pinning).
NCR_CENTER_LAT = 28.61
NCR_CENTER_LON = 77.21

# AD-8 — evidence photos live in `api/uploads/`, served back statically.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
