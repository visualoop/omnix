# UI Guide — spacing, density, touch

Every contributor MUST read this before touching a dialog, a form, or a
button. The chaos that prompted this guide (six different `space-y-*`
values inside a single dialog, hardcoded `bg-emerald-600` on primary
actions, 28px inputs in a 6-column table) is what we never want again.

## 1. Spacing scale — 8px grid, no exceptions

| Token | Pixels | Use |
|---|---|---|
| `gap-1.5` / `p-1.5` | 6 | Inside tight inline groups (icon + label) |
| `gap-2` / `p-2` | 8 | Small list rows, icon clusters |
| `gap-3` / `p-3` | 12 | Form field rows, callout boxes |
| `gap-4` / `p-4` | 16 | Section padding, card padding |
| `gap-5` / `p-5` | 20 | Dialog inner padding |
| `gap-6` / `space-y-6` | 24 | Between unrelated sections |
| `gap-8` | 32 | Page-level vertical rhythm |

**Never** use `gap-3.5`, `p-2.5` (except for very specific button cases
already cooked into the variants), `gap-9`, `gap-11`. The CI test in
`tests/ui/density.spec.tsx` enforces this on the receive-stock canonical
example — extend the test if you add a new canonical surface.

## 2. Density modes

Two modes:

- `comfortable` — 32px controls, 13px body. Desktop default.
- `touch` — ≥44px controls, 15px body. Tablet / POS terminal.

Detected automatically (`matchMedia('(pointer: coarse)')` + viewport
width). Operator can override in Settings → Display.

The `<html>` element gets a `data-density="…"` attribute. Tailwind
exposes a custom variant `touch:` you use exactly like `dark:`:

```tsx
<Input className="h-8 touch:h-11" />
<Button className="h-9 touch:h-12" />
```

The shipped `Input` and `Button` primitives already bake the touch
variants into their default classes — so for most code you don't have
to think about it. Only opt in manually when building something that's
NOT a wrapped primitive.

## 3. Touch keypads on numerics

POS terminals don't have keyboards. Any numeric input that lives inside
a dialog the cashier reaches via a touch tap MUST wire up the
`TouchKeypad` component:

```tsx
import { TouchKeypad } from "@/components/ui/touch-keypad"
import { useIsTouch } from "@/stores/density"

function MyDialog() {
  const touch = useIsTouch()
  const amountRef = useRef<HTMLInputElement>(null)
  const [keypadOpen, setKeypadOpen] = useState(false)
  return (
    <Dialog>
      <Input
        ref={amountRef}
        type="number"
        onFocus={() => touch && setKeypadOpen(true)}
      />
      <TouchKeypad
        inputRef={amountRef}
        mode="currency"
        open={keypadOpen}
        onDismiss={() => setKeypadOpen(false)}
        onCommit={() => save()}
      />
    </Dialog>
  )
}
```

Modes:
- `number` — 0-9, ., ⌫
- `currency` — adds 00 and 000 accelerators
- `quantity` — adds +1 / +5 / +10 / ×2 accelerators

## 4. Buttons — one accent, semantic variants

**Never** write `className="bg-emerald-600 hover:bg-emerald-700"` on a
primary button. The Button primitive's `default` variant is the only
accent. For destructive actions use `variant="destructive"`. For passive
secondary use `variant="outline"` or `variant="ghost"`.

| Variant | Use |
|---|---|
| `default` (no prop) | Primary CTA — Save, Apply, Receive, Submit |
| `outline` | Secondary — Cancel, Close, "Try another" |
| `ghost` | Tertiary — icon buttons in tables, dismiss icons |
| `destructive` | Delete, Void, Discard, Release |
| `secondary` | Rare — neutral chip-like CTAs |

If a workflow needs a color cue (e.g. tip is "rose", cash-in is "emerald"
in the cash-out / cash-in toggle), apply it to a small decorative chip
or icon — **not** the action button itself.

## 5. Dialog layout — the canonical shape

```tsx
<Dialog>
  <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden">
    <DialogHeader className="border-b border-border px-5 py-4">
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>One-line explainer.</DialogDescription>
    </DialogHeader>

    <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
      {/* fields here, grouped via <Field label="…">…</Field> wrappers */}
    </div>

    <DialogFooter className="border-t border-border px-5 py-4">
      <Button variant="outline">Cancel</Button>
      <Button>Primary action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- `gap-0 p-0 overflow-hidden` on `DialogContent` lets the header /
  scroll body / footer use their own padding and a hairline border.
- Body scrolls; header and footer stay pinned.
- Always cap content at `max-h-[70vh]` so the dialog doesn't escape the
  viewport on small monitors.

## 6. Forms — Field wrapper

Don't sprinkle `<label className="text-[11px] uppercase">` everywhere.
The receive-stock-dialog defines a `<Field>` wrapper — copy it (or
extract to `components/ui/field.tsx` if you find yourself doing it
twice). The label tokens (`font-mono text-[10px] uppercase
tracking-[0.18em] text-muted-foreground`) are the established editorial
voice.

## 7. Alerts and callouts — semantic only

For warnings, use the amber pattern from the receive-stock-dialog (or
the `<Alert>` primitive once it exists). For errors, the destructive
tokens. **Never** hardcode `bg-amber-50`; it breaks dark mode. Use
`bg-amber-500/10` with `border-amber-500/30` so the same node renders in
both themes.

## 8. Tables — collapse on small viewports

If a table has more than 4 columns and any column carries a numeric
input, render it as **stacked cards** at `sm:` breakpoints. See the
StockLineRow component for the canonical pattern. A 6-column 28px-input
table is the bug we're never shipping again.

## 9. Tests

`tests/ui/density.spec.tsx` runs on every CI build. It asserts:

1. Input and Button declare the right `touch:` variants
2. No primary CTA in the canonical dialogs uses a hardcoded color pair
3. receive-stock-dialog stays on the 8px spacing scale

Add to this file whenever you ship a new canonical surface. The tests
are cheap; the regressions they prevent are not.

## 10. When in doubt

Open `src/components/inventory/receive-stock-dialog.tsx` and mimic it.
That's the reference implementation. Anything you ship should pass the
same gut check — clean spacing, ≥44px targets in touch mode, accent
buttons only, semantic alerts, stacked cards on small viewports.
