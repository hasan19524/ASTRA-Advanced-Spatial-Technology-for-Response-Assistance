# Contracts — Frontend → Backend Requests

> **How this works:** B writes what they need here (screen → data shape → when needed).
> A implements in FastAPI, updates `openapi.json`, and marks it ✅.
> B regenerates types each morning → compile errors tell you what changed.
> Rule: no endpoint merges without regenerating `contracts/types.ts`.

## Status legend
- ⬜ requested
- 🟡 in progress
- ✅ shipped (in `openapi.json`)

---

## Convention (agreed Day 1)

- Base URL (dev): `http://localhost:8000` · Web: `http://localhost:3000`
- Auth: `Authorization: Bearer <access_token>` (refresh via httpOnly cookie or body — A picks Day 1 and notes it here)
- Errors: `{ "detail": string, "code"?: string }` with proper status codes
- List endpoints: `{ items: T[], total: number, page: number, page_size: number }`
- Timestamps: ISO-8601 UTC
- All money/geo/time decisions logged below, not in DMs

---

## Day 1–2 (auth + shell)

| # | Endpoint | Used by (screen) | Status |
|---|---|---|---|
| 1 | `POST /auth/register` | Signup page | ⬜ |
| 2 | `POST /auth/login` → `{access_token, refresh_token, user}` | Login | ⬜ |
| 3 | `POST /auth/refresh` | Silent session refresh | ⬜ |
| 4 | `GET /me` → `{id, name, role, permissions[]}` | Route guard, sidebar | ⬜ |
| 5 | `GET /audit/logs` (admin only) | Audit viewer | ⬜ |

## Day 3–5 (Module 1)

| # | Endpoint | Used by | Status |
|---|---|---|---|
| 6 | `POST /incidents` (text + photo multipart) | Citizen report form | ⬜ |
| 7 | `GET /incidents?status=&bbox=&page=` | List + map layer | ⬜ |
| 8 | `GET /incidents/{id}` → 4-axis status + history | Detail page | ⬜ |
| 9 | `WS /ws/incidents` (public pins) | Live map | ⬜ |
| 10 | `GET /incidents/{id}/poll` · `POST .../poll/vote` | Poll card | ⬜ |
| 11 | POST /incidents/{id}/verify (verdict VERIFIED|REJECTED) + POST /incidents/{id}/reopen | Officer queue | done |
| 12 | GET /verification/queue (filters assessment, min_age_minutes, urgency) | Officer dashboard | done |
| 13 | `POST /incidents/{id}/tasks` · `PATCH /tasks/{id}` | Admin/Dept dashboards | ⬜ |
| 14 | `POST /incidents/{id}/close` | Central Admin | ⬜ |
| 15 | `GET /alerts` · `POST /alerts/subscriptions` | Alerts center | ⬜ |
| 16 | `WS /ws/alerts` | Notification toasts | ⬜ |
| 17 | `GET /stats/overview?role=` | Dashboard cards | ⬜ |

## Day 6–7 (maps + voice)

| # | Endpoint | Used by | Status |
|---|---|---|---|
| 18 | `GET /map/layers/{roads,buildings,closures}.geojson` | Leaflet layers | ⬜ |
| 19 | `POST /route` `{origin, destination}` → polyline + steps | Route planner | ⬜ |
| 20 | `POST /voice/stt` (multipart audio) | Report form, assistant | ⬜ |
| 21 | `WS /voice/stt/stream` | Live transcription | ⬜ |
| 22 | `POST /voice/tts` `{text, voice}` → audio (SSE/WS) | Voice nav, assistant | ⬜ |

## Day 8–9 (assistant + simulations)

| # | Endpoint | Used by | Status |
|---|---|---|---|
| 23 | `WS /ws/assistant` (stream, + tool events) | Chat UI | ⬜ |
| 24 | `POST /assistant/handoff` → draft incident | "Draft a report" flow | ⬜ |
| 25 | `POST /simulations` · `GET /simulations/{id}` | Scenario wizard | ⬜ |
| 26 | `GET /simulations/{id}/results` | Results panel + overlay | ⬜ |

---

## Notes / decisions log
- *(A)* Auth token storage decision: _TBD Day 1_
- *(A)* Map GeoJSON granularity: _TBD Day 6_
- *(B)* Types generated via: `npm run contracts:sync` → `web/src/api/types.ts`

## Parking lot (ideas NOT built without discussion)

Decisions raised while planning Phase 2 — **all resolved 2026-11-02 by Hasan**. Recorded here so
the choice survives; the matching AD entries land in `docs/architecture.md` alongside the code
that implements them (an AD documents something that is *built*, not merely intended).

| # | Decision | **RESOLUTION** | Why it needed a human |
|---|---|---|---|
| PL-7 | Is skipping `IN_PROGRESS` legal on a task? | ✅ **YES.** `OPEN → IN_PROGRESS → DONE`, plus `OPEN → DONE` direct. **Any backwards move → 409.** Forward is allowed because real dispatch skips steps; backwards is what actually lies. | Changed the dispatch state machine |
| PL-8 | Can an incident close while tasks are still open? | ✅ **NO.** `POST /incidents/{id}/close` → **409 returning the open task ids**; the UI blocks and lists them. Vision §F: rescue done ≠ bridge repaired. | Premature closure would lie to the admin |
| PL-9 | Can `response_phase` skip a step? | ✅ **NO.** Strict `NONE → COORDINATING → ACTIVE → RESOLVED`, one step, never backwards. Skips and regressions → 409. | Locked axis; loosening it later is a contract break |
| PL-10 | Are `stats/overview` counts role-scoped? | ✅ **YES.** Citizens: public-safe aggregates only (no `hidden`, no `restricted`). Dept head: own department. Admin + officer: everything. | Guessing leaks operational data to citizens (vision §10) |
| PL-11 | Exact formula for `poll_participation_rate` | ✅ **distinct voters ÷ eligible-incident count.** Caption Lubna ships: *"Poll participation across eligible incidents."* | The label must be agreed, not invented |
| PL-12 | Mock layer fate — delete, or keep behind `NEXT_PUBLIC_USE_MOCKS=1`? | ✅ **RESOLVED by shipped code** — Lubna made it opt-in in `c753b32` (`client.ts` L15/L114). Shipped code wins. | Hard rule 5 forbids a UI claiming what the system didn't do |
| PL-13 | Traffic / weather data source | ✅ **OMIT.** No approved free source in `docs/research-existing-apps.md`; faking weather would violate hard rule 5. Closures are real (our own incidents) and stay. | Better an honest gap than invented data |
| PL-14 | Simulation damage/impact model | ✅ **Simple documented heuristics** — per-category damage/cost factors × affected population from seeded NCR data. Deterministic, explainable, **visibly labelled an estimate, with its factors shown in the UI**. | Was a design decision, now made |
| PL-15 | Browser Web Speech API as the no-key voice fallback | ✅ **MOOT** — Gnani STT/TTS confirmed live 2026-11-02 (plan §7.2). A real provider beats a browser fallback. | Would have been a frontend tech addition |
| PL-16 | Alternate LLM provider if Evon fails | ⏸ **HELD until PL-17 resolves.** Don't add a dependency before knowing whether we need one. Evon returns 403, not 404 — the endpoint exists. | New dependency — requires discussion |

**RESOLVED 2026-11-02 — hybrid approach (Hasan's call):**
| PL-17 | Gnani key has **no Evon/LLM scope** (and the console exposes no toggle) | Evidence: `POST /v1/chat/completions` → 403 `SCOPE_NOT_ALLOWED`, identical across 6 variants → key/plan limitation, not a request bug. The 30B Evon is also too large to self-host cheaply. **Decision: keep Gnani for STT/TTS (real, working) and use Groq (already wired as the default OpenAI-compatible base URL in config) for the assistant LLM.** `LLM_API_KEY` + `LLM_MODEL` in `.env` is all that's needed — the existing `LlmBackend` already degrades gracefully. Assistant moves T4 → T3 (real, with degradation). **Rotate the Gnani key** — it was pasted in plaintext. | Proven, not opined — see `docs/plan-phases.md` §7.2 |

_(add here, never straight into code)_
