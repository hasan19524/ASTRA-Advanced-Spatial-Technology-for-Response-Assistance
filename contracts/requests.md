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

Open decisions raised while planning Phase 2 (2026-11-02) — **Hasan's call, not the agents'**.
Each is written into `docs/tasks/hasan/2026-11-02.md` beside the work it affects.

| # | Decision | Proposal on the table | Why it needs a human |
|---|---|---|---|
| PL-7 | Is skipping `IN_PROGRESS` legal on a task? | Yes — `OPEN → DONE` allowed | Changes the dispatch state machine |
| PL-8 | Can an incident close while tasks are still open? | No — 409 listing the open task ids | Vision §F says "rescue done, bridge not repaired"; premature closure lies to the admin |
| PL-9 | Can `response_phase` skip a step? | No — `NONE→COORDINATING→ACTIVE→RESOLVED` only | Locked axis; loosening it later is a contract break |
| PL-10 | Are `stats/overview` counts role-scoped? | Yes — citizens get public-safe aggregates only (no HIDDEN/RESTRICTED), dept heads their department, admin+officer everything | Guessing leaks operational data to citizens (vision §10) |
| PL-11 | Exact formula for `poll_participation_rate` | distinct voters ÷ eligible-incident count | Lubna labels the card from it — the wording must be agreed, not invented |
| PL-12 | Mock layer fate — delete, or keep behind `NEXT_PUBLIC_USE_MOCKS=1`? | Deferred until Lubna's Day 4 push is read | Hard rule 5 forbids the UI claiming what the system didn't do |
| PL-13 | Traffic / weather data source | Propose **omit** rather than fake | No approved free source found in `docs/research-existing-apps.md` |
| PL-14 | Simulation damage/impact model | Not proposed | A design decision, not an implementation one |
| PL-15 | Browser Web Speech API as the no-key voice fallback | **Now moot** — Gnani STT/TTS confirmed live 2026-11-02 (plan §7.2). Real provider beats a browser fallback. | Would have been a frontend tech addition; no longer needed |
| PL-16 | Alternate LLM provider if Evon exposes no chat endpoint | Evon does expose the endpoint — it returns 403 `SCOPE_NOT_ALLOWED`, not 404. **Fix the key's scope first**; only then decide whether a second provider is wanted. | New dependency — requires discussion |

**Action item (not a decision — needs Hasan's hand, not his opinion):**
| PL-17 | Gnani key has **no Evon/LLM scope** | Evidence: `POST /v1/chat/completions` → 403 `SCOPE_NOT_ALLOWED: Service 'None' not in allowed scopes`, identical across 6 header/query variants → the scope comes from the key, not the request. **Fix:** log into app.gnani.ai/voice → key settings → enable the LLM/Evon service, or ask Gnani which tier exposes Evon. Until then the assistant is T4. Also **rotate the key** — it was pasted in plaintext. | Proven, not opined — see `docs/plan-phases.md` §7.2 |

_(add here, never straight into code)_
