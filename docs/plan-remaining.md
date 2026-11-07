# Remaining Buildable Items — ASTRA Completion Plan

## Phase 6 — No external dependencies (build now)
### 6.1 Assistant chat UI wiring ✅ (page exists, backend verified via E2E)
### 6.2 Routing UI on map ✅ (route finder panel added, Dijkstra verified)
### 6.3 Geocoding UI (Nominatim search box on map + report form)
### 6.4 Mobile responsive polish (forms, tables, cards, map full-width)
### 6.5 Loading skeletons (replace empty states with skeleton loaders)
### 6.6 Alert auto-generation on incident creation
### 6.7 Incident clustering on map (group nearby pins)
### 6.8 CI/CD (GitHub Actions — ruff + pytest + tsc + build)

## Phase 7 — Needs API keys (build when keys provided)
### 7.1 Traffic integration (TomTom free tier)
### 7.2 SMS/OTP auth (MSG91)
### 7.3 Image classification (OpenAI Vision)
### 7.4 Voice-first reporting (continuous listening)

## Testing
### T1 Run Playwright E2E specs (verify all pass)
### T2 Run Vitest unit tests
### T3 Run full E2E script (27/27)