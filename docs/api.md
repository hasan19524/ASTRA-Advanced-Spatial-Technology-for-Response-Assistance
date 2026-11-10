# ASTRA — API Reference

All business endpoints are mounted under `/api/v1`. WebSocket channels
(`/ws/map`, `/ws/alerts`) are not prefixed (frozen Day 3 contract). Auth is
`Authorization: Bearer <access>` JWT; auth endpoints are rate-limited per IP
per endpoint. The authoritative contract snapshot is `contracts/openapi.json`;
the frontend consumes generated types from it via `npm run contracts:sync`.

## Base URL

Local development: `http://localhost:8000`

## Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/register` | POST | none | Register citizen account (201) |
| `/api/v1/auth/login` | POST | none | Login; returns access + refresh tokens |
| `/api/v1/auth/demo-login` | POST | none | Demo login, gated by `DEMO_MODE=true` |
| `/api/v1/auth/refresh` | POST | none | Refresh token pair |
| `/api/v1/auth/logout` | POST | none | Stateless no-op; refresh tokens live until expiry (~7 days) |
| `/api/v1/auth/me` | GET | JWT | Current user profile |

Security notes:
- Argon2id password hashing; JWT HS256 access tokens (15 min) + refresh tokens
  (7 days).
- `JWT_SECRET` is required — the app refuses to boot if empty or a known
  default.
- No user enumeration: unknown email gives the same error as wrong password.
- Tampered token → 401; refresh token rejected as access token.

## Incidents

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/incidents` | POST | JWT `report.create` | Submit report (multipart: title, description, category, region?, lat/lon?, photo?) |
| `/api/v1/incidents` | GET | JWT | List incidents (filters, pagination) |
| `/api/v1/incidents/{id}` | GET | JWT | Detail with timeline + assessments |

Notes:
- Every report is auto-assessed (rules stub or LLM backend) before commit;
  `assessments.backend` records which engine decided.
- Duplicate grouping: a report sharing ≥50% token overlap with a same-region,
  same-category incident younger than 30 minutes attaches to the parent
  incident (`grouped: true`) instead of creating a duplicate row.
- Region is validated server-side against `NCR_REGIONS` (422 with the valid
  list for unknown regions).
- Photo uploads: MIME type + 5 MB cap, rejected before touching disk.

## Poll

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/incidents/{id}/poll` | GET | JWT | Poll state (counts per option) |
| `/api/v1/incidents/{id}/poll/vote` | POST | JWT `poll.vote` | Cast vote (one per user, DB-enforced unique constraint) |

Notes:
- Polls open automatically on public UNVERIFIED incidents; restricted incidents
  are never polled.
- One vote per user per incident. Polls never write verification status —
  poll, assessment, verification, and response are four independent axes.

## Verification

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/incidents/{id}/verify` | POST | JWT `incident.verify` | VERIFY or REJECT (reason required for REJECT) |
| `/api/v1/incidents/{id}/reject` | POST | JWT `incident.verify` | Reject with reason |
| `/api/v1/incidents/{id}/reopen` | POST | JWT `incident.verify` | Reopen from VERIFIED |
| `/api/v1/verification/queue` | GET | JWT `incident.verify` | Officer queue (filters, pagination) |

Notes:
- Append-only verification events; reject requires a reason.
- One-way transitions: `UNVERIFIED → VERIFIED | REJECTED`; `REJECTED →
  UNVERIFIED` (reopen); `VERIFIED` terminal; `REJECTED → VERIFIED` directly
  refused.
- Object-level scoping returns 404 (not 403) for restricted/hidden incidents
  — existence stays secret.

## Tasks

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/tasks` | GET | JWT `task.view` | Role-scoped task list |
| `/api/v1/tasks/{id}` | GET | JWT `task.view` | Task detail |
| `/api/v1/tasks/{id}` | PATCH | JWT `task.update` | Patch task (status transitions only) |
| `/api/v1/tasks/{id}/updates` | POST | JWT `task.update` | Add task update |
| `/api/v1/incidents/{id}/tasks` | GET/POST | JWT `task.view`/`task.create` | Tasks for an incident |

Notes:
- Canonical 7 departments enforced server-side (422 otherwise).
- Department Heads see only their department's tasks; Response Teams see only
  assigned tasks.
- Transitions: `OPEN → IN_PROGRESS → DONE` (forward-skip allowed; backwards
  → 409).

## Alerts

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/alerts` | GET | JWT | List alerts |
| `/api/v1/alerts` | POST | JWT `alert.manage` | Create alert |
| `/api/v1/alerts/preferences` | GET/POST | JWT | List / upsert user alert preferences |
| `/api/v1/alerts/preferences/{id}` | DELETE | JWT | Delete own preference |
| `/ws/alerts` | WS | JWT | Alerts channel (implemented server-side, not yet consumed by client) |

Notes:
- Geo-targeting is a union: Central Admin → all NCR regions; department → all
  NCR regions; citizen → enabled `UserAlertPref.region`; empty → broadcasts
  only.
- `area` is validated at write time against `NCR_REGIONS` (422 otherwise).
- Expired alerts are archived (`expired_at`), never hard-deleted.

## Stats / Audit

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/stats/overview` | GET | JWT `stats.view` | Counted stats (all from DB, honest nulls) |
| `/api/v1/audit/logs` | GET | JWT `audit.read` | Append-only audit log (Central Admin only) |

## Voice (Gnani)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/voice/languages` | GET | none | Supported STT/TTS languages |
| `/api/v1/voice/stt` | POST | JWT | Speech-to-text (multipart audio + language_code) |
| `/api/v1/voice/tts` | POST | JWT | Text-to-speech (returns WAV bytes; validated `TtsIn` schema) |

Notes:
- STT proxies `POST https://api.vachana.ai/stt/v3` with header `X-API-Key-ID`
  (not Bearer). Browser audio (WebM/Opus) is transcoded to 16 kHz mono PCM
  WAV server-side via ffmpeg before forwarding. Unsupported formats rejected
  with 422 before burning a Gnani call.
- TTS proxies `POST /api/v1/tts/inference` and returns raw WAV bytes.
- Gnani keys stay server-side; never in `NEXT_PUBLIC_*`, response bodies, or
  logs.

## Weather / Geocode / Routing

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/weather/current` | GET | session + rate-limited | Current weather (OpenWeatherMap) |
| `/api/v1/weather/delhi` | GET | session + rate-limited | All Delhi NCR points |
| `/api/v1/geocode/search` | GET | session + rate-limited | Nominatim geocoding (Delhi viewbox) |
| `/api/v1/route` | GET | JWT | Dijkstra route (`path_coords` included) |
| `/api/v1/route/nearest` | GET | JWT | Snap to routable junction |
| `/api/v1/route/closures` | GET | JWT | Road closures (empty until operator API exists) |
| `/api/v1/traffic/flow` | GET | JWT | TomTom traffic flow (proxied server-side) |

Notes:
- `/weather/*` and `/geocode/search` require a session and are rate-limited
  (they spend third-party quota).
- Routing runs Dijkstra over the real OSM Delhi-NCR graph (forward-star flat
  arrays, ~167 MB resident). Disconnected pairs return an honest "no route
  between these points" instead of a fabricated straight line.

## Simulation

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/simulations` | POST | JWT `simulation.public` | Run heuristic simulation |
| `/api/v1/simulations/{id}` | GET | JWT | Get run (PUBLIC for non-admins) |
| `/api/v1/simulations` | GET | JWT | List runs (PUBLIC only for non-admins) |

Notes:
- Heuristic simulation (PL-14): affected area, population estimate,
  infrastructure count, damage estimate — labelled "Not a real forecast".
- Runs on isolated `sim_*` tables with zero foreign keys into live tables
  (AD-3). Non-admins can only see `mode == "PUBLIC"` runs.

## Assistant

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/assistant/conversations` | POST | JWT | Create conversation |
| `/api/v1/assistant/conversations` | GET | JWT | List own conversations |
| `/api/v1/assistant/conversations/{id}/messages` | GET | JWT | Get messages (owner only) |
| `/api/v1/assistant/conversations/{id}/chat` | POST | JWT | Chat; returns `{"reply", "provider"}` |

Notes:
- Multi-provider LLM chain: Groq → OpenRouter → NVIDIA → rules stub.
- Every reply carries `provider` (`llm:<model>` or `rules_stub`) so the UI
  never presents a canned string as LLM output.
- Conversation ownership is enforced (owner only; 404 hides existence).

## Health / Media

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | none | DB / Redis / routing graph / media status |
| `/uploads/{filename}` | GET | signed URL | Serve evidence photo (HMAC-verified) |

Notes:
- `/health` returns `degraded` when DB/Redis/graph is unavailable — honest
  about cold/failing state.
- Evidence photos served through signed-URL route; API proxies bytes from the
  configured media backend (`local` dev disk / `s3` R2/AWS S3/MinIO prod).

## Rate limiting

Auth endpoints are rate-limited per IP per endpoint
(`AUTH_RATE_LIMIT`/`AUTH_RATE_WINDOW_SECONDS`). Redis-backed counters (`rl:*`);
fail-open when Redis is down.