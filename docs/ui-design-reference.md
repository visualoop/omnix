# UI Design Reference — Omnix

> **Canonical design source of truth.** The persisted UI/UX Pro Max output lives at
> `design-system/omnix/MASTER.md`. Where that generator's generic defaults conflict
> with Omnix's established theme, **this document wins** — see Reconciliation below.

## Omnix Design System (canonical tokens)

Omnix is a Linear/Notion-grade desktop ERP. The theme is flat, dense, keyboard-first,
dark+light, with a single configurable accent. These tokens are fixed:

| Token | Omnix value | Notes |
|-------|-------------|-------|
| Body + UI font | **Inter** | NOT Fira Sans. Monospace only for numbers/codes/prices. |
| Accent | **blue-600** (configurable per business) | One accent only; semantic green/amber/red for status. |
| Cards | **flat, bordered, no drop shadow** | `border-border` + `bg-card`; shadows reserved for popovers/modals only. |
| Radius | ≤ 8px | Architectural, not pill-shaped. |
| Grid | 8px spacing system | xs4 / sm8 / md16 / lg24 / xl32. |
| Buttons | flat fills, no gradients | hover = color/opacity shift, never layout-shifting scale. |
| Theme | dark + light, system-aware | every surface must respect both. |

### Reconciliation with the generated MASTER.md
The `ui-ux-pro-max --design-system` run for Omnix (category: Analytics Dashboard) is a
useful **interaction/structure** reference but its visual defaults are overridden:

| Generator suggested | Omnix decision |
|---------------------|----------------|
| Fira Code / Fira Sans | ❌ Use **Inter** (mono for figures only). |
| Card drop shadows (`--shadow-md` on `.card`) | ❌ **Flat bordered cards**; shadow only on overlays. |
| `translateY(-2px)` hover lift | ❌ No layout-shifting hovers; use `bg-accent/30` row/cell hover. |
| Generic `#1E40AF` blue + `#D97706` amber | ✅ Keep the app's themeable **blue-600** accent + semantic colors. |
| Rounded 12–16px cards | ❌ Keep ≤ 8px. |

**Adopt from the skill (theme-agnostic, genuinely useful):**
- Data-dense layout: minimal padding, KPI cards, dense tables, filtering on every list.
- Row/cell **hover highlighting** with 150–300ms transitions.
- `cursor-pointer` on every clickable element; visible keyboard focus states.
- Lucide SVG icons only — **no emoji as icons**.
- Light-mode text contrast ≥ 4.5:1; respect `prefers-reduced-motion`.

## Skills Gate (mandatory for every UI task)

Before building any UI surface (Tasks 13, 16, 17, 18, 21, and all module pages):
1. **Generate** — `python3 .kiro/skills/ui-ux-pro-max/scripts/search.py "<surface keywords>" --design-system` (and `--page "<name>"` to persist page overrides under `design-system/omnix/pages/`).
2. **Build** — follow `website/.claude/skills/frontend-design` + `aesthetic-direction` + `hierarchy-rhythm`, plus the canonical tokens above (never the generator's generic font/shadows).
3. **Check** — run `ai-slop-check` rules: no gradients/orbs/emoji, no generic AI patterns, intentional hierarchy.
4. **Pre-delivery checklist** — no emoji icons, cursor-pointer, smooth hovers, 4.5:1 contrast, visible focus, reduced-motion, responsive.
5. **Screenshot-verify** at **1280×720, 1024×768, 1920×1080** (customer display also tested at these). If a headless environment blocks screenshots, state that explicitly and rely on `vite build` + checklist review.

Page-specific overrides live in `design-system/omnix/pages/<page>.md`; if present they override `MASTER.md` (but never these canonical tokens).

---

## Design Philosophy

Omnix must feel like Linear, Notion, or Figma — NOT like a Windows Forms app, NOT like a Bootstrap admin template.

The standard: **Would this screen feel at home in Linear's interface?**
If it looks like a WordPress admin panel, rebuild.

---

## Visual References (Study Before Building)

### Tier 1 — Primary Aesthetic Anchors
| App | What to Learn |
|-----|--------------|
| [Linear](https://linear.app) | Sidebar, density, command palette, keyboard-first, subtle animations |
| [Notion](https://notion.so) | Contextual panels, slash commands, clean typography |
| [Figma](https://figma.com) | Panel layout, property editors, keyboard shortcuts |
| [Vercel Dashboard](https://vercel.com/dashboard) | Data display, clean tables, status indicators |
| [Stripe Dashboard](https://dashboard.stripe.com) | Financial data, dense but breathable, hierarchy |

### Tier 2 — POS-Specific References
| App | What to Learn |
|-----|--------------|
| [Square POS](https://squareup.com) | Fast checkout flow, touch-friendly but keyboard-capable |
| [Shopify POS](https://shopify.com/pos) | Product grid, cart sidebar, payment flow |
| [Lightspeed](https://lightspeedhq.com) | Inventory management UI, reports |

### Anti-References (What NOT to look like)
- Any Bootstrap admin template
- WordPress wp-admin
- Old Windows Forms applications
- Material Design card-heavy layouts
- Generic "ERP" software with toolbar buttons

---

## Layout System

### App Shell
```
┌──────────────────────────────────────────────────────────┐
│ ┌────────┐ ┌──────────────────────────────────────────┐  │
│ │        │ │ Topbar: breadcrumb / title / actions      │  │
│ │        │ ├──────────────────────────────────────────┤  │
│ │ Side-  │ │                                          │  │
│ │ bar    │ │                                          │  │
│ │        │ │          Main Content                    │  │
│ │ - Nav  │ │                                          │  │
│ │ - Quick│ │                                          │  │
│ │   acts │ │                                          │  │
│ │        │ │                                          │  │
│ │        │ │                                          │  │
│ └────────┘ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Sidebar (Collapsed: 48px, Expanded: 240px)
- Logo/wordmark at top
- Primary nav: Dashboard, POS, Inventory, Pharmacy, Reports
- Secondary: Settings, Admin (if role permits)
- Collapse toggle at bottom
- Active state: subtle background highlight, no heavy indicator

### Slide-out Panels (NOT modals)
- Product detail: slides from right (400px width)
- Sale detail: slides from right
- Quick actions: slides from right
- Full-width: never. Keep context visible.

---

## Typography

| Use | Font | Weight | Size |
|-----|------|--------|------|
| Page titles | Inter | 600 | 24px |
| Section headers | Inter | 600 | 18px |
| Body text | Inter | 400 | 14px |
| Table data | Inter | 400 | 13px |
| Prices/numbers | JetBrains Mono or system mono | 500 | 14px |
| Labels/captions | Inter | 500 | 12px |
| Keyboard shortcuts | Mono | 400 | 11px, in kbd element |

---

## Spacing & Grid

- Base unit: 4px
- Component padding: 8px, 12px, 16px, 24px
- Section spacing: 24px or 32px
- Card padding: 16px
- Table row height: 40px (comfortable) or 32px (compact)
- Max content width: none (fill available space — it's a desktop app)
- Minimum sidebar: 48px collapsed

---

## Color Tokens

```css
/* Light mode */
--background: 0 0% 100%;
--foreground: 222 47% 11%;
--muted: 210 40% 96%;
--muted-foreground: 215 16% 47%;
--border: 214 32% 91%;
--accent: 221 83% 53%;       /* Primary action color */
--destructive: 0 84% 60%;
--success: 142 71% 45%;
--warning: 38 92% 50%;

/* Dark mode */
--background: 222 47% 11%;
--foreground: 210 40% 98%;
--muted: 217 33% 17%;
--muted-foreground: 215 20% 65%;
--border: 217 33% 17%;
--accent: 217 91% 60%;
--destructive: 0 63% 31%;
--success: 142 69% 58%;
--warning: 48 96% 53%;
```

---

## Component Patterns

### Data Tables
- Sticky header
- Row hover highlight (subtle)
- Inline actions (appear on hover, right-aligned)
- Column sorting indicators
- Pagination at bottom (not infinite scroll for data tables)
- Empty state: illustration + clear action

### Forms
- Labels above inputs (not floating labels)
- Full-width inputs in panels
- Validation messages below field (red, 12px)
- Submit button bottom-right of form
- Cancel = close panel (no explicit cancel button needed)

### Empty States
- Centered in content area
- Small illustration or icon (muted)
- Title: what's missing
- Subtitle: what to do about it
- Single CTA button

### Loading States
- Skeleton screens for initial loads
- Inline spinners for actions (small, in-button)
- Never block the entire screen
- Optimistic updates where safe (e.g., adding to cart)

---

## Animation Guidelines

- **Duration:** 150ms for micro-interactions, 200ms for panels, 300ms for page transitions
- **Easing:** ease-out for entrances, ease-in for exits
- **What to animate:** panel slides, list reorders, status changes, hover states
- **What NOT to animate:** table data, form inputs, primary content
- **Rule:** if removing the animation makes the app worse to use, keep it. If it's purely decorative, remove it.

---

## POS-Specific Design

The POS screen breaks from the standard layout — it's optimized for speed:

```
┌────────────────────────────────────┬──────────────────────┐
│ [🔍 Search / Scan barcode...]      │  CART               │
├────────────────────────────────────┤                      │
│                                    │  Paracetamol 500mg   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│  2 × 50    = 100    │
│  │ Fav │ │ Fav │ │ Fav │ │ Fav ││                      │
│  │  1  │ │  2  │ │  3  │ │  4  ││  Amoxicillin        │
│  └─────┘ └─────┘ └─────┘ └─────┘│  1 × 200   = 200    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│                      │
│  │ Fav │ │ Fav │ │ Fav │ │ Fav ││                      │
│  │  5  │ │  6  │ │  7  │ │  8  ││                      │
│  └─────┘ └─────┘ └─────┘ └─────┘│──────────────────────│
│                                    │  Subtotal:      300  │
│  Search results appear here        │  Discount:        0  │
│  when typing...                    │  TOTAL:         300  │
│                                    │                      │
│                                    │ [💵 Cash] [📱 M-Pesa]│
│                                    │     [ PAY — F4 ]     │
└────────────────────────────────────┴──────────────────────┘
```

- Left: 60% width — search + quick grid + results
- Right: 40% width — cart + totals + pay
- No sidebar visible in POS mode (maximize selling space)
- Large touch targets on quick grid (min 64×64px)
- Monospace font for prices (aligned decimals)
- Cart items: swipe to remove (or Delete key)
- Total: largest text on screen (24px bold)
