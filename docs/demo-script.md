# ASTRA — 3–5 Minute Demonstration Script

> Companion to the Great Indian AI Internship Challenge 2026 submission.
> ASTRA = **A**dvanced **S**patial **T**echnology for **R**esponse **A**ssistance.
> Run the local stack first (`docker compose up -d`, `npm run dev`) and seed the demo world (`python seed/seed.py`) so the map has real pins. Demo logins: `admin@`, `dephead@`, `team@`, `officer@`, `citizen@astra.dev` (password `astra-demo-2026`).

## Pre-demo setup (not part of the timed script)

- Open `http://localhost:3000` in a clean browser profile.
- Sign in as `citizen@astra.dev` for Segment 2, then switch roles as noted.
- Keep DevTools closed unless the point is to show the network call.
- Have these files open for visual cues:
  - `web/trust-arc-1-citizen-report.png` — citizen report form + voice recorder
  - `web/trust-arc-2-citizen-vote.png` — public poll + pin colour change
  - `web/trust-arc-2b-queue.png` — officer verification queue
  - `web/trust-arc-3-officer-verify.png` — officer verdict dialog
  - `web/trust-arc-4-pin-flipped.png` — map pin flipped to green after verification

## Segment 1 — Problem statement (0:00–0:30)

- **On screen:** Landing/login page, then `docs` README hero (or the dashboard).
- **Say:** "During an emergency, citizens need to report what they see and responders need to verify, prioritize and dispatch fast. Most tools centralise control in one call centre, delay verification, show dummy pins instead of real roads, or fabricate analytics. ASTRA is role-based and backend-enforced: citizens report, AI assesses, officers verify, teams coordinate — over a real OpenStreetMap road graph, with honest degraded states and no dummy data."

## Segment 2 — Citizen incident reporting with voice (Gnani STT) (0:30–1:30)

- **On screen:** Click **Report** in the nav → `/report`. (Cue: `web/trust-arc-1-citizen-report.png`.)
- **Click path:**
  1. Sign in as `citizen@astra.dev`.
  2. Nav → **Report an Incident** (`/report`).
  3. Title: "Heavy smoke near Yamuna floodplain, people evacuating."
  4. Category button: **Hazard/Other**.
  5. Region: `South Delhi`.
  6. Click **Use my location** (or accept the NCR-center default — the UI discloses "NCR center (default)").
  7. Description box: leave empty for voice.
  8. Under **Voice input (STT)**, pick language in the dropdown, click **🎙 Record voice**; speak 5–10 seconds; click **Stop recording**.
  9. Watch the **Transcript:** card appear ("Speech-to-text by Gnani AI Prisma").
  10. Confirm the transcript is editable in the Description field, then click **Submit report**.
- **Say:** "The citizen records audio in the browser; ASTRA records OGG (Gnani-supported) with a WebM fallback, transcodes server-side to 16 kHz WAV, forwards to Gnani Prisma STT, and persists the transcript as the incident description. No canned transcript — the real Gnani API answered."
- **On screen:** Redirect to `/incidents/{id}`; point at the AI Assessment axis card ("Maybe True / Unassessed").

## Segment 3 — Image evidence analysis (1:30–2:00)

- **On screen:** Same report form, **Photo (optional)** card. (Cue: `web/trust-arc-1-citizen-report.png`.)
- **Click path:**
  1. Back to `/report` (or show on a second report).
  2. Click **Attach photo** → choose a JPEG/PNG/WebP (≤ 5 MB).
  3. Preview appears (128×128 thumbnail).
  4. Click **Analyze evidence**.
  5. Watch the `EvidenceAnalysisCard` render: authenticity verdict + quality checks (blur / brightness / duplicate) + "rejected images never invalidate the report" note.
- **Say:** "Pillow runs deterministic checks first (black/white/blank/blur/low-res/duplicate), then a hosted vision model (OpenAI gpt-4o by default, Gemini stub available) returns a structured verdict. The result is honest — 'undetermined' is a valid answer — and a bad photo never blocks the report."

## Segment 4 — Incident verification by officer (2:00–2:45)

- **On screen:** Sign out / sign in as `officer@astra.dev`. (Cue: `web/trust-arc-2b-queue.png`, `web/trust-arc-3-officer-verify.png`.)
- **Click path:**
  1. Nav → **Verification Queue** (`/verification`).
  2. Show filter chips (All Assessment / Maybe True / Definitely False; age; urgency) and the count "N incidents awaiting officer review".
  3. Click **Investigate** on the just-filed incident → `/incidents/{id}`.
  4. Walk the 4-axis cards: AI Assessment ≠ Officer Verification ≠ Response Phase ≠ Lifecycle.
  5. Scroll to **Officer Verdict** → click **Mark Verified** → confirm dialog → **Confirm VERIFIED**.
  6. Show the terminal-state banner "Verified — terminal state. No further action possible."
- **Say:** "Verification is append-only and one-way: VERIFIED is terminal, REJECTED requires a reason, REJECTED→VERIFIED is refused. Polls never write verification — four independent axes, kept honest. The queue is role-gated; a citizen can never reach this screen."

## Segment 5 — Live map updates (2:45–3:15)

- **On screen:** Nav → **Live Operations Map** (`/map`). (Cue: `web/trust-arc-4-pin-flipped.png`.)
- **Click path:**
  1. Show real OSM raster tiles, pan/zoom.
  2. Point at the legend: green = Verified, amber = Unverified; "Graph: 406,154 OSM nodes · 879,902 directed edges."
  3. Click the pin for the incident just verified → dispatch card shows Verification = VERIFIED, green pin.
  4. Toggle **Live traffic (TomTom)** checkbox → show current vs free-flow speed + congestion % (or the honest "Traffic service unavailable" message if no key).
  5. Note the footer: "Team GPS is not available: no user carries a position. It is not faked here."
- **Say:** "Pins are real incidents over real OpenStreetMap tiles, coloured by verification status, updated over a WebSocket fan-out. Live traffic is real TomTom flow data when a key exists; team GPS is disclosed as unavailable instead of being fabricated."

## Segment 6 — Emergency deployment + team coordination (3:15–4:00)

- **On screen:** Still on `/incidents/{id}` as `admin@astra.dev` (or `dephead@astra.dev`).
- **Click path:**
  1. Sign in as `admin@astra.dev`.
  2. Open the verified incident → scroll to **Dispatch Tasks**.
  3. Create a task: department **Fire** (one of the 7 canonical departments), assign to a response-team user, status OPEN.
  4. Show the task row; patch status OPEN → IN_PROGRESS → DONE.
  5. Scroll to **Incident Lifecycle** → click **Advance to COORDINATING**, then **ACTIVE**.
  6. Show **Close incident** is refused while tasks are open (error message from the server) — close only when all tasks DONE, then **RESOLVED**.
- **Say:** "Department Heads see only their department's tasks; Response Teams see only assigned tasks. Phases are strictly NONE → COORDINATING → ACTIVE → RESOLVED, and an incident cannot close while tasks are open. The server enforces this, not the UI."

## Segment 7 — Simulation engine (4:00–4:30)

- **On screen:** Nav → **Simulation Center** (`/simulation`).
- **Click path:**
  1. Scenario Type: **Flooding**; Hazard Category: **Flood/Waterlogging**.
  2. Location: "Yamuna Floodplain, Delhi"; Impact Radius slider → 8 km; Intensity → 70 (High).
  3. Click **▶ Run Simulation**.
  4. Show the four StatCards: Affected Area (km²), People Affected, Key Infrastructure, Estimated Damage (₹ Cr).
  5. Point at the footer line: "HAZUS-lite deterministic model…" and "Runs on isolated sim_* tables only and never modifies a live incident."
- **Say:** "The simulation is a documented heuristic — affected area, population estimate, infrastructure count, damage estimate — labelled 'Not a real forecast'. It writes only to isolated sim_* tables with zero foreign keys into live data, so a simulation can never corrupt an incident."

## Segment 8 — Final impact statement (4:30–5:00)

- **On screen:** Dashboard (`/dashboard`) with real counted stats; or the map one last time.
- **Say:** "ASTRA turns citizen reports into verified, coordinated response over a real road graph — 406,154 nodes, 879,902 edges, Dijkstra routing, 130 backend tests, 6 Playwright E2E tests, honest degraded states instead of fake data. Gnani Prisma STT is live in the product path; Gnani Timbre TTS reads assistant answers aloud. Built by Hasan Siddique (backend) and Lubna Suhail Quadri (frontend) for the Great Indian AI Internship Challenge 2026."

## Timing budget

| Segment | Duration |
|---|---|
| 1 Problem statement | 0:30 |
| 2 Citizen report + voice (Gnani STT) | 1:00 |
| 3 Image evidence analysis | 0:30 |
| 4 Officer verification | 0:45 |
| 5 Live map updates | 0:30 |
| 6 Emergency deployment + coordination | 0:45 |
| 7 Simulation engine | 0:30 |
| 8 Final impact | 0:30 |
| **Total** | **~5:00** |

## Notes for the recorder

- Record at 1080p; keep the browser chrome visible so URLs are legible.
- If Gnani STT is slow, pre-record the voice clip and paste the transcript manually only as a fallback — prefer the live path.
- If a provider key is missing, let the honest "unavailable" state show; do not fake success.
- Never claim "live feed" on a dead socket; the `/ws/map` channel is the real transport.
