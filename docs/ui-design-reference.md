# UI Design Reference — SokoOS

## Design Philosophy

SokoOS must feel like Linear, Notion, or Figma — NOT like a Windows Forms app, NOT like a Bootstrap admin template.

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
