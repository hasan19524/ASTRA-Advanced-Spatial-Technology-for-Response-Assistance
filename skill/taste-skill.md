# Skill: Design Taste

## What it is
Design taste is the ability to make deliberate, confident visual decisions that feel cohesive, intentional, and appropriate for the product's purpose. It's not about following trends — it's about consistency, restraint, and knowing when to add vs. remove.

## Core principles for ASTRA

### 1. Consistency > novelty
- One spacing scale (Tailwind: 4, 8, 12, 16, 20, 24, 32, 48, 64)
- One border-radius scale (rounded-lg, rounded-xl, rounded-full)
- One shadow strategy (subtle, never heavy drop shadows)
- One typography hierarchy (text-xs, text-sm, text-base, text-lg, text-xl, text-2xl)

### 2. Restraint
- Don't add gradients, glows, or animations unless they serve a function
- Every color has a job: primary (action), surface (background), muted (secondary text), danger (error), success (verified)
- White space is a design element — don't crowd components

### 3. Dark theme discipline (ASTRA is navy command-center)
- Page background: `#0b1120` (var(--background))
- Card surface: `#0f172a` (var(--surface))
- Primary: `#3b82f6` (deep blue)
- Border: subtle, never black (#1e293b range)
- Text: primary `#f8fafc`, muted `#94a3b8`, subtle `#64748b`

### 4. Status colors (LOCKED in architecture AD-15)
- UNVERIFIED: amber `#f59e0b`
- VERIFIED: green `#22c55e`
- DEFINITELY_FALSE: grey `#9ca3af`
- CLOSED: slate `#64748b`
- Never invent new status colors

### 5. When in doubt, remove
- If an element doesn't communicate information or enable an action, delete it
- Prefer text labels over icons alone
- Prefer one clear CTA per section

## How to apply when coding ASTRA UI
- Check `web/src/app/globals.css` for existing CSS variables before adding hard-coded colors
- Use `StatusBadge` component with `toneFor()` for all status displays — never inline status colors
- Use `Card`, `Button`, `DataTable`, `EmptyState` from `web/src/components/ui/` — don't reinvent
- Check `web/src/lib/constants.ts` for STATUS_TONES, CATEGORIES, SEVERITIES before hard-coding
