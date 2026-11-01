# Skill: Vercel Web Design Guidelines

## Source
Vercel's design principles (vercel.com/design) applied to ASTRA.

## Core principles

### 1. Clarity through hierarchy
- Establish a clear visual hierarchy: primary action > secondary info > tertiary detail
- Use size, weight, and color to signal importance
- The most important element on a page should be the largest/brightest

### 2. Deliberate spacing
- Use consistent spacing tokens (Tailwind spacing scale)
- More white space = more breathing room = more premium feel
- Related items grouped together (proximity), unrelated items separated

### 3. Typography as interface
- Font stack: system-ui, Inter, sans-serif
- Line height: 1.5 for body text, 1.2 for headings
- Letter spacing: tight for headings (-0.025em), normal for body
- Never stretch or distort type

### 4. Interactive states
- Hover states must be visible but subtle (slight bg change, not dramatic)
- Focus states must be obvious (keyboard navigation)
- Disabled states must look disabled (opacity 50%, cursor not-allowed)
- Loading states must communicate progress (skeleton, spinner, or text)

### 5. Borders and shadows
- Borders: subtle, 1px, slightly darker than background
- Shadows: soft, diffused, never hard-edged black
- One shadow max per element

## ASTRA application
- Login page: primary CTA ("Sign in") is largest, most saturated button
- Incident detail: incident ID is the heading, 4-axis cards are equal weight secondary info
- Map page: map canvas takes primary real estate, dispatch card is secondary sidebar
- All buttons use the shared `Button` component with hover/focus states
