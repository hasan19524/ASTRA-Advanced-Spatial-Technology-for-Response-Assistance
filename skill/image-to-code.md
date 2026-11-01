# Skill: Image to Code

## What it is
Converting a visual design reference (screenshot, mockup, Figma) into faithful frontend code without losing the design intent.

## ASTRA context
The reference design is `refrence/refrencedesign.png` — dark navy command-center theme, deep-blue accent. This is the source of truth for all screens.

## Process

### 1. Analyze the reference before coding
- Identify the color palette (navy page, deep-blue primary, status colors)
- Identify the spacing system (cards, gaps, padding)
- Identify the typography (headings, body, captions)
- Identify component patterns (cards, badges, tables, buttons)

### 2. Map to code tokens
- Extract colors → add to `globals.css` CSS variables
- Extract spacing → use Tailwind spacing classes consistently
- Extract component patterns → build reusable `web/src/components/ui/` components

### 3. Build component-first, page-second
- Build `Card`, `Button`, `StatusBadge`, `DataTable`, `EmptyState` first
- Compose pages from these components
- Never inline styles that should be component props

### 4. Verify against reference
- Open `refrence/refrencedesign.png` side-by-side with the running page
- Check: colors match? spacing feels right? typography scale consistent?
- Fix deviations before moving to the next screen

## ASTRA components already built (reference these, don't rebuild)
- `web/src/components/ui/Card.tsx` — dark surface card with title/subtitle/action
- `web/src/components/ui/Button.tsx` — primary/secondary/ghost/danger variants
- `web/src/components/ui/StatusBadge.tsx` — status-colored badge with toneFor()
- `web/src/components/ui/DataTable.tsx` — generic table with typed columns
- `web/src/components/ui/EmptyState.tsx` — labeled empty state with optional action
- `web/src/components/ui/Toast.tsx` — toast host backed by alerts store
- `web/src/components/ui/Modal.tsx` — accessible dialog with backdrop + Escape close

## When converting image→code for ASTRA
- [ ] Does it match `refrence/refrencedesign.png` color palette?
- [ ] Does it use existing UI components from `web/src/components/ui/`?
- [ ] Does it follow the dark navy command-center theme?
- [ ] Are status colors from the LOCKED set (AD-15)?
