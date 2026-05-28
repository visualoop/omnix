# 01 — Native UI Polish Plan

**Goal:** Make every shadcn component feel like a native Windows 11 app — without swapping libraries.

We keep shadcn (already 40+ components, Tailwind, customizable). We do a per-component pass to:
- Tighten radii, padding, font weight
- Replace heavy ring focus with 1px Windows-style border
- Add native shadows (`.shadow-native`)
- Use Segoe UI Variable / native font features
- Reduce motion (250ms → 120ms) and ease curves
- Single-line dense layouts where appropriate

## Already done in v0.1.6

- Global font dropped to 13px, Segoe UI Variable in stack
- Body cursor: default (not text)
- Scrollbar: 10px thin Windows 11 style
- Disabled rubber-band scroll, disabled body text-select
- `--radius` reduced 0.5rem → 0.375rem
- Button micro-press (0.5px translate on :active)
- Input rounded-md, 1px focus ring, 13px text
- Headings: 600 weight, -0.01em tracking

## Components left to polish (priority order)

### Tier 1 — most-visible
- [ ] **Sheet** (slide-over panel) — currently has 16px radius shadow; native sheets have flat-edge sliding from screen edge
- [ ] **Dialog / Modal** — current 16px radius + heavy shadow; native dialogs are 8px radius, single thin border
- [ ] **DropdownMenu** — native menus have 4px radius, 1px border, no big shadow, item height 28px not 32px
- [ ] **Tooltip** — already small but spacing should tighten
- [ ] **Card** — used heavily; native cards are flat with 1px border
- [ ] **Tabs** (settings page) — native tabs are underline-style, not pill

### Tier 2 — form / data
- [ ] **Select** — native dropdowns
- [ ] **Checkbox** — Windows 11 has specific checkmark + accent fill
- [ ] **Switch** — should be Windows 11 Mica-style (rounded rectangle with sliding pill)
- [ ] **RadioGroup** — native radio
- [ ] **Slider** — Windows 11 ColorPicker has the right slider style
- [ ] **Calendar** / DatePicker — replace bouncy animation, native looks instant
- [ ] **Combobox / Autocomplete** — native styling

### Tier 3 — feedback
- [ ] **Toast (sonner)** — currently bottom-right floating; native is more like banner inside content area
- [ ] **Progress** — Windows 11 has its own progress style (segmented dots for indeterminate)
- [ ] **Badge** — looks fine but slightly tighter

### Tier 4 — surfaces
- [ ] **Sidebar** — should be slightly translucent on Win11 (Mica effect simulation)
- [ ] **Topbar** — has subtle native acrylic feel via backdrop-blur
- [ ] **Tables** — sticky headers with 1px sub-border, alternating row tinting

### Tier 5 — chrome
- [ ] **Window decorations** — research using Tauri `decorations: false` + custom title bar with min/max/close buttons that match Windows
- [ ] **Window corner radius** — Windows 11 has 8px corners (we'd need to match)

## Approach

Don't touch all at once. We do batches:

**Batch A (highest impact):** Sheet + Dialog + DropdownMenu + Tabs + Card
**Batch B (forms):** Switch + Checkbox + Select
**Batch C (feedback):** Toast + Progress
**Batch D (chrome):** Custom title bar + window controls

Each batch updates the components' source in `src/components/ui/`, then regression-tests by walking key flows in dev (POS → settle a sale → run Z-report).

## Native styling reference

Tailwind classes/values that match Windows 11 native:

- Border: `border-border` (already 1px, neutral)
- Card surface bg: `bg-card` for elevated; `bg-background` for flat
- Hover: `hover:bg-accent/40` (subtle)
- Selected: `bg-primary/8 text-primary` (no fill, just tint)
- Focus ring: `ring-1 ring-ring` (NOT ring-3)
- Shadow: `.shadow-native` (we defined this) or `shadow-sm` max
- Spacing: gap-1.5, p-2, p-3 — Windows is denser than web app
- Type sizes: title=14px, body=13px, caption=12px, label=11px

## Out of scope (for later)

- Full Mica/Acrylic — would need Tauri Window plugin work, deferred
- Window dragging custom region — needs Tauri config, deferred to Batch D
- True dark-mode following system — already mostly there, audit needed
