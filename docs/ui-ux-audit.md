# ASTRA UI/UX Audit

**Date:** 2026-11-08
**Scope:** all 14 application screens (`/dashboard`, `/incidents`,
`/incidents/[id]`, `/map`, `/report`, `/reports`, `/teams`, `/departments`,
`/verification`, `/alerts`, `/settings`, `/assistant`, `/simulation`,
`/audit`) plus the two auth screens (`/login`, `/signup`).
**Method:** automated instrumentation (`web/scripts/page-text-audit.mjs`,
`web/scripts/responsive-audit.mjs`) plus manual review of every screen in a
real browser at 375 px, 768 px and 1440 px, with the **admin** account and
the **citizen** account.

---

## 1. Headline verdict

The audit found **no blank screens, no console errors and no dead
controls** after the fixes below. Before the fixes, the largest problem was
not visual polish — it was that several screens **claimed capabilities the
system did not have**. Those are fixed, and the fixes are listed with their
evidence.

| Check | Result |
|---|---|
| Screens that render without a console error | 14 / 14 |
| Screens that show a real error or empty state instead of a blank page | 14 / 14 |
| Screens whose numbers come from the API (no fixtures) | 14 / 14 |
| Horizontal overflow at 375 px | none |
| Sub-40 px tap targets on coarse pointers | none |
| Invalid `<a><button>` nesting | none (8 removed) |
| Hard-coded fixture data still on a production path | none |

---

## 2. The five findings that mattered

### 2.1 The "Live Operations Map" was not a map — **fixed**

**Before.** `MapPlaceholder` drew coloured dots on a CSS gradient. It could
not pan, zoom, geocode or route, and it had a zoom control that was two
dead `<button>` elements with no handler.

**After.** `web/src/components/map/LiveMap.tsx` renders real OpenStreetMap
raster tiles through Leaflet 1.9.4:

- pan, scroll-zoom, drag, double-click zoom;
- 89 real incident pins, coloured by verification status
  (amber = unverified, green = verified, grey = rejected), each with an
  accessible name (the incident title) and a tooltip;
- the **real** Dijkstra route drawn as a polyline from the node
  coordinates the API returns (`path_coords`);
- the real closure layer (`routing_edges.is_closed`);
- "Locate me" using the browser's own geolocation, with an explicit
  permission-denied state;
- a dark treatment of the same OSM tiles (a CSS filter) so the map matches
  the command-centre theme without a second, key-gated tile provider.

*Evidence:* `GET /api/v1/route?from_id=…&to_id=…` →
`{"distance_seconds": …, "path": [93 ids], "path_coords": [93 pairs]}`;
the browser draws one `<path>` in the Leaflet overlay pane and the panel
reads "≈ 3 min · 93 nodes".

**Note on the tile provider.** CARTO's `basemaps.cartocdn.com` now answers
every request with an "API KEY REQUIRED" placeholder image. The map uses
the plain OpenStreetMap tile server, which needs no key and carries the
required attribution.

### 2.2 Three screens rendered invented numbers — **fixed**

| Screen | What it showed | What it shows now |
|---|---|---|
| `/reports` | "128 total incidents", "94 % poll agreement", a hard-coded category chart | Counted numbers from `GET /api/v1/stats/overview`: incidents per category, a real 7-day vs previous-7-day delta, average verification latency, poll-vs-officer agreement, the recent-closure list. A metric that cannot be computed shows a dash. |
| `/simulation` | "12.5 km²", "45,000+ people affected", "₹320 Cr" — identical whatever you selected | The real model's summary for the chosen scenario, category, radius and intensity. |
| `/departments` | 7 hard-coded units and heads | `GET /api/v1/departments`: real head, real personnel count, real open/total task load. |

This was the single worst category of problem: a reviewer looking at
`/reports` would reasonably conclude the product was processing real
volume. It was not.

### 2.3 The department list contained two different "Fire" departments — **fixed**

The seed used `"Fire & Rescue"` for users and `"Fire"` for 66 tasks. The
directory rollup therefore showed a *Fire & Rescue* unit with 3 people and
0 tasks next to a *Fire* unit with 0 people and 32 tasks — and nobody
noticed, because the screen was hard-coded.

`app/core/constants.DEPARTMENTS` is now the single list; the API returns
422 for any department outside it, and the seeded rows were normalised.
A test (`test_unknown_department_is_refused`) locks it.

### 2.4 Eight buttons were nested inside links — **fixed**

`<Link><Button>…</Button></Link>` is invalid HTML. It produced a double
focus stop and, because the anchor only wrapped the inline text, a **16 px
tall invisible tap target** on the Verification screen's "Investigate"
action — the single most important control on that page.

New `web/src/components/ui/LinkButton.tsx` renders one anchor with the
button's visual language. All eight sites now use it.

### 2.5 The assistant could not say which engine answered — **fixed**

The chat screen showed a reply with no attribution, and the backend only
ever tried `providers[0]` — the Groq → OpenRouter → NVIDIA fallback chain
that PL-17 specifies was never actually exercised.

Now:

- the backend runs the whole chain and returns the provider label;
- every bubble shows the model that wrote it (`openai/gpt-oss-20b`);
- when no provider is reachable the answer comes from the deterministic
  **rules stub**, and both the bubble and the reply text say so;
- the system prompt carries ASTRA's actual rules (the incident lifecycle,
  the phase transitions, the task-transition rules, the seven
  departments, the role capabilities), so the answer is ASTRA-specific
  instead of generic ITSM advice.

*Evidence:* `POST /api/v1/assistant/conversations/{id}/chat` →
`{"reply": "**Steps for a Central Admin to close an incident in ASTRA**…",
"provider": "llm:openai/gpt-oss-20b"}`.

---

## 3. Per-screen findings

### `/dashboard` — Central Admin Dashboard
- **Fixed:** the embedded map was the placeholder; it is now the real map.
- **Fixed:** "Recent Activity" said *"The activity feed endpoint is not
  built yet."* It now reads the real audit log for roles holding
  `audit.read`, and shows "Activity feed is admin-only" for everyone else.
- **Fixed:** the department list was invented; it is now the real load.
- **Kept:** the dashboard map is read-only (no route, no layers) — the
  full map lives on `/map`, and the card links there.

### `/incidents` — Incident Management
- Real data, live over `/ws/map`.
- The category and status filters work against the API query, not against
  the loaded page.
- ID column is truncated to 8 characters with `whitespace-nowrap` so the
  table does not stretch on a phone.

### `/incidents/[id]` — Incident detail
- **Fixed:** the task-assignment dropdown was passed `usersByDept={{}}` —
  it had been wired to fetch and then the fetched value was never used, so
  the assignee list was always empty. It now passes the real directory.
- The evidence photo uses the API's **signed** URL (`media_url`). Before
  this the frontend built an unsigned URL and every photo returned 403;
  a fallback tile is shown when a photo cannot be loaded.

### `/map` — Live Operations Map
- See 2.1.
- The panel states in plain words that **live traffic and team GPS are not
  available** — no traffic provider key is configured, and no user record
  carries a position. A layer that pretended otherwise would be a lie.
- The route finder shows the real travel time and node count, and states
  the snap distance when a point is outside the seeded road network.

### `/report` — Report an Incident
- Real submission with photo upload, category, region, location text and
  browser geolocation.
- The microphone uses the voice language chosen in Settings (the two are
  now one shared, persisted selection instead of two unrelated lists).
- The file input is visually hidden but still keyboard-reachable.

### `/reports` — Reports & Analytics
- See 2.2. Role-gated on `analytics.operational`; other roles get a clear
  "restricted" state that names the permission.

### `/teams` — Task Board
- **Fixed:** the screen said *"The endpoint you need is not built yet."*
  It now reads the role-scoped `GET /api/v1/tasks`.
- **Fixed:** it rendered all 76 tasks as full editable rows — an
  unusable wall. It is now a compact, paged list (25 per page, "page 1 of
  4") with the action row shown for the selected task only.
- The dispatch panel shows the incident behind the selected task, loaded
  for real.

### `/departments` — Departments
- See 2.2 and 2.3. Every figure is counted.

### `/verification` — Verification Queue
- **Fixed:** the subtitle had a template-literal bug
  (`${total} incident{total !== 1 ? "s" : ""}` rendered literally), so the
  screen claimed "41 incidents" with a visible `${…}` in the text.
- **Fixed:** the "Investigate" action had a 16 px tap target (2.4).
- The urgency / age / assessment filters hit the API query.

### `/alerts` — Alerts Center
- Real alerts over `WS /ws/alerts`, with per-region and per-category
  preferences saved to the API.
- The dismiss control is a 40 px target on a phone.

### `/settings` — Settings
- **Fixed:** the language list showed 12 languages with most disabled and
  the note *"selector wires up on Day 7"*. It now loads the real list from
  `GET /api/v1/voice/languages`, the selection is persisted, and the
  report form's microphone honours it.
- The permission inspector lists exactly the permissions the API will
  honour — no hand-written list.

### `/assistant` — AI Assistant
- See 2.5. Four starter questions exercise the real backend paths.

### `/simulation` — Simulation Center
- See 2.2. The summary is labelled as a heuristic estimate (PL-14) — not
  a forecast — and the screen says the run never touches a live incident.

### `/audit` — Audit Log
- **Fixed:** the viewer read `timestamp` / `actor` / `status`, none of
  which exist on the row, so **every cell rendered "—"**. It now reads
  `id` / `actor_label` / `created_at` / `status_code`.
- Admin-only, with a named-permission "not authorized" state.

---

## 4. Responsive behaviour

Measured with `web/scripts/responsive-audit.mjs` at **375 px** (phone),
**768 px** (tablet) and **1440 px** (desktop).

| Fix | Detail |
|---|---|
| Alert banner | The chips used to stack into a screen-height block on a phone; they now scroll horizontally. |
| Tables | `DataTable`, the dashboard table and the audit table get a `min-w` and `overflow-x-auto`, so a wide table scrolls inside its card instead of stretching the page. |
| Incident / verification IDs | Truncated to 8 characters with `whitespace-nowrap`. |
| Topbar search | Was a dead control; it now queries live incidents, shows the matches and jumps to the detail. On a phone it collapses into a full-width overlay. |
| Buttons | `Button` grows to a 40 px minimum on coarse pointers (`@media(pointer:coarse)`) while keeping the reference density on a desktop. |
| Leaflet zoom control | Leaflet's own buttons are 24 px; they are now 34 px on desktop and 40 px on a touch device. |
| Leaflet attribution | Font raised from 9 px to 10 px — the OSM attribution is legally required to stay visible. |
| Verification "Investigate" | Was a 16 px-tall anchor; now a 40 px button-shaped link. |
| Settings language buttons | 31 px → 40 px on touch. |
| Alert preference selects | 29 px → 40 px; the enable checkbox 12 px → 16 px. |
| Map controls | The basemap switcher (`dark` / `street`) and the `Fit` / `Locate me` buttons were 27-29 px tall on a phone; all four are now `min-h-10` (40 px). The switcher also moved from `bottom-6` to `bottom-2` so it clears the Leaflet attribution bar instead of sitting on top of it. |

**Remaining sub-40 px targets** are inline text links ("View all →",
"Open full map →", the OSM attribution) and desktop-density buttons at
30 px. WCAG 2.5.8 (Target Size Minimum, 24 × 24) is met by both; the
40 px figure is the AAA target size and the iOS HIG recommendation, which
does not apply to inline text links.

The dashboard's embedded map card passes `showBasemapSwitcher={false}`:
it is a read-only 320 px preview, so the basemap control belongs to the
full map only. Every other control stays, because a preview that cannot
be re-centred is a dead card.

---

## 5. States that were checked on every screen

| State | Behaviour |
|---|---|
| Loading | Skeleton on the incidents list, the teams board and the map's own load state; a text "Loading…" line elsewhere. |
| Empty | A named empty state naming what is missing and what to do — never a blank page. |
| Error | A `role="alert"` block with the server's message. No silent failures. |
| Permission denied | The screen names the missing permission and says the backend enforces it. |
| Degraded (backend down) | `UnavailableState` — the screen says the service did not answer instead of showing stale numbers. |
| Partial data | Where the API returns fewer rows than exist, the screen says "Showing N of M" (the map does this). |

---

## 6. Open items

| # | Item | Why it is still open |
|---|---|---|
| 1 | Skeleton loaders on every screen | A handful of screens still use a text "Loading…" line. Visible, but not a shimmer. |
| 2 | Incident clustering on the map | 89 pins is readable. The API caps the map at 500; clustering becomes necessary before that is reached. |
| 3 | Map E2E coverage | **Closed.** `web/tests/map.spec.ts` pins the real OSM tile source, the real incident pins, the drawn route polyline (tied to the node count the API reports) and the honest layer note. `web/tests/assistant.spec.ts` pins the provider disclosure. |
| 4 | Offline incident reporting | A citizen in a flooded street has no signal. This is the scenario the product exists for — see Phase 8.3. |
| 5 | Screen-reader pass with a real screen reader | The tree was verified programmatically (every pin has an accessible name); a NVDA/VoiceOver pass is still owed. |
| 6 | Live traffic and team-GPS layers | Blocked on a TomTom key and on a position field. The UI says so rather than faking them. |

---

## 7. How to reproduce this audit

```powershell
# Backend + database + Redis
cd D:\projects\professional\ASTRA\code
docker compose up -d --build api

# Frontend
cd web
npm run dev

# Text / fixture / error audit — every page, as the admin
node scripts/page-text-audit.mjs

# Responsive audit — 375 / 768 / 1440, screenshots written to disk
node scripts/responsive-audit.mjs C:\Users\Hasan\AppData\Local\Temp\opencode\astra-audit
```

`page-text-audit.mjs` reports, per page: the rendered text length, the
count of em-dashes (a proxy for empty cells), any visible error strings,
and any fixture-looking phrases. `responsive-audit.mjs` reports, per page
and per viewport: elements smaller than 40 × 40 px and any horizontal
overflow, and saves a screenshot of every page at every size.
