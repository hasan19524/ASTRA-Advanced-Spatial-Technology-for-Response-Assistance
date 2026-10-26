# Research — The Real Systems Behind Every ASTRA Feature

> Compiled 27 Oct 2026 by Hasan. Purpose: every ASTRA feature must map to something that
> already exists in the real world — we borrow proven architecture instead of inventing.
> Also: exactly which data can be real, which needs a key, and what stays seeded.
> Sources: web research (Waze, Geofabrik, OASIS CAP, NDMA, OSRM/Valhalla/GraphHopper,
> CAD vendors, free-tier API roundups, Vosk) — links inline.

---

## 1. Crowd-sourced reporting + trust scoring → **Waze** + **Citizen app**

**How Waze actually works:**
- Users file reports (hazard, police, closure, jam); the *map editor community* — a
  subgroup of users — verifies and maintains the map separately from ordinary reporters.
- Every alert carries **`Reliability` 0–10** (from other users' reactions: thumbs up /
  "not there") and **`confidence` 0–10**, plus **`reportRating` = reporter level 1–6**
  (higher level = more trusted reporter).
- A separate routing-purpose map is maintained; crowd reports change **dynamic edge
  weights** in minutes. New: *Conversational Reporting* — drivers state hazards in
  natural language instead of tapping buttons.
- Source: wazebelgium.be system-design writeup, Waze Partners data-feed spec, Google blog.

**Citizen app:** real-time push alerts, live video from the scene, incident search,
hospital/ER pre-alerting. Public-facing feed + notifications.

**What ASTRA borrows (and where we deliberately differ):**
- ✅ Our **poll** ≈ Waze's reaction-based reliability signal — *a crowd signal, not truth*.
  Waze proves the pattern; vision.md's rule that polls never change verification is the
  stricter, better version for emergencies.
- ✅ Our **Verification Officers** ≈ Waze map editors — a separate, trusted class of users.
- ✅ **Voice conversational reporting** = Waze Conversational Reporting, validated as a real
  feature (supports our Gnani voice report plan).
- ⚠️ Waze shows reporter *level* builds trust over time — we can seed reporter history
  (`incident_reports.reporter_history`) the same way.

---

## 2. Emergency coordination & dispatch → **911 CAD systems**

**How CAD (Computer-Aided Dispatch) works** — Motorola CommandCentral / Mark43 / Caliber:
> call intake → incident classification → **GPS nearest-unit assignment** → live unit
> tracking → status updates → record logging → closure.

- One operational picture: GIS map + live unit positions + mobile data terminals (MDT)
  in vehicles, integrated video/feeds, AI-driven dispatch recommendations.
- Incident lifecycle "from first call to final resolution" with **incident transfer**,
  multiple units per incident, and full audit history.

**What ASTRA borrows:**
- ✅ Module 1's pipeline = CAD's lifecycle: report intake → classification (our AI
  assessment) → department assignment (our Central Admin / Dept Head) → tasks with own
  statuses → closure by authority only.
- ✅ CAD's "several units, one incident, independent statuses" is exactly our
  **parent incident + linked tasks** (rescue done / repair pending).
- ✅ Dispatcher vs supervisor vs field-officer separation = our 5-role RBAC.
- ✅ Field units see routes + instructions only → our `assignment.view` permission.

---

## 3. Public alerts → **CAP (OASIS) / IPAWS / India's NDMA SACHET**

**The standard:** Common Alerting Protocol v1.2 — open XML/JSON format for all-hazard
alerts. Structure: `<alert>` (identifier, sender, timestamp, status) → `<info>`
(event type, **severity, urgency, certainty**, onset, duration) → `<area>` (polygon /
admin codes for geo-targeting). One message fans out to SMS, cell broadcast, sirens, apps.

**India's real implementation:** NDMA + IMD run a **CAP-based Early Warning System**;
**SACHET** (built by C-DOT) is live across all 36 states/UTs — **68.99 billion geo-targeted
SMS alerts in 19+ Indian languages**, now adding cell broadcast.

**What ASTRA borrows:**
- ✅ Model our alert schema on CAP fields: `event, severity, urgency, certainty, area polygon,
  onset`. Judges recognize the standard; integration story is real.
- ✅ Region-subscribed alerts = CAP area targeting (we do it in-app instead of SMS).
- ✅ Demo line: *"our alert structure follows CAP — the same standard behind NDMA's SACHET."*

---

## 4. Maps & routing → **OpenStreetMap + OSRM/Valhalla/GraphHopper/pgRouting**

**Geodata (free, no key):** Geofabrik daily OSM extracts — `india-latest.osm.pbf` (1.6 GB),
zoned extracts (Northern Zone 213 MB covers Delhi NCR), ODbL license (attribution
required). Also sells *routeable vector data*. Overpass API for ad-hoc bbox queries.

**Routing engines:**
| Engine | Approach | Limitation relevant to us |
|---|---|---|
| **OSRM** | contraction hierarchy, precompiled graph, fastest queries | **cannot change edge weights at query time** — closures/traffic won't apply |
| **Valhalla** | dynamic costing, time-dependent, isochrones | heavier setup, Lua tile-based |
| **GraphHopper** | Java, truck/pedestrian profiles, isochrones | JVM service to babysit |
| **pgRouting** | Dijkstra/A* inside Postgres, SQL weights | dynamic weights, regional scale fine |

**What ASTRA does (AD-4 confirmed by this research):** OSM edges in Postgres → adjacency
list in memory → **our own Dijkstra with mutable weights** (road closure ×∞, traffic
penalty). That's precisely the capability OSRM lacks, and our plan (Dijkstra per vision.md)
lands in the gap: closure-aware re-routing demoed live. Option: pgRouting if SQL-side
routing gets attractive later (same idea, no new service).

**Tile layers:** OSM raster (tile usage policy) or CartoDB Positron — no key, Leaflet-ready.

---

## 5. External feeds: weather real, traffic honest

| Feed | Best free source | Key needed? | Notes |
|---|---|---|---|
| **Weather** | **Open-Meteo** | ❌ none | free for non-commercial, **10k calls/day**, <10ms responses, 30+ NWP models, CC BY 4.0 attribution. Real weather over Delhi NCR in the demo. |
| **Traffic** | TomTom free tier / HERE / Google | ✅ key | latencies ~16 min (TomTom), 5–10 min (HERE), 10–15 min (Google) — *all key-gated, none instant* |
| **Decision** | **seeded traffic** + optional TomTom eval key | — | realistic seeded flow data keeps the demo repeatable; label it "simulated feed" honestly (vision.md allows external data "where available") |

---

## 6. The reasoning brain (LLM fallback while Gnani is pending)

Free tiers verified 2026:
- **Google Gemini free** — ~15 RPM / 1,500 RPD, 1M-token context, current Flash models;
  caveat: prompts may be used for model training (fine for non-sensitive prototype text).
- **Groq free** — fastest inference (LPU), ~1,000 req/day on large open models, no data
  training on most models; ideal for latency-sensitive demo loops.
- **OpenRouter free** — 50 req/day (1,000 after $10 credit), many models behind one key.
- **Cloudflare Workers AI** — 10,000 Neurons/day.
- **Ollama (local)** — zero cost, **nothing leaves the machine** → pairs perfectly with the
  sovereign/on-prem story (and with Evon being Apache-2.0 self-hostable).

**Plan:** `AssessmentBackend` interface (already in the plan) with backends in this order:
**Gnani Evon (when key lands) → Groq/Gemini free key → Ollama → rule-based** — degradation
always logged, never silent.

---

## 7. Voice when Gnani isn't ready yet

- **Vosk** — offline STT, `pip install vosk`, ~50 MB per-language models, streaming API.
  Models include **Hindi, Telugu, Gujarati, Indian English** (+ more). Runs on CPU, no key.
- **Web Speech API** — free in Chrome: `SpeechRecognition` (hi-IN) + `speechSynthesis`
  voices for TTS. Zero setup, browser-only — good demo fallback.
- **Whisper** — best accuracy, but heavy on CPU; only if needed for batch files.

**Plan:** browser Web Speech as instant fallback so the voice demo never dies; Vosk as the
server-side offline path; **Gnani Prisma/Timbre remain the real target** (Day 7).

---

## 8. Simulations → **FEMA HAZUS** + agent-based tools

- **HAZUS** (FEMA) = the professional standard: deterministic damage/loss estimation models
  with scenario inputs (hazard intensity, building stock) → impact footprint + resource
  estimates. Cited widely for disaster planning.
- **AnyLogic / Mesa** = agent-based + discrete-event simulation for crowds/traffic.

**ASTRA's stance:** a **HAZUS-lite deterministic model** (scenario params → impacted area
polygon, resource counts, affected route edges) is honest, explainable, and demo-safe —
running on `sim_*` tables only (AD-3). Judges compare favorably to "we used Unity".

---

## 9. Dummy data & API keys — master table

| Need | Source | Key? | Real or seeded |
|---|---|---|---|
| Map base tiles | OSM / CartoDB Positron | ❌ | **real** |
| Road network (NCR) | Geofabrik extract (Northern Zone or bbox cut) | ❌ | **real** |
| Geocoding | Nominatim (1 req/s) or pre-seeded fixtures | ❌ | real / seeded |
| Routing | our Dijkstra (AD-4) | ❌ | **real algorithm** |
| Weather | **Open-Meteo** | ❌ | **real** |
| Traffic | seeded JSON (TomTom eval key optional) | 🟡 | seeded |
| LLM | Gnani Evon → Groq/Gemini free → Ollama → rules | 🟡 (free keys) | **real calls** |
| STT/TTS | Gnani (target) / Web Speech + Vosk (fallback) | 🟡 | **real** |
| Incidents, users, teams | **Faker (en_IN)** + hand-written NCR scenarios | ❌ | seeded |
| Realistic disaster events | ReliefWeb API, GDELT (both free/no key) | ❌ | optional real |
| Fire/pollution hotspots | NASA FIRMS (free key) | ✅ | optional real |
| India stats (pop, districts) | data.gov.in open datasets | ❌ | real |
| Fonts/icons | system / open-source (Lucide, Material) | ❌ | real |

**Demo honesty card (use it verbatim):** *"Weather and the road network are real — Open-Meteo
and OpenStreetMap. The routing algorithm and the RBAC/verification workflow are real code.
Incidents, users, traffic and simulation outputs are seeded so the demo is repeatable."*

---

## 10. Synthesis — what this changes in our build

1. **Nothing in AD-1…18 gets overturned** — the research *confirms* them (esp. AD-4 routing,
   sensitivity rule vs Waze crowdsourcing, CAP-shaped alerts).
2. Add to Day-2+ work: alert schema shaped like CAP (fields, not XML), poll UI that shows a
   *reliability-style* score (0–10), reporter history on reports (Waze `reportRating` idea).
3. Weather integration = Open-Meteo, zero keys — cheapest "real data" win available.
4. Get **one** free LLM key (Groq *or* Gemini) early; Ollama is the offline safety net.
5. Voice never blocks: Web Speech fallback exists today; Gnani lands Day 7.
