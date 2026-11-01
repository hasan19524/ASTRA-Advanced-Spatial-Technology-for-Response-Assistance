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

**Module 2 — the spike ran 2026-11-02; this table is the actual outcome (evidence §7.2).**

| Feature | Tier | Status |
|---|---|---|
| STT (report input, assistant) | **T3** | ✅ **Prisma v2.5 confirmed live** — HTTP 200, 0.19 s e2e, accurate Hindi |
| TTS (voice nav, spoken responses) | **T3** | ✅ **Timbre v2.5 confirmed live** — HTTP 200, 1.12 s, valid WAV |
| Report assessment | **T3 rules-only** | `LlmBackend` is built and needs zero code change; it activates the moment the Evon scope is granted |
| Assistant chat | **T4** | ❌ Evon returns 403 `SCOPE_NOT_ALLOWED` — key has no LLM scope. Fix is in the Gnani console, not the code. Renders `UnavailableState`, never a scripted bot |

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

// ⚠️ Name reconciled to Lubna's shipped code in c753b32. Adopted, not invented —
//    she already has `wsStatus` in stores/incidents.ts. Never re-shape shipped stores.
type WsStatus = "connected" | "reconnecting" | "offline" | null   // null = never connected
```

| Store | State (exact keys) | Actions (exact signatures) |
|---|---|---|
| `auth.ts` | `user: Async<UserOut>`, `accessToken: string \| null` | `login(email,pw)`, `signup(...)`, `demoLogin(email)`, `logout()`, `refresh()`, `has(p: Permission): boolean` |
| `incidents.ts` | `items: IncidentOut[]`, `total`, `page`, `filters: IncidentFilters`, `ws`, `wsStatus: WsStatus`, `loading`, `error` | `load(reset?: boolean)`, `setFilters(f)`, `upsert(i: IncidentOut)`, `connectWs()`, `disconnectWs()` |
| `incidentDetail.ts` **NEW** | `incident: Async<IncidentDetailOut>` | `load(id: string)`, `patch(i: IncidentDetailOut)` |
| `poll.ts` **NEW** | `poll: Async<PollOut>` | `load(incidentId: string)`, `vote(v: "genuine"\|"fake")` |
| `verification.ts` **NEW** | `queue: IncidentOut[]`, `total`, `filters: QueueFilters`, `busy: boolean`, `error` | `loadQueue(f?)`, `verify(id, in: VerdictIn)`, `reject(id, in: VerdictIn)`, `reopen(id, in: ReopenIn)` |
| `tasks.ts` **NEW** | `items: TaskOut[]`, `total`, `loading`, `error` | `loadByIncident(id)`, `create(in: TaskCreateIn)`, `patch(id, in: TaskPatchIn)`, `addUpdate(id, in: TaskUpdateIn)` |
| `alerts.ts` **rework** | `items: Async<AlertOut[]>`, `prefs: AlertPrefOut[]`, `ws`, `wsStatus: WsStatus`, `unread: number` | `load()`, `loadPrefs()`, `subscribe(region)`, `unsubscribe(region)`, `connectWs()` |
| `stats.ts` **NEW** | `stats: Async<StatsOut>` | `load()` |
| `map.ts` | `center`, `zoom`, `layers: Record<MapLayerName, boolean>`, `route: Async<RouteOut>` | `setCenter`, `toggleLayer(l)`, `calculateRoute(in: RouteIn)` |
| `assistant.ts` **rework** | `messages: Async<AssistantMessageOut[]>`, `conversationId: string \| null`, `busy: boolean`, `streaming: boolean` | `send(text)`, `reset()`, `handoff(text)` |
| `simulations.ts` **NEW** | `runs: SimRunOut[]`, `current: Async<SimRunOut>`, `results: Async<SimResultsOut>`, `busy` | `create(in)`, `load(id)`, `loadResults(id)` |

**Store rules (both sides):**
1. A store never holds a `string` for `error` — always `ApiError` or `null`.
2. `upsert()` replaces by `id`, never appends. WS-created items must not duplicate.
3. `wsStatus` is the **only** source for any "live" label in the UI. A dead socket renders
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
  wsStatus: WsStatus                          // drives the live/offline label
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

### Status board — 2026-11-02, after `732a3c6`

| Phase | Scope | State | Next owner |
|---|---|---|---|
| **0** | Ground truth: pull+diagnose, Gnani spike, mock policy | ✅ **DONE** | — |
| **1** | Interface freeze (contracts + store + prop shapes) | 🟡 **shapes published in §2**; `openapi.json` regenerates with Phase 2 endpoints | Hasan |
| **2** | **Module 1 closeout — dispatch arc** (tasks, close/phase, alerts, stats, audit) | 🔴 **NOT STARTED** — both tickets live, zero endpoints built | **both, now** |
| **3** | Maps + routing (Geofabrik clip approved, Leaflet, Dijkstra) | 🔴 not started | Hasan imports graph · Lubna replaces `MapPlaceholder` |
| **4** | Voice + assistant | 🟢 **voice UNBLOCKED — spike confirmed GO** (§7.2). Assistant blocked on PL-17 | Hasan builds `voice/stt`+`voice/tts` · Lubna adds the mic |
| **5** | Simulations | 🔴 not started · 🚫 damage model undecided (PL-14) | blocked on a human decision |
| **6** | Dashboards, seed world, consistency, rehearsal | 🔴 not started | — |

**Immediate critical path: R1 (no error boundary) → Phase 2.** Nothing else is demo-breaking.

### ✅ Decisions locked — 2026-11-02, all nine answered

Nothing below is open any more. They are law for both sides; the matching **AD entries land in
`docs/architecture.md` alongside the code that implements them** (an AD documents something
*built*, not merely intended). Full record in `contracts/requests.md` PL-7…PL-17.

| # | Decision | Resolution |
|---|---|---|
| PL-7 | Task transitions | `OPEN→IN_PROGRESS→DONE` **plus** `OPEN→DONE` direct. Backwards → **409** |
| PL-8 | Close with open tasks | **Refused → 409** returning the open task ids; UI blocks and lists them |
| PL-9 | `response_phase` skipping | **Strict** `NONE→COORDINATING→ACTIVE→RESOLVED`, one step, never backwards → 409 |
| PL-10 | Stats scoping | **Role-scoped**: citizen = public-safe only · dept head = own dept · admin+officer = all |
| PL-11 | `poll_participation_rate` | **distinct voters ÷ eligible-incident count** — caption *"Poll participation across eligible incidents."* |
| PL-12 | Mock layer | Resolved by shipped code — opt-in `NEXT_PUBLIC_USE_MOCKS=1` (`c753b32`) |
| PL-13 | Traffic / weather | **Omit** — honest gap beats invented data. Closures are real and stay |
| PL-14 | Simulation model | **Simple documented heuristics**: per-category factors × affected population from seeded NCR data, labelled an estimate with factors shown in the UI |
| PL-15 | Browser voice fallback | **Moot** — Gnani STT/TTS confirmed live |
| PL-16 | Alternate LLM provider | **Held** until PL-17 resolves |
| PL-17 | Evon scope | 🟡 **Hasan enabling it now** — spike re-runs immediately after; pass → assistant goes T4 → real same session |

**Working now:** Phase 2 backend (Hasan) — shipped 2026-11-02 (3312b41 + worklog); Playwright + Vitest (Lubna, inside Phase 2). Voice proxies live; assistant LLM = Groq (hybrid, PL-17 resolved).

### Phase 0 — Establish ground truth
**Owner: Hasan.** Lubna continues her current work in parallel; nothing here blocks her.

> **✅ SPIKE EXECUTED 2026-11-02 — voice is GO, Evon is blocked on account provisioning
> (not code). Full evidence in §7.2.**

| # | Task | Output |
|---|---|---|
| 0.1 | Pull Lubna's push, read it fully | ✅ done — `c753b32`, diagnosis in §7.1 |
| 0.2 | **Gnani spike — time-boxed 90 min, hard stop** | ✅ **done — TTS GO · STT GO · Evon NO-GO (scope)** |
| 0.3 | Decide the mock-layer policy (after reading 0.1) | ✅ resolved — opt-in flag, shipped in `c753b32` |
| 0.4 | Diagnose the task module | Deferred to Phase 2 backend work |

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
**Gate cleared: the spike ran 2026-11-02 (§7.2). Voice is GO; the assistant is not.**

**Voice half — build now, both halves of the stack:**

| Endpoint | Detail |
|---|---|
| `POST /voice/stt` | proxy to `https://api.vachana.ai/stt/v3`. **`language_code` is required** (422 without it). Multipart, ≤60 s, WAV/MP3/OGG/FLAC/AAC/M4A. Retry once on 504 — it is transient. |
| `POST /voice/tts` | proxy to `https://api.vachana.ai/api/v1/tts/inference`. **Post the JSON body from a UTF-8 file** (`--data-binary @file`); shell-escaping Hindi text yields a misleading `400 JSON decode error`. |
| `GET /voice/languages` | BCP-47 passthrough per AD-16 — never hardcode a language list |

- Frontend: mic on the report form (`IncidentReport.source = VOICE` slot is already reserved),
  TTS playback for navigation and assistant replies, language selector.
- **Key handling:** server-side only, read from `settings`. The key must never reach the client
  bundle — `NEXT_PUBLIC_*` is a leak channel.

**Assistant half — stays T4 until the Evon scope is granted:**

`POST /assistant/handoff` (drafting a report into the normal pipeline) can be built now — it needs
no LLM. `WS /ws/assistant` cannot: until the 403 is resolved it would be a scripted bot pretending
to think, which is exactly what hard rule 5 forbids. Render `UnavailableState` with the reason.

**If the scope is never granted:** voice is still fully real — that alone satisfies the
"uses Gnani AI models" requirement, proven with latency numbers.

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
| ~~O1~~ | ~~Mock layer: delete, or keep behind `NEXT_PUBLIC_USE_MOCKS=1`?~~ | **RESOLVED 2026-11-02** — Lubna shipped it opt-in in `c753b32` (`client.ts` L15/L114). Shipped code wins. |
| O2 | Task module: what's actually wrong with the shape? | Still open — Phase 2 backend work |
| O3 | Traffic / weather sources | No approved free source; proposing omit rather than fake |
| O4 | Simulation damage model | A design decision, not an implementation one |
| O5 | Browser Web Speech API as the no-key voice fallback | It's a frontend tech addition — the stack is locked (AD-1) |
| O6 | Another LLM provider for the assistant if Evon exposes no chat endpoint | Same — new dependency, needs discussion |
| O7 | Is `docs/plan-phases.md` the right home for this, or does it belong in `contracts/requests.md`'s Parking Lot? | Shared-doc placement is a team convention call |

---

## 7. Reconciliation log — what actually landed

Each entry records what a push contained versus what the plan assumed. **Shipped code always
wins over this document.** When they disagree, the plan is edited — never the other way round.

### 2026-11-02 — Lubna's Day 4 (`c753b32`) vs. this plan's assumption

The plan was written assuming her Day 4 work had landed. It did — 973 insertions across 12
files, with a worklog. Diagnosis below.

**Confirmed landed (assumption correct):**

| Item | Evidence |
|---|---|
| B1 mock fallback now opt-in | `client.ts` L15 `USE_MOCKS`, L114 gates on `USE_MOCKS && (501 \|\| 404)` |
| B2 WS socket identity check | shipped in `stores/incidents.ts` |
| B3 backoff reconnect + 4401 handling | `wsStatus` transitions, `scheduleReconnect` |
| B4 dead Phase filter removed | incidents page |
| B8 real Prev/Next pagination | incidents page |
| B9 `can("report.create")` gate restored | incidents page |
| Poll card on detail | `incidents/[id]/page.tsx` |
| Officer queue `/verification` | new page |
| Investigation view + verdict panel + reopen | `incidents/[id]/page.tsx` |
| Verification timeline, citizen-stripped | `incidents/[id]/page.tsx` |
| `incident.updated` → `replace()` (no dupes) | `stores/incidents.ts` |
| Server-side demo login, `DEMO_PASSWORD` deleted | `auth.ts`, `constants.ts` |
| Day 4 worklog written | `docs/daily/lubna/2026-10-29.md` |

**🔴 Gap 1 — no error boundary exists. This is the demo-breaker, still open.**

`B1` was specified as two halves: (a) stop the mock layer swallowing real 404s, and (b) render
a *typed not-found state*. Half (a) is done properly. Half (b) is not:

```
Get-ChildItem -Recurse web\src -Filter '*.tsx' |
  Where-Object { $_.Name -match '^error|^not-found|^global-error' }
→ (empty) — no error.tsx, no not-found.tsx, no global-error.tsx anywhere
```

So `HttpError` now throws correctly — and **nothing in the render tree catches it**. Visiting
`/incidents/<random-uuid>` still falls through to Next.js's default handler. The white screen
was moved, not closed. Tracked as **R1** in both Phase 2 tickets.

**🟠 Gap 2 — Day 4 is now verified at the API layer (cleared 2026-11-02, `732a3c6`).**

Docker's daemon was fixed by launching `Docker Desktop.exe` **and starting WSL2 Ubuntu first**.
Record that — it is the fix, not luck. Her verified chain: citizen login → `POST /api/v1/incidents`
201 → `GET` list shows the report → WS `incident.created` delivered. WS delivery itself ~1–2 ms;
total POST+WS ~2.1 s from Docker-on-Windows WSL2 I/O overhead (**infrastructure, not code** —
worth knowing before anyone optimises the wrong thing).

**Still open after `732a3c6`:**

- **🔴 R1 — the error boundary still does not exist.** Re-checked after the pull:
  `Get-ChildItem -Recurse web\src -Filter '*.tsx' | Where-Object { $_.Name -match '^error|^not-found|^global-error' }`
  → **empty**. This is now the single highest-risk item on the board. Her own B1 specification
  asked for both halves; half (a) shipped, half (b) has not. **Top of her Phase 2 ticket.**
- **🟠 The browser trust arc is still unproven.** What she verified was the *backend* chain
  (HTTP + WS). Nobody has yet driven `report → vote → officer verifies → pin flips` **in a
  browser**, which is the thing the demo actually shows. `next start` smoke also dropped out of
  her gate list. Phase 2's E2E gate covers both.
- **🟠 Her Day 4 worklog contradicts itself again** — §0.5 says "BLOCKED" while Blockers says
  "Resolved"; two `## Gates at EOD` sections (L70 and L95); "In progress" still lists the
  re-verify that has since succeeded. Same stale-info failure that cost a day on Day 3
  (daily/README rule 3). Cleanup is a Phase 2 Step 0 item.
- **🟠 Day 4 ticket: only 2 boxes ticked** although features 1–6 shipped. Bookkeeping, but an
  unticked ticket reads as incomplete to whoever pulls next.

**🟠 Gap 3 — attachment-surface mismatch (caught before it cost anything).**

This plan originally specified `wsState` / `"idle" | "connecting" | ...`. Her shipped code is
`wsStatus` / `"connected" | "reconnecting" | "offline" | null`. **The plan was edited to match
hers** — she wrote it first, and re-shaping a shipped store to satisfy a document would be
backwards. §2.2 now reflects reality. This is precisely the class of drift this document exists
to catch; it was caught in a diff instead of on demo day.

**🟠 Gap 4 — presentational components aren't separated yet.**

`web/src/components/` still has only `auth/ layout/ map/ ui/`. No `poll/` or `verify/` —
Day 4's features were inlined into pages (`incidents/[id]/page.tsx` grew 396 lines). Harmless
now, but the Phase 2 tickets ask for `components/task/` and `components/alert/` as
props-only components **specifically so the next merge attaches without a conversation**.
Please build them that way; if inlining is genuinely faster, say so in the worklog and this
plan gets updated instead.

### 7.2 — Phase 0 Gnani spike: actual results (2026-11-02)

Key supplied by Hasan, stored in `code/.env` (gitignored, never committed) with placeholders in
`api/.env.example`. **Status at time of writing: registered but unverified.** This section is
the verification.

**What was run, and what came back:**

| # | Call | Result | Latency |
|---|---|---|---|
| 1 | `POST /api/v1/tts/inference` (Timbre v2.5, `hi-IN`, voice `Nalini`) | **HTTP 200** → **460,844 bytes**, magic `RIFF` = valid WAV | **1.12 s** |
| 2 | `POST /stt/v3` with *that same WAV* (`language_code=hi-IN`) | **HTTP 200** → transcript **exactly** the input text | **1.49 s** (processing 0.17 s, e2e **0.19 s**) |
| 3 | `POST /stt/v3` without `language_code` | **HTTP 422** `Field required` — the field is mandatory | 1.27 s |
| 4 | First STT attempt | **HTTP 504** gateway timeout | 6.11 s — **transient, succeeded on retry** |
| 5 | `POST /v1/chat/completions` (Evon) + 5 sibling paths | **HTTP 403** `SCOPE_NOT_ALLOWED: Service 'None' not in allowed scopes` | ~0.3 s |
| 6 | Same + header/query service hints (`X-Service`, `X-API-Service`, `?service=`, `?svc=`) | **HTTP 403, byte-identical error** | ~0.3 s |

**STT round-trip transcript (call 2) — proof it is real, not a stub:**
```
sent:      "Namaste, main ASTRA hoon. Delhi NCR emergency response platform."  (synthesised TTS)
returned:  "नमस्ते, मैं आस्ट्रा हूँ, दिल्ली एनसीआर इमरजेंसी रिस्पॉन्स प्लेटफॉर्म।"
model:     prisma-v2.5   processing_time: 0.172 s   end_to_end_latency: 0.193 s
```

**Two false readings, recorded so nobody repeats them:**
- The first TTS call returned **400 `JSON decode error at body -> 1`**. That was *our* shell
  mangling the UTF-8 payload, not their API. Writing the body to a file and posting with
  `--data-binary @file` fixed it immediately. **If you get a JSON decode error, check your
  client encoding before blaming the API.**
- The first STT call returned **504**. It is transient — the identical request succeeded on
  retry. **Retry STT before reporting a failure.**

**Verdict — the §1 Module 2 classification table changes as follows:**

| Feature | Before spike | **After spike** |
|---|---|---|
| Voice input for reports (STT) | T4 / unknown | **T3 — CONFIRMED REAL, build it** |
| Voice navigation + spoken responses (TTS) | T4 / unknown | **T3 — CONFIRMED REAL, build it** |
| Report assessment (LLM path) | T3 with rules fallback | **T3 rules-only for now** — `LlmBackend` lights up with no code change once scope is granted |
| Assistant chat (Evon) | unknown | **T4 until provisioning is fixed** |

**The Evon 403 is account provisioning, not code.** `Service 'None'` is identical across every
header and query variant tried, which means the server derives scope from the key itself, not
from anything in the request. **Action for Hasan:** log into app.gnani.ai/voice, open the key's
scopes/services, and enable the LLM (Evon) service — or ask Gnani whether Evon API access needs
a different tier. `docs.gnani.ai/llms.txt` is the index to check for the correct scope name.

**Consequence for planning:** Module 2's *voice half* is unblocked and should move forward.
The *assistant* stays T4 until the scope question is answered — and T4 means it renders
`UnavailableState`, never a scripted bot pretending to think.

> 🔐 **Security note:** this key was pasted in plaintext into a chat. It now lives only in
> `.env`, which is gitignored and confirmed untracked by git (`git ls-files .env` → not found).
> Still, treat it as exposed — **rotate it in the Gnani console** once the Evon scope is
> resolved, and never copy it into `api/.env.example`, a commit, or a worklog.
