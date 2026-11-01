# Skill: Anti-UI-Slop

## What "UI slop" means
UI slop = generic, soulless interfaces that look like every other Tailwind admin template: rounded-everything cards, arbitrary color classes, inconsistent spacing, copy-pasted component patterns, no visual hierarchy, no intentional design decisions. It "works" but feels cheap and forgettable.

## ASTRA anti-slop rules

### 1. No arbitrary Tailwind classes
**Don't:** `bg-[#1a1a2e] text-[#ff6b6b] p-[13px] m-[7px]`
**Do:** `bg-[var(--surface)] text-[var(--foreground)] p-4 m-4`

Every color, spacing, and size must come from `globals.css` CSS variables or Tailwind's design system scale.

### 2. No rounded-everything
Not every element needs `rounded-lg` or `rounded-full`. Use radius deliberately:
- Cards: `rounded-xl`
- Buttons: `rounded-lg`
- Badges: `rounded-full`
- Inputs: `rounded-lg`
- Avatars/dividers: `rounded` or none

### 3. No copy-pasted component patterns
If you're writing the same HTML structure twice, extract it into a `web/src/components/ui/` component. ASTRA already has: Card, Button, StatusBadge, DataTable, EmptyState, Modal, Toast, StatCard, RoleGate.

### 4. No missing hover/focus/disabled states
Every interactive element must have:
- `hover:` state (visible but subtle)
- `focus:` state (keyboard navigation obvious)
- `disabled:` state (opacity 50%, cursor-not-allowed)

### 5. No color for decoration
Colors communicate meaning only:
- Primary (`#3b82f6`): primary actions
- Surface variants: backgrounds/containers
- Muted/Subtle: secondary text
- Status colors: LOCKED set only (AD-15)
- Never use color just to "make it pop"

### 6. No inconsistent icon weights
All icons in a context should be the same size and weight. Don't mix `text-lg` icons with `text-base` icons in the same list.

### 7. No crowded layouts
White space is free. Give elements room to breathe. A cramped interface feels sloppy regardless of how "modern" the components are.

## ASTRA slop checklist — before any UI PR
- [ ] No hard-coded hex colors outside `globals.css`
- [ ] No arbitrary spacing values (use Tailwind scale)
- [ ] Interactive elements have hover/focus/disabled states
- [ ] No duplicated component patterns (extracted to `ui/`)
- [ ] Status colors come from `StatusBadge.toneFor()` or `STATUS_TONES`
- [ ] Empty states guide the user (not just "nothing here")
- [ ] Consistent icon weights throughout
