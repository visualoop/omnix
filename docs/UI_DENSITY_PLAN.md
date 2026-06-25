# UI Density · Touch · Tests — Plan

Audit triggered by user feedback: "the receive stock inputs collide, bad
paddings everything is bad … plan for touch screens (POS sale on
touchscreen needs an on-screen input) … write tests for the entire repo
so paddings/margins/UX experience is better".

## Findings (the inventory)

**38 dialogs/modals** across `src/`. Spot-checking the worst offenders:

| File | Symptom |
|---|---|
| `components/inventory/receive-stock-dialog.tsx` | `h-7` inputs in a 6-column table at `max-w-3xl` → cells squeeze, Expiry overlaps Batch; mixes `space-y-3`, `py-2`, `gap-2`, `px-1 py-1`, `px-2 py-1.5` (no consistent step); footer button hard-codes `emerald-600` (breaks one-accent rule) |
| `components/pos/payment-modal.tsx` | POS-critical, runs on touch terminals → uses default `h-8` inputs |
| `components/pos/cash-dialogs.tsx` | Cash counts use desktop inputs even though POS keypads are touch |
| `components/pos/qty-multiplier-dialog.tsx` | "Tap product, type qty" but no on-screen keypad on touch |
| `components/pos/tip-dialog.tsx` | Same — typing on a touch screen with no keyboard |
| `pages/cash-register.tsx` | Opening/closing float entered on touch screen with text inputs |
| `pages/payroll.tsx` | 5 dialogs, mixed paddings |

**Root causes**
1. `Input` is `h-8 px-2.5 py-1 text-[13px]` — fine for desktop, hostile on touch (min target 44×48px per Apple HIG / Material 48dp).
2. No density tokens. Each dialog picks its own `space-y-{1,2,3}` + `gap-{1,2,3}` mix.
3. No touch-input infrastructure. Tauri devs assume hardware keyboard.
4. No UI tests for spacing/sizing invariants.

## The plan

### Phase 1 — Density tokens + touch detection (foundation)

- New `src/lib/density.ts` exporting `Density = "comfortable" | "touch"`, a default detection helper (matches `(pointer: coarse)` and screen width < 1024), and a Zustand store for the explicit setting (user can override auto-detect from Settings → Display).
- New `useDensity()` hook + `<DensityProvider>` wrapping the app shell so any child component can adjust target sizes.
- Tailwind density utility classes via `data-density="touch"` selectors:
  - `input[data-touch]` → `min-h-11 text-[15px] px-3`
  - `button[data-touch]` → `min-h-11 px-4 text-[14px]`
- Settings toggle at `/settings/display` ("Touch mode — bigger targets for tablet/touchscreen POS use").

### Phase 2 — On-screen keypad component

- `src/components/ui/touch-keypad.tsx` — slide-up panel anchored to the bottom of the screen, shown when a numeric input is focused **and** density === "touch".
- Numeric layout (0-9, `.`, ⌫, Enter). Inserts directly into the focused input via the existing ref API.
- For text inputs, fall back to the OS keyboard (Tauri exposes the on-screen keyboard on Windows tablets via `tauri-plugin-os` already).
- Variants:
  - `keypad="number"` — 0-9 + . + ⌫
  - `keypad="currency"` — same plus 00, 000 shortcuts
  - `keypad="quantity"` — same plus +1, +5, +10, ×2

### Phase 3 — Receive Stock rewrite (proof of concept)

- Replace the 6-column table with **stacked line cards** on small/touch viewports (≥md keeps the table for desktop power users).
- Apply 8px grid consistently: every gap/padding is a multiple of 4 (`gap-2`, `gap-3`, `gap-4`, `p-3`, `p-4`).
- Drop hard-coded `emerald-600` button color; use the standard accent.
- Drop hard-coded `amber-50` warning; use the existing semantic alert token.
- Wire `keypad="quantity"` to the qty input, `keypad="currency"` to buy price.

### Phase 4 — Audit + fix top 10 worst dialogs

Priority order (POS-critical first, since touch matters there):

1. `pos/qty-multiplier-dialog.tsx`
2. `pos/payment-modal.tsx`
3. `pos/cash-dialogs.tsx`
4. `pos/tip-dialog.tsx`
5. `pos/promo-dialog.tsx`
6. `pos/dose-calculator.tsx`
7. `pages/cash-register.tsx`
8. `inventory/variants-dialog.tsx`
9. `pages/payroll.tsx`
10. `hospitality/compact-form-dialog.tsx`

### Phase 5 — UI tests

- Add `tests/ui/density.spec.tsx` — renders sampled dialogs in both densities, asserts:
  - Touch density gives `input[type=number|tel|text]` min-height ≥ 44px
  - Buttons in dialog footers min-height ≥ 40px (desktop) / 44px (touch)
  - DialogContent has `max-w-*` matching its class contract
- Add `tests/ui/spacing.spec.tsx` — renders dialogs, walks the DOM, asserts that no two adjacent flex children use overlapping margin (collision detector — checks computed padding × gap consistency).
- Add `tests/ui/a11y.spec.tsx` — uses `@axe-core/playwright` (or `vitest-axe` for component-level) to assert no critical violations.
- Wire to CI: `pnpm vitest run tests/ui/**` runs on every PR.

### Phase 6 — Documentation + visual baseline

- `docs/UI_GUIDE.md` — the spacing/density conventions in one place so future contributors don't re-introduce the chaos.
- (Stretch) `pnpm exec playwright test --update-snapshots` against a dev build to lock the visual baseline. Only run on a future CI machine because Playwright in this sandbox is heavyweight.

## Touch-mode UX rules (one-pager)

1. **Auto-detect** — if `matchMedia('(pointer: coarse)')` matches, density defaults to "touch". User can flip back to "comfortable" in Settings.
2. **Targets** — never smaller than 44×44 (Apple HIG). Buttons in dialog footers go to 48 in touch mode.
3. **Type scale** — body bumps from 13px → 15px in touch mode. Avoid 11px utility labels entirely on touch.
4. **Padding** — dialog content uses `p-4` not `p-2` in touch mode; cards use `p-4` not `p-3`.
5. **Numeric inputs** — always pair with `<TouchKeypad>` in touch mode. The OS keyboard is for text only.
6. **Confirmation** — destructive actions get a dedicated confirm modal, not a tooltip. Fat fingers slip.
7. **No hover-only states** — every action must work via tap. Replace tooltips with always-visible meta lines.
