# Skill: 21st.dev

## What it is
21st.dev is a component library and design system marketplace for React/Tailwind. It provides production-ready, accessible components with consistent design tokens.

## ASTRA application
ASTRA already has its own component library in `web/src/components/ui/`:
- Card, Button, StatusBadge, DataTable, EmptyState, Modal, Toast, StatCard, RoleGate

These follow the same philosophy as 21st.dev: consistent design tokens, accessible markup, Tailwind-based, dark-theme-first.

## How to apply 21st.dev principles to ASTRA

### 1. Component API consistency
All ASTRA UI components follow a consistent prop pattern:
```tsx
<Card title="..." subtitle="..." action={...} padding={true}>
  {children}
</Card>
<Button variant="primary" disabled={...} size="...">
  Label
</Button>
<StatusBadge tone="verified" className="...">
  Label
</StatusBadge>
```

### 2. Design tokens in CSS variables
`web/src/app/globals.css` defines the design system:
- `--surface`, `--surface-2`, `--surface-3`: card/layer backgrounds
- `--primary`, `--primary-hover`, `--primary-soft`: brand colors
- `--border`, `--border-strong`, `--border-dashed`: border colors
- `--foreground`, `--muted`, `--subtle`: text colors
- `--status-*`: status colors (LOCKED per AD-15)

### 3. Dark theme as default
ASTRA is dark-first. Every component must work on dark surfaces. Light mode is not a goal.

### 4. Accessibility built in
- `Modal` has Escape-to-close and backdrop click
- `Button` has disabled states and focus styles
- `DataTable` has keyboard row navigation
- All form inputs have labels and proper types

### 5. When to add a new component
Only extract a new component to `web/src/components/ui/` if:
- It's used in 2+ places, OR
- It encapsulates a complex pattern (form validation, WS connection, role gating)
- It follows the existing component API conventions

## Do NOT install external component libraries
ASTRA's stack is locked (AD-22 / architecture.md). No shadcn/ui, no Headless UI, no Radix UI swaps. Use the existing `web/src/components/ui/` components or extend them following the same patterns.

## Reference when building new UI
- Check `web/src/components/ui/` first — does an existing component cover this?
- Check `web/src/lib/constants.ts` — do the design tokens exist?
- Check `web/src/app/globals.css` — do the CSS variables exist?
- If not, add them following the existing patterns, then build the component
