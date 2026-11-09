# ASTRA — Competition Submission Checklist

> Great Indian AI Internship Challenge 2026 — submission tracker.
> Tick boxes only after the artefact actually exists. Mock data never counts as verification.

## Submission items

- [x] **Working application** — local stack green (pytest 130 passed / 1 skipped, ruff clean, eslint 0, build clean, vitest 7/7, Playwright 6/6, API healthy). No production deploy yet (free-tier design only).
- [ ] **Public demo video** — 3–5 min, following `docs/demo-script.md`. Link placeholder: `<DEMO_VIDEO_URL>`
- [x] **Project description** — see `README.md` (About ASTRA, core features, engineering deep dive, team contributions).
- [x] **Gnani AI integration explanation** — Prisma STT live in the product path (report form → transcript → persisted incident); Timbre TTS has a UI consumer ("Listen" on assistant answers); Evon LLM not integrated. Documented honestly in `README.md` (AI integration + technology stack) and `docs/architecture.md`.
- [x] **Team contributions** — Hasan Siddique (backend lead), Lubna Suhail Quadri (frontend lead). See `README.md` → Team and contributions.
- [ ] **LinkedIn/X announcement** — draft ready in `docs/announcement-draft.md`; not yet posted. Link placeholder: `<ANNOUNCEMENT_URL>`
- [ ] **Required hashtags included** — `#GnaniAI #GreatIndianAIInternshipChallenge2026 #ASTRA` (plus `#EmergencyResponse #AI` on the announcement).
- [ ] **Submission confirmation** — final form/portal submission recorded. Confirmation ID placeholder: `<SUBMISSION_CONFIRMATION_ID>`

## Pre-submission gates (must all be green)

- [x] `ruff check app tests` clean
- [x] `python -m pytest -q` → 130 passed, 1 skipped
- [x] `npm run lint` → 0 errors
- [x] `npm run build` → compiled cleanly
- [x] `npm run test` → 7 passed
- [x] `npx playwright test --workers=1` → 6 passed
- [ ] Demo video recorded and uploaded (public link)
- [ ] Announcement posted with required hashtags
- [ ] Gnani API key rotated and re-verified (operational blocker — key was pasted in chat earlier)
- [ ] No secrets in tracked files (verified: zero occurrences in history)

## Roles for the demo (password `astra-demo-2026`)

| Login | Role | Used in segment |
|---|---|---|
| `citizen@astra.dev` | Citizen | 2, 3 |
| `officer@astra.dev` | Verification Officer | 4 |
| `admin@astra.dev` | Central Admin | 6 |
| `dephead@astra.dev` | Department Head | 6 (alt) |
| `team@astra.dev` | Response Team | 6 (alt) |

## Artefact links

- Demo script: `docs/demo-script.md`
- Announcement draft: `docs/announcement-draft.md`
- Project description: `README.md`
- Gnani integration: `README.md` (AI integration), `api/app/services/voice_service.py`
- Trust-arc screenshots: `web/trust-arc-1-citizen-report.png`, `web/trust-arc-2-citizen-vote.png`, `web/trust-arc-2b-queue.png`, `web/trust-arc-3-officer-verify.png`, `web/trust-arc-4-pin-flipped.png`
