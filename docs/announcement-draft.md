# ASTRA — LinkedIn / X Announcement (copy-paste ready)

> Post as-is or lightly edit. Replace `<REPO_URL>` and `<DEMO_VIDEO_URL>` before posting.

---

**ASTRA — Advanced Spatial Technology for Response Assistance** is live.

ASTRA is a role-based emergency-response platform for Delhi-NCR: citizens file text, photo and voice reports with geolocation; an AI assistant triages them; verification officers approve or reject with reasons; department heads and response teams coordinate dispatch; central admins close incidents only when every task is done. Everything runs over a real OpenStreetMap road graph — 406,154 nodes and 879,902 directed edges with Dijkstra routing — with honest degraded states (live traffic and team GPS are disclosed as unavailable when no provider or position exists, never faked) and no dummy data.

Gnani AI is wired in end to end: **Gnani Prisma STT** turns a citizen's recorded voice (OGG, transcoded to 16 kHz WAV server-side) into the incident description, and **Gnani Timbre TTS** reads assistant answers aloud through a "Listen" button. The assistant LLM chain (Groq → OpenRouter → NVIDIA → deterministic rules stub) names the engine that answered on every reply, so a canned string can never pass for a model's output.

Technical highlights:
- Real OSM raster tiles + real Dijkstra polylines; "no route between these points" for disconnected pairs instead of a fabricated straight line.
- Memory-engineered routing graph (~167 MB resident, fits a 512 MB free-tier container) via forward-star flat arrays.
- Honest degradation everywhere: LLM → rules_stub with the truth in `assessments.backend`; simulation labelled "Not a real forecast" on isolated `sim_*` tables; graph status "loading" in `/health`.
- 130 backend tests (real Postgres + Redis), 7 vitest, 6 Playwright E2E including a latency-bound trust-arc test (citizen report → pin via WebSocket < 1000 ms → officer verifies → pin flips green < 1000 ms).

Built by **Hasan Siddique** (backend lead — FastAPI, SQLAlchemy, OSM routing, Gnani voice proxy, LLM chain, tests) and **Lubna Suhail Quadri** (frontend lead — Next.js 16, Leaflet map, Zustand, typed fetch client, Playwright E2E). Submitted for the Great Indian AI Internship Challenge 2026.

Repo: <REPO_URL>
Demo video: <DEMO_VIDEO_URL>

#GnaniAI #GreatIndianAIInternshipChallenge2026 #ASTRA #EmergencyResponse #AI
---

## Posting notes

- LinkedIn: paste the block above verbatim; attach the 5 trust-arc screenshots (`web/trust-arc-*.png`) as a carousel.
- X/Twitter: trim to the first two paragraphs + hashtags; link the repo and video.
- Do not post until the demo video URL is public and the Gnani key has been rotated.
