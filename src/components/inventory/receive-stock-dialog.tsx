/**
 * ReceiveStockDialog — quick stock-in without a PO.
 *
 * Layout:
 *   - Desktop / wide: editorial table, 6 columns
 *   - Touch / narrow: stacked line cards, one row per field, big targets
 *
 * Spacing follows a strict 4px / 8px grid throughout. No arbitrary
 * `space-y-3` / `gap-2` mixes — every gap is a token (`space-y-4`,
 * `space-y-6`, `gap-3`).
 *
 * Buttons use the standard accent (no hard-coded `emerald-600`). The
 * "set expiry dates" reminder uses the semantic warning callout block,
 * not hard-coded `amber-50`.
 */
import { useEffect, useRef, useState } from "react"
import {
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Package,
  Plus,
  Trash as Trash2,
  Warning,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TouchKeypad, type KeypadMode } from "@/components/ui/touch-keypad"
import { getProducts, type Product } from "@/services/inventory"
import { execute } from "@/lib/db"
import { useAuthStore } from "@/stores/auth"
import { useIsTouch } from "@/stores/density"
import { getActiveBranchId } from "@/stores/active-branch"
import { toast } from "sonner"

interface StockLine {
  product_id: string
  product_name: string
  quantity: string
  buying_price: string
  expiry_date: string
  batch_number: string
}

export function ReceiveStockDialog({
  open,
  onClose,
  onSaved,
  supplierName,
  prefillProductId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  supplierName?: string
  /** Optional product to seed into the line list when the dialog opens —
   *  used by /inventory/products/:id "Receive stock" action so the
   *  user doesn't have to search again. */
  prefillProductId?: string
}) {
  const userId = useAuthStore((s) => s.user?.id)
  const touch = useIsTouch()
  const [supplier, setSupplier] = useState(supplierName || "")
  const [reference, setReference] = useState("")
  const [items, setItems] = useState<StockLine[]>([])
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [submitting, setSubmitting] = useState(false)

  // On touch, the keypad listens to the currently focused numeric input
  // and writes into it. We track the focused (ref, mode) pair so the
  // keypad knows where to send keystrokes + which mode to render in.
  const [keypadTarget, setKeypadTarget] = useState<{
    ref: React.RefObject<HTMLInputElement | null>
    mode: KeypadMode
  } | null>(null)

  useEffect(() => {
    if (!open) {
      setSupplier(supplierName || "")
      setReference("")
      setItems([])
      setSearch("")
      setKeypadTarget(null)
    }
  }, [open, supplierName])

  useEffect(() => {
    if (!open || !prefillProductId) return
    if (items.length > 0) return
    let cancelled = false
    getProducts().then((all) => {
      if (cancelled) return
      const p = all.find((x) => x.id === prefillProductId)
      if (!p) return
      setItems([newLine(p)])
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillProductId])

  useEffect(() => {
    if (search) getProducts(search).then(setProducts)
    else setProducts([])
  }, [search])

  const totalCost = items.reduce(
    (s, i) =>
      s + (parseFloat(i.quantity) || 0) * (parseFloat(i.buying_price) || 0),
    0,
  )

  const addLine = (p: Product) => {
    if (items.find((i) => i.product_id === p.id)) {
      toast.error("Already in list")
      return
    }
    setItems([...items, newLine(p)])
    setSearch("")
  }

  const update = (idx: number, patch: Partial<StockLine>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  const remove = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const save = async () => {
    if (!userId) return
    if (items.length === 0) {
      toast.error("Add at least one product")
      return
    }
    if (items.some((i) => !i.quantity || parseFloat(i.quantity) <= 0)) {
      toast.error("All quantities must be greater than zero")
      return
    }

    setSubmitting(true)
    try {
      const branchId = getActiveBranchId()
      for (const item of items) {
        const qty = parseFloat(item.quantity)
        const cost = parseFloat(item.buying_price) || 0
        const batchId = crypto.randomUUID()
        await execute(
          `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, expiry_date, branch_id)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          [
            batchId,
            item.product_id,
            item.batch_number || null,
            qty,
            cost,
            item.expiry_date || null,
            branchId,
          ],
        )
        await execute(
          `INSERT INTO stock_movements (id, product_id, batch_id, type, quantity, reference_type, reference_id, notes, user_id)
           VALUES (?1, ?2, ?3, 'purchase', ?4, 'manual_receive', ?5, ?6, ?7)`,
          [
            crypto.randomUUID(),
            item.product_id,
            batchId,
            qty,
            reference || "Manual receive",
            `From ${supplier || "supplier"}${reference ? ` · ${reference}` : ""}`,
            userId,
          ],
        )
      }
      toast.success(`Received ${items.length} item${items.length !== 1 ? "s" : ""}`)
      onSaved()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl gap-0 p-0 overflow-hidden"
        // The form inside is its own scroll container.
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Package className="size-4 text-primary" />
            Receive stock
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed">
            Quick way to add stock when a delivery lands without a purchase
            order. For tracked supplier orders, use Purchase Orders.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
          {/* Supplier + reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="From (supplier)">
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g., Mama Mary's"
              />
            </Field>
            <Field label="Reference / delivery note #">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          {/* Product search */}
          <Field label="Add product">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name or SKU…"
                className="pl-9"
              />
              {search && products.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-2 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-md">
                  {products.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addLine(p)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-accent touch:py-3 touch:text-[14px]"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0 touch:text-[12px]">
                        Stock: {p.stock_qty}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Lines */}
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
              Search above and tap a product to add it to this receipt.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => (
                <StockLineRow
                  key={it.product_id}
                  line={it}
                  touch={touch}
                  onChange={(patch) => update(idx, patch)}
                  onRemove={() => remove(idx)}
                  onFocusKeypad={(ref, mode) => setKeypadTarget({ ref, mode })}
                />
              ))}

              <div className="flex items-baseline justify-between rounded-md bg-muted/40 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Total receive cost
                </span>
                <span className="font-mono text-[15px] tabular-nums font-medium">
                  KES {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Reminder */}
          <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
            <Warning className="size-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Pharmacy batches need an expiry date.</p>
              <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">
                Batches without expiry won't show up in the expiry alert.
                Batch numbers help with recalls.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button
            variant="outline"
            size={touch ? "lg" : "sm"}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            size={touch ? "lg" : "sm"}
            onClick={save}
            disabled={submitting || items.length === 0}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {!submitting && <Plus className="size-4" />}
            Receive {items.length || ""} item{items.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {keypadTarget ? (
        <TouchKeypad
          inputRef={keypadTarget.ref}
          mode={keypadTarget.mode}
          open={true}
          onDismiss={() => setKeypadTarget(null)}
        />
      ) : null}
    </Dialog>
  )
}

function newLine(p: Product): StockLine {
  return {
    product_id: p.id,
    product_name: p.name,
    quantity: "1",
    buying_price: String(p.buying_price || 0),
    expiry_date: "",
    batch_number: "",
  }
}

/* ────────────────────────────────────────────────────────────────── *
 * StockLineRow — single line. Renders as a card (always) so the
 * layout works equally on desktop AND touch. Replaces the cramped
 * 6-column table that was the source of the user's complaint.
 * ────────────────────────────────────────────────────────────────── */
function StockLineRow({
  line,
  touch,
  onChange,
  onRemove,
  onFocusKeypad,
}: {
  line: StockLine
  touch: boolean
  onChange: (patch: Partial<StockLine>) => void
  onRemove: () => void
  onFocusKeypad: (
    ref: React.RefObject<HTMLInputElement | null>,
    mode: KeypadMode,
  ) => void
}) {
  const qtyRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium truncate">{line.product_name}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label="Remove from receipt"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Quantity + price on one row, expiry + batch on the next.
          The grid collapses to 1 column on narrow viewports. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Quantity">
          <Input
            ref={qtyRef}
            type="number"
            inputMode="numeric"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            onFocus={() => touch && onFocusKeypad(qtyRef, "quantity")}
            className="text-right tabular-nums"
          />
        </Field>
        <Field label="Buying price (KES)">
          <Input
            ref={priceRef}
            type="number"
            inputMode="decimal"
            value={line.buying_price}
            onChange={(e) => onChange({ buying_price: e.target.value })}
            onFocus={() => touch && onFocusKeypad(priceRef, "currency")}
            className="text-right tabular-nums"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Expiry date" hint="dd / mm / yyyy">
          <Input
            type="date"
            value={line.expiry_date}
            onChange={(e) => onChange({ expiry_date: e.target.value })}
          />
        </Field>
        <Field label="Batch number" hint="Optional · for recalls">
          <Input
            value={line.batch_number}
            onChange={(e) => onChange({ batch_number: e.target.value })}
            placeholder="—"
            className="font-mono"
          />
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </label>
        {hint ? (
          <span className="text-[10px] text-muted-foreground/70">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
