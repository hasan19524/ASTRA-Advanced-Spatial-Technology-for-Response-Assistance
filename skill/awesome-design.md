# Skill: Awesome Design Principles

## What it is
"Awesome design" = work that feels polished, considered, and human — not template-generated. For ASTRA, this means the dark navy command-center theme feels intentional, not like a default Tailwind admin template.

## Pillars

### 1. Intentional color
- Every color communicates meaning (status, category, severity)
- No random hex values — all colors come from `globals.css` CSS variables
- Dark theme done well: deep navy, not near-black; blue accent, not generic indigo

### 2. Motion with purpose
- Transitions: fast (150-200ms), ease-out
- No bouncing, no spinning logos, no gratuitous animation
- Loading skeletons feel better than spinners for content loading

### 3. Depth through layering
- Cards sit on surface, modals float above, dropdowns above that
- Subtle borders separate sections within same surface level
- No heavy drop shadows — use border + slight shadow for separation

### 4. Microcopy matters
- Button labels are verbs: "Submit report", "Vote Genuine", "Mark Verified"
- Error messages are human: "Couldn't reach the incidents API" not "500 Error"
- Empty states tell the user what to do next, not just "nothing here"

### 5. Craft details
- Consistent corner radius across all cards/buttons/inputs
- Consistent icon weight (all 16px or all 20px, not mixed)
- Text alignment: left for body, center for empty states/headings, right for numbers in tables

## ASTRA checklist before any UI change
- [ ] Did I use an existing CSS variable instead of a hard-coded hex?
- [ ] Is there a clear visual hierarchy?
- [ ] Are interactive states (hover/focus/disabled) handled?
- [ ] Does the empty state guide the user?
- [ ] Is the copy clear and action-oriented?
