# ASTRA — Master plan (phases, continuous run)

> Status: **DRAFT — awaiting Hasan's sign-off.** Nothing here is law until Hasan approves it.
> This file supersedes the Day 5–12 entries in `docs/tasks/README.md` for *scheduling only* —
> it does not change any locked architecture decision (AD-1…AD-23 stay locked).
> Written 2026-11-02. Days 5–7 (10-30 … 11-01) were not worked; the 12-day table no longer
> describes reality. We now run **phases**, continuously, not calendar days.

---

## 0. The problem this plan solves

Two people, one repo, working in parallel on opposite ends of the same feature. The failure
mode we have already hit once is a **merge that doesn't attach**: Lubna builds a component
against a shape she guessed, Hasan builds an endpoint against a shape he chose, and they meet
on demo day.

The fix is an **interface freeze**: every shared shape — API response, Zustand store state,
component props — is written down *before* either side builds. Then:

- Lubna codes against declared types. A missing endpoint is a **TypeScript error**, not a
  surprise.
- Hasan codes against the same declared types. A frontend that needs more is a **contract
  change**, not a Slack message.
- Attachment at merge time is mechanical.

`contracts/openapi.json` stays the law. This document adds the two layers it does not cover:
**store shapes** and **component props**.

---

## 1. Mock-vs-real policy (locked on sign-off)

`AGENTS.md` hard rule 5 already forbids a UI claiming what the system did not do. The current
`web/src/api/client.ts` violates it — real 404/501 responses are silently replaced by fixture
rows, so a broken feature looks identical to a working one.

Every feature is classified into exactly one tier. Nothing ships unclassified.

| Tier | Meaning | UI contract | Test contract |
|---|---|---|---|
| **T1 REAL** | Postgres row → FastAPI endpoint → typed client → page | Real data, real error states | pytest + contract test + Playwright |
| **T2 REAL-COMPUTED** | Real seeded data, **our** algorithm (Dijkstra, rules assessment) | Real, labelled "computed by ASTRA" | pytest on the algorithm + E2E |
| **T3 PROVIDER-OR-RULES** | Real provider when a key exists, deterministic fallback otherwise; `assessments.backend` records which | Real, shows which backend answered | pytest with mocked transport + live smoke when a key exists |
| **T4 DEGRADED-HONEST** | Not built / no key. Renders an explicit unavailable state **with the reason**. | Never fake data | Playwright asserts the degraded state renders |
| **T5 DELETE** | The mock layer itself | Gone | — |

### Classification by feature

**Module 1 — everything T1. Zero dummy.**

| Feature | Tier | Note |
|---|---|---|
| Incidents, duplicate grouping, evidence | T1 | already real |
| Poll | T1 | API real today, UI missing |
| Verification + queue | T1 | API real today, UI missing |
| `/ws/map` live feed | T1 | already real |
| Tasks / assignments / progress | T1 | Phase 2 |
| Alerts (CAP-shaped) | T1 | tables + seed exist, no router |
| `stats/overview` | T1 | dashboard KPIs hardcoded today |
| Audit log viewer | T1 | rows written, no endpoint |

**Module 2 — gated on the Gnani spike (Phase 0).**

| Feature | Spike passes | Spike fails |
|---|---|---|
| Report assessment | T3 Evon → rules (already built) | T3 rules-only |
| Assistant chat | T3 real LLM | T4 "assistant unavailable — API key not configured" |
| STT / TTS | T3 Prisma + Timbre | T4, unless browser Web Speech API is approved (stack change → discussion) |

**Module 3 — mostly real and free.**

| Feature | Tier | Note |
|---|---|---|
| Leaflet + OSM raster tiles | T1 | no key needed, pure frontend |
| Road/building graph | T2 | **real Geofabrik Delhi NCR extract, clipped small — APPROVED 2026-11-02** |
| Dijkstra routing | T2 | real algorithm, closure-aware — our actual differentiator |
| Road closures | T1 | driven by our own incidents/admin — genuinely real |
| Traffic / weather | T4 🚫 OPEN | no approved source; propose omit rather than fake |

**Module 4 — real code, hypothetical data.**
Isolation is structurally enforced (AD-3 + a test proving sim tables carry no FKs into live).
The UI must never share a screen with live pins and must carry a persistent SIMULATION badge.
🚫 The damage model itself is an open design decision.

---

## 2. The attachment surface (exact values)

### 2.1 Canonical types — `web/src/api/types.ts`

Generated from `contracts/openapi.json` via `npm run contracts:sync`. These are the names both
sides must use.

```ts
// ── Identity ──────────────────────────────────────────────────────────────
type Role = "CITIZEN" | "CENTRAL_ADMIN" | "DEPARTMENT_HEAD"
          | "RESPONSE_TEAM" | "VERIFICATION_OFFICER"
interface UserOut { id: string; email: string; name: string; role: Role; permissions: Permission[] }

// ── Incident (shipped) ────────────────────────────────────────────────────
type AssessmentStatus = "UNASSESSED" | "DEFINITELY_FALSE" | "MAYBE_TRUE"
type Visibility       = "HIDDEN" | "PUBLIC_UNVERIFIED"
type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED"
type ResponsePhase    = "NONE" | "COORDINATING" | "ACTIVE" | "RESOLVED"
type Lifecycle        = "OPEN" | "CLOSED"
type Sensitivity      = "PUBLIC" | "RESTRICTED"

interface IncidentOut {
  id: string; title: string; description: string; category: string; region: string
  lat: number | null; lon: number | null
  assessment_status: AssessmentStatus; visibility: Visibility
  verification: VerificationStatus; response_phase: ResponsePhase; lifecycle: Lifecycle
  report_count: number; sensitivity: Sensitivity
  created_at: string; updated_at: string
}
interface IncidentDetailOut extends IncidentOut {
  reports: IncidentReportOut[]; assessments: AssessmentOut[]
  verification_events: VerificationEventOut[]; tasks: TaskOut[]
}
interface IncidentPageOut { items: IncidentOut[]; total: number; page: number; page_size: number }

// ── Poll (shipped backend) ────────────────────────────────────────────────
interface PollOut {
  eligible: boolean; reason: string | null
  my_vote: "genuine" | "fake" | null
  genuine: number; fake: number; percent_genuine: number
}
interface PollVoteIn { vote: "genuine" | "fake" }

// ── Verification (shipped backend) ────────────────────────────────────────
interface VerdictIn   { verdict: "VERIFIED" | "REJECTED"; reason?: string }
interface ReopenIn    { reason: string }
interface VerificationEventOut {
  id: string; action: "VERIFIED" | "REJECTED" | "REOPENED"
  reason?: string; officer?: string; created_at: string
}

// ── Tasks (NEW — Phase 2) ─────────────────────────────────────────────────
type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE"
interface TaskOut {
  id: string; incident_id: string; title: string; department: string
  status: TaskStatus; assignee_id: string | null; assignee_name: string | null
  created_by: string; created_at: string; updated_at: string
}
interface TaskCreateIn  { incident_id: string; title: string; department: string; assignee_id?: string }
interface TaskPatchIn   { title?: string; status?: TaskStatus; assignee_id?: string | null }
interface TaskUpdateOut { id: string; task_id: string; note: string; status_at_time: TaskStatus; author: string; created_at: string }
interface TaskUpdateIn  { note: string; status?: TaskStatus }

// ── Alerts (NEW — Phase 2, CAP-shaped per research §3) ────────────────────
type AlertSeverity = "MINOR" | "MODERATE" | "SEVERE" | "EXTREME"
type AlertUrgency  = "EXPECTED" | "FUTURE" | "IMMEDIATE"
type AlertCertainty = "OBSERVED" | "LIKELY" | "POSSIBLE"
interface AlertOut {
  id: string; event: string; headline: string; description: string
  severity: AlertSeverity; urgency: AlertUrgency; certainty: AlertCertainty
  region: string; onset: string | null; expires: string | null; created_at: string
}
interface AlertCreateIn { event: string; headline: string; description: string
  severity: AlertSeverity; urgency: AlertUrgency; certainty: AlertCertainty
  region: string; onset?: string; expires?: string }
interface AlertPrefOut { region: string; enabled: boolean }
interface AlertPrefIn  { region: string; enabled: boolean }

// ── Stats (NEW — Phase 2) ─────────────────────────────────────────────────
interface StatsOut {
  incidents_total: number; unverified: number; verified: number
  rejected: number; hidden: number
  by_category: Record<string, number>
  by_verification: Record<VerificationStatus, number>
  tasks_open: number; tasks_in_progress: number; tasks_done: number
  response_active: number; poll_participation_rate: number
}

// ── Audit (NEW — Phase 2) ─────────────────────────────────────────────────
interface AuditLogOut { id: string; actor: string; action: string; method: string
  path: string; status_code: number; created_at: string }
interface AuditPageOut { items: AuditLogOut[]; total: number; page: number; page_size: number }

// ── Map & routing (NEW — Phase 3) ─────────────────────────────────────────
type MapLayerName = "roads" | "buildings" | "closures"
interface GeoJsonOut { type: "FeatureCollection"; features: unknown[] }
interface RouteIn    { origin: [number, number]; destination: [number, number] }
interface RouteStep  { instruction: string; distance_m: number; turn: "left" | "right" | "straight" | "uturn" }
interface RouteOut {
  distance_m: number; duration_s: number
  polyline: [number, number][]; steps: RouteStep[]; blocked_by: string[]
}

// ── Voice (NEW — Phase 4) ─────────────────────────────────────────────────
interface SttOut { transcript: string; language: string; model: string; latency_ms: number }
interface TtsIn  { text: string; voice: string; language: string }

// ── Assistant (NEW — Phase 4) ─────────────────────────────────────────────
interface AssistantMessageOut { id: string; role: "user" | "assistant"; text: string; created_at: string }
interface AssistantIn { text: string; conversation_id?: string }

// ── Simulations (NEW — Phase 5) ───────────────────────────────────────────
type SimMode = "PUBLIC" | "OPERATIONAL"
interface SimRunOut { id: string; name: string; mode: SimMode; scenario: string; status: string; created_at: string }
interface SimResultsOut {
  affected_area_km2: number; population_affected: number
  tasks_recommended: number; blocked_routes: RouteOut[]; est_cost_inr: number
}
```

### 2.2 Store contracts — `web/src/stores/`

**Every store uses the same async envelope.** No store invents its own shape.

```ts
interface ApiError { status: number; detail: string }   // never a raw string
interface Async<T> { data: T | null; loading: boolean; error: ApiError | null }

type WsState = "idle" | "connecting" | "connected" | "reconnecting" | "offline"
```

| Store | State (exact keys) | Actions (exact signatures) |
|---|---|---|
| `auth.ts` | `user: Async<UserOut>`, `accessToken: string \| null` | `login(email,pw)`, `signup(...)`, `demoLogin(email)`, `logout()`, `refresh()`, `has(p: Permission): boolean` |
| `incidents.ts` | `items: IncidentOut[]`, `total`, `page`, `filters: IncidentFilters`, `ws`, `wsState: WsState`, `loading`, `error` | `load(reset?: boolean)`, `setFilters(f)`, `upsert(i: IncidentOut)`, `connectWs()`, `disconnectWs()` |
| `incidentDetail.ts` **NEW** | `incident: Async<IncidentDetailOut>` | `load(id: string)`, `patch(i: IncidentDetailOut)` |
| `poll.ts` **NEW** | `poll: Async<PollOut>` | `load(incidentId: string)`, `vote(v: "genuine"\|"fake")` |
| `verification.ts` **NEW** | `queue: IncidentOut[]`, `total`, `filters: QueueFilters`, `busy: boolean`, `error` | `loadQueue(f?)`, `verify(id, in: VerdictIn)`, `reject(id, in: VerdictIn)`, `reopen(id, in: ReopenIn)` |
| `tasks.ts` **NEW** | `items: TaskOut[]`, `total`, `loading`, `error` | `loadByIncident(id)`, `create(in: TaskCreateIn)`, `patch(id, in: TaskPatchIn)`, `addUpdate(id, in: TaskUpdateIn)` |
| `alerts.ts` **rework** | `items: Async<AlertOut[]>`, `prefs: AlertPrefOut[]`, `ws`, `wsState: WsState`, `unread: number` | `load()`, `loadPrefs()`, `subscribe(region)`, `unsubscribe(region)`, `connectWs()` |
| `stats.ts` **NEW** | `stats: Async<StatsOut>` | `load()` |
| `map.ts` | `center`, `zoom`, `layers: Record<MapLayerName, boolean>`, `route: Async<RouteOut>` | `setCenter`, `toggleLayer(l)`, `calculateRoute(in: RouteIn)` |
| `assistant.ts` **rework** | `messages: Async<AssistantMessageOut[]>`, `conversationId: string \| null`, `busy: boolean`, `streaming: boolean` | `send(text)`, `reset()`, `handoff(text)` |
| `simulations.ts` **NEW** | `runs: SimRunOut[]`, `current: Async<SimRunOut>`, `results: Async<SimResultsOut>`, `busy` | `create(in)`, `load(id)`, `loadResults(id)` |

**Store rules (both sides):**
1. A store never holds a `string` for `error` — always `ApiError` or `null`.
2. `upsert()` replaces by `id`, never appends. WS-created items must not duplicate.
3. `wsState` is the **only** source for any "live" label in the UI. A dead socket renders
   "offline", never "live".
4. Stores never read from `lib/mocks/`.

### 2.3 Component contracts — `web/src/components/`

**Rule: presentational components fetch nothing.** They take data + callbacks. Pages (containers)
own fetching via stores. This is the single rule that makes late attachment work.

```
components/
├─ ui/          Button, Card, DataTable, EmptyState, Modal, RoleGate,
│               StatCard, StatusBadge, Toast        ← already built, reuse as-is
├─ incident/    AxisBadges, IncidentCard, IncidentTable, IncidentFilters,
│               AssessmentTimeline, ReportsList, EvidenceGallery
├─ poll/        PollCard, PollBar, VoteButton
├─ verify/      QueueTable, QueueFilters, VerdictPanel, ReopenPanel, VerificationTimeline
├─ task/        TaskList, TaskRow, TaskCreateForm, TaskStatusSelect,
│               AssigneeSelect, TaskUpdateForm
├─ alert/       AlertBanner, AlertList, AlertPrefForm
├─ map/         IncidentMap (replaces MapPlaceholder), MapLayerControl,
│               RoutePanel, MapLegend
├─ stats/       StatGrid, CategoryBreakdown
├─ assistant/   ChatPanel, MessageBubble, Composer, LanguageSelect
└─ sim/         ScenarioWizard, SimResultsPanel, SimOverlay
```

Prop interfaces for the surfaces that both sides touch:

```tsx
// PollCard — attaches to usePoll (Lubna builds, Hasan's API already exists)
<PollCard
  incidentId: string
  poll: PollOut | null
  loading: boolean
  error: ApiError | null
  onVote: (v: "genuine" | "fake") => void
  disabled: boolean
/>

// VerdictPanel — officer + admin only (can("incident.verify"))
<VerdictPanel
  incidentId: string
  verification: VerificationStatus
  busy: boolean
  error: ApiError | null
  onVerify: (reason?: string) => void
  onReject: (reason: string) => void        // reason required, non-empty
  onReopen: (reason: string) => void        // never rendered when verification === "VERIFIED"
/>

// VerificationTimeline — all roles
<VerificationTimeline
  events: VerificationEventOut[]            // API strips reason/officer for citizens
/>

// TaskList
<TaskList
  tasks: TaskOut[]
  canAssign: boolean                        // can("task.assign")
  canUpdate: boolean                        // can("task.update")
  departments: string[]                     // from lib/constants DEPARTMENTS
  usersByDept: Record<string, UserOut[]>    // for AssigneeSelect
  onCreate:  (in: TaskCreateIn) => void
  onPatch:   (id: string, in: TaskPatchIn) => void
  onUpdate:  (id: string, in: TaskUpdateIn) => void
/>

// IncidentMap — replaces MapPlaceholder
<IncidentMap
  incidents: IncidentOut[]                 // caller pre-filters PUBLIC + PUBLIC_UNVERIFIED
  route: RouteOut | null
  layers: Record<MapLayerName, boolean>
  wsState: WsState                          // drives the live/offline label
  onMove: (center: [number, number], zoom: number) => void
  onIncidentClick: (id: string) => void
/>

// AlertBanner — top-level, mounts in AppShell
<AlertBanner
  alerts: AlertOut[]                        // IMMEDIATE + subscribed regions only
  onDismiss: (id: string) => void
  onOpen: (id: string) => void
/>

// Degraded state — every T4 feature renders THIS, never fake data
<UnavailableState
  feature: string                           // "Voice reporting"
  reason: string                            // "Gnani API key not configured"
  docsPath?: string
/>
```

---

## 3. Phases

Each phase is a **vertical slice**: backend endpoint → contract → store → component → test.
Both people work the same phase at the same time, on their own side. A phase is done when its
E2E proof runs green on the real stack.

### Phase 0 — Establish ground truth
**Owner: Hasan.** Lubna continues her current work in parallel; nothing here blocks her.

| # | Task | Output |
|---|---|---|
| 0.1 | Pull Lubna's push, read it fully | Written critique: what's real, what's mock, what's broken |
| 0.2 | **Gnani spike — time-boxed 90 min, hard stop** | GO/NO-GO on voice + LLM |
| 0.3 | Decide the mock-layer policy (after reading 0.1) | Signed-off: delete, or `NEXT_PUBLIC_USE_MOCKS=1` only |
| 0.4 | Diagnose the task module | Concrete critique + proposed redesign for your sign-off |

**0.2 exact commands** (from `Planning/gnani-research.md` §2):

```bash
# STT — Prisma v2.5
curl -X POST https://api.vachana.ai/stt/v3 \
  -H 'X-API-Key-ID: <KEY>' \
  -F audio_file='@sample-hi.wav' -F language_code=hi-IN

# TTS — Timbre v2.5
curl -X POST https://api.vachana.ai/api/v1/tts/inference \
  -H 'Content-Type: application/json' -H 'X-API-Key-ID: <KEY>' \
  -d '{"text":"नमस्ते","voice":"Nalini","model":"timbre-v2.5","language":"hi-IN",
       "speed":1.0,"audio_config":{"sample_rate":48000,"num_channels":1,
       "sample_width":2,"encoding":"linear_pcm","container":"wav"}}' \
  --output response.wav

# Evon — LLM (open question: is a chat endpoint exposed, or self-host only?)
curl -sS https://api.vachana.ai/v1/chat/completions -H 'X-API-Key-ID: <KEY>' ...
```

Log per call: HTTP status, wall-clock latency, transcript/audio validity. If Evon has no chat
endpoint, Module 2 assessment stays on the **real rules stub** (legitimately real, just not LLM)
and the assistant goes T4 unless another LLM key is approved by discussion.

**Phase 0 exit:** voice GO/NO-GO, mock policy signed off, task-module critique delivered.

---

### Phase 1 — Interface freeze
**Owner: Hasan. Lubna consumes; she does not build against unfrozen shapes.**

| # | Task | Output |
|---|---|---|
| 1.1 | Land every NEW contract in `contracts/openapi.json` (tasks, alerts, stats, audit) | OpenAPI updated |
| 1.2 | Run `npm run contracts:sync` | `types.ts` compiles, all names in §2.1 exist |
| 1.3 | Publish store + component signatures (§2.2, §2.3) | Both devs agree in writing |
| 1.4 | Agree the `Async`/`ApiError` envelope | No store invents its own shape |

**Phase 1 exit:** `npm run build` clean with the new types, both devs have read and agreed §2.

---

### Phase 2 — Module 1 closeout (the trust + dispatch arc)
**Target: everything T1, zero dummy.**

**Backend (Hasan):**

| Endpoint | Behaviour |
|---|---|
| `POST /incidents/{id}/tasks` | perm `task.create`; admin + dept head; scoping by department |
| `PATCH /tasks/{id}` | perm `task.update`; status transition via `incident_state`; **task completion never writes `lifecycle`** |
| `POST /tasks/{id}/updates` | perm `progress.update`; appends `TaskUpdate`, never mutates history |
| `POST /incidents/{id}/close` | perm `incident.close`; **Central Admin only**; calls `set_lifecycle` |
| `POST /incidents/{id}/phase` | perm `incident.close`; NONE→COORDINATING→ACTIVE→RESOLVED, legal moves only |
| `GET /alerts` | perm `alert.view`; caller's subscribed regions |
| `POST /alerts` | perm `alert.manage` |
| `POST /alerts/subscriptions` | upsert `UserAlertPref` |
| `WS /ws/alerts` | same `?token=` handshake as `/ws/map` (AD-10) |
| `GET /stats/overview` | perm `stats.view`; real SQL aggregates |
| `GET /audit/logs` | perm `audit.read`; admin + officer |

**Frontend (Lubna):** poll card · officer queue · investigation view · verification timeline ·
`incident.updated` handling · server-side demo login · tasks UI · alerts center · dashboard stats.

**Invariants to prove in tests** (vision §3, architecture §3):
- poll votes never write `verification`
- task completion never writes `lifecycle`
- verification never writes `assessment`/`visibility`/`lifecycle`/poll
- only Central Admin closes an incident

**Phase 2 E2E proof (Playwright, real stack):**
```
citizen:  login → report → MAYBE_TRUE → PUBLIC_UNVERIFIED pin < 1s → vote
officer:  queue → investigate → VERIFIED
all:      pin + badge flip on map and list < 1s
admin:    create task → assign → team member marks DONE → phase ACTIVE → close
```

---

### Phase 3 — Maps & routing
**Approved: real Geofabrik Delhi NCR extract, clipped small (~3–5 km bbox around Connaught
Place, target 500–2000 nodes/edges).**

**Backend (Hasan):**

| Deliverable | Detail |
|---|---|
| `scripts/import-osm.py` | Geofabrik Northern-Zone extract → clip bbox → `MapLocation` + `RoutingEdge` |
| In-memory adjacency at startup | per AD-4; rebuild on weight change |
| `GET /map/layers/{roads,buildings,closures}.geojson` | perm `map.view` |
| `POST /route` | real Dijkstra, closure-aware; `blocked_by` names the incidents that blocked it |
| `GET /incidents?bbox=` | the missing geo filter (contract #7) |
| Closure weight injection | an incident closure sets edge weight to ∞ → re-route |

**Frontend (Lubna):** real Leaflet replacing `MapPlaceholder` · layer controls that actually
render · route panel · legend distinguishing UNVERIFIED vs VERIFIED (vision §588) · live closures.

**Phase 3 E2E proof:**
```
create incident on a road → that edge closes → request a route across it
→ polyline visibly detours → blocked_by names the incident → timed
```
This is the demo moment. It only works because the algorithm is real.

---

### Phase 4 — Voice & assistant
**Gated entirely on the Phase 0 spike. Do not start until the GO/NO-GO is recorded.**

**If GO:** `POST /voice/stt`, `POST /voice/tts`, `WS /ws/assistant`, `POST /assistant/handoff`
→ assistant page, mic on the report form, TTS playback, language selector (AD-16: BCP-47 codes
passed through untouched).

**If NO-GO:** every voice feature renders `UnavailableState` with the reason. **No fake TTS,
no scripted bot pretending to be an LLM.** Reclaim the days into Phase 3/5.

**Assistant hard limits (vision §10):** the assistant may draft a report into the normal
pipeline via `/assistant/handoff`. It may never verify, may never dispatch.

---

### Phase 5 — Simulations
Backend `sim_*` writers (AD-3, no FKs into live) · `POST /simulations` · `GET /simulations/{id}/results`
· frontend ScenarioWizard, results panel, map overlay.

**Non-negotiables:** persistent SIMULATION badge · separate map instance · never a live pin ·
never writes a live incident row (already test-proven).

🚫 **Open:** the damage/impact model. Requires discussion before implementation.

---

### Phase 6 — Dashboards, seed world, consistency, rehearsal
Role-specific dashboards on real `stats/overview` · complete seed world (all 5 roles, all 7
departments, all 8 categories, mixed axis states) · cross-cutting consistency pass ·
demo runbook with a written script · full test sweep.

---

## 4. Testing — frontend → backend → database, one chain

| Layer | Tool | Gate (exact command) |
|---|---|---|
| DB / unit | pytest + real Postgres in Docker | `cd api && pytest` — all green, new endpoints ship tests in the same change |
| Lint | ruff | `cd api && ruff check app tests` — clean |
| Contract | openapi → TS | `cd web && npm run contracts:sync && npm run build` — clean |
| Auth E2E | existing script | `powershell -File scripts/verify-auth.ps1` → EXIT=0 |
| Module E2E | new script | `powershell -File scripts/verify-module1.ps1` → EXIT=0 |
| Frontend unit | Vitest (stores + pure logic) | `cd web && npm run test` — green |
| Browser E2E | Playwright, 2 projects | `cd web && npm run test:e2e` — green |
| **Degraded-state proof** | Playwright with the API stopped | every T4 feature renders its unavailable state; **no blank screen, ever** |

**The "no blank screen" rule becomes a test, not a hope.** Root `error.tsx` + `not-found.tsx`
ship in Phase 2.

**Never count as verification:** mock data · a passing test on a machine without Docker ·
"it looked fine in the browser" without a pasted command + output.

---

## 5. Continuous operating loop

No day numbers. Both devs run this loop per work unit:

```
1. cd <repo> && git rev-parse --show-toplevel   → must end in repo root
2. git pull origin main
3. git log --oneline -1                          → check what landed
4. open your current phase ticket
5. BUILD (backend / frontend — your side only)
6. GATES (section 4) — all green, outputs pasted
7. Write worklog: docs/daily/<name>/<YYYY-MM-DD>.md
   (date = the actual calendar date of the session; header = filename = worklog date)
8. git add -A && git commit && git push origin main
```

**Phase ticket convention (replaces `docs/tasks/<name>/<date>.md`):**
`docs/tasks/<name>/phase-<N>.md` — one file per person per phase, ticked as work lands,
never re-dated. The lead creates them; agents treat them as read-only.

---

## 6. Open decisions — Hasan's call, not mine

| # | Decision | Why I won't decide it |
|---|---|---|
| O1 | Mock layer: delete, or keep behind `NEXT_PUBLIC_USE_MOCKS=1`? | Deferred until Lubna's push lands and I've read her fix |
| O2 | Task module: what's actually wrong with the shape? | Deferred until her push lands; needs a real diagnosis first |
| O3 | Traffic / weather sources | No approved free source; proposing omit rather than fake |
| O4 | Simulation damage model | A design decision, not an implementation one |
| O5 | Browser Web Speech API as the no-key voice fallback | It's a frontend tech addition — the stack is locked (AD-1) |
| O6 | Another LLM provider for the assistant if Evon exposes no chat endpoint | Same — new dependency, needs discussion |
| O7 | Is `docs/plan-phases.md` the right home for this, or does it belong in `contracts/requests.md`'s Parking Lot? | Shared-doc placement is a team convention call |
