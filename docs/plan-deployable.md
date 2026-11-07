# Phase 6 & 7 Plan — Making ASTRA a deployable, usable product

## Phase 6 — No external keys needed (build now)

### 6.1 Assistant chat UI wiring
- Wire AssistantPage to call startConversation + send with auth token
- Show loading state, error handling, message history
- Test end-to-end

### 6.2 Routing UI on map
- Add "Route" panel: select from/to locations (dropdown from /route/locations)
- Call /route, display distance + path (list of nodes)
- Show route on the map placeholder (highlight path)

### 6.3 Nominatim geocoding
- Backend: GET /geocode?q=... → proxy to Nominatim (free, no key)
- Frontend: search box on map + report form → autocomplete → fill lat/lon

### 6.4 CI/CD (GitHub Actions)
- .github/workflows/ci.yml: ruff + pytest (backend), tsc + build (frontend)
- Run on push to main

### 6.5 Mobile responsive polish
- Sidebar: hamburger drawer (done), responsive widths
- Cards, tables, forms: responsive padding, font sizes
- Map: full-width on mobile
- Topbar: collapse search on small screens

## Phase 7 — Needs API keys (build when keys available)

### 7.1 Traffic integration (TomTom free tier)
- TOMTOM_API_KEY in .env
- Fetch traffic flow for route segments
- Update routing_service to use real travel times

### 7.2 SMS/OTP auth (MSG91 or Twilio)
- Phone-based registration/login
- OTP verification
- Replace demo logins with real OTP flow

### 7.3 Image classification (OpenAI Vision or Google Vision)
- On photo upload, classify: fire/flood/crash/medical
- Auto-set category from classification
- Confidence score stored in assessment

## Phase 8 — Product decisions needed (future)
- Multi-tenant architecture
- Push notifications (FCM/APNs)
- Offline PWA support
- DPDP Act compliance
- Historical analytics dashboards
- Predictive dispatch (ML)