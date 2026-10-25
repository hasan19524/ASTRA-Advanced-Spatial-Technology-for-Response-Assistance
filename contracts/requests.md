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
| 11 | `POST /incidents/{id}/verify` · `/reject` | Officer queue | ⬜ |
| 12 | `GET /verification/queue` | Officer dashboard | ⬜ |
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
- _(add here, never straight into code)_
