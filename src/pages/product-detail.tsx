/**
 * Product detail page — /inventory/products/:id
 *
 * Editorial layout: Breadcrumbs + Back + EntityHero with stats +
 * 6 lazy-mounted tabs.
 *
 * Tabs:
 *   - Overview      identity, pricing, tax, stock by branch
 *   - Stock         batch list + total on-hand + reorder gauge
 *   - Sales         every line-item this product has appeared in
 *   - Suppliers     who's supplied it + history
 *   - Batches       expanded batch list with expiry / cost
 *   - Notes         free-text notes + change log
 *
 * Header actions:
 *   - Receive stock (#42) — opens the existing ReceiveStockDialog
 *   - Edit          opens the existing ProductPanel in edit mode
 *
 * Receive-stock semantics: the dialog INSERTs a new batch row, which
 * adds to existing stock (sum of all batches). It does NOT overwrite
 * the previous quantity. Confirmed via inventory schema (batches table
 * is append-only, stock_qty is computed via SUM).
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input";
import { UnitSelect } from "@/components/ui/unit-select"
import { Combobox } from "@/components/ui/combobox"
import { getProduct, updateProduct, getCategories, getProducts, type Product, type Category } from "@/services/inventory"
import {
  getSubstitutions,
  addSubstitution,
  removeSubstitution,
  suggestSubstitutionsFromGeneric,
  type SubstitutionWithProduct,
} from "@/services/pharmacy-extras"
import { execute, query } from "@/lib/db"
import { listVariants, type ProductVariant } from "@/services/retail"
import { listUnits, warrantyState, warrantyDaysRemaining, type EquipmentUnit } from "@/services/equipment"
import { useEntityHistory } from "@/hooks/use-entity-history"
import { Pencil, PlusCircle, Stack as Layers, ImageSquare, Check, X as XIcon, Folder, ShoppingCart } from "@phosphor-icons/react"
import { format, isAfter, isBefore, addDays } from "date-fns"
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog"
import { VariantsDrawer } from "@/components/inventory/variants-drawer"
import { toast } from "sonner"
import { confirm } from "@/components/ui/confirm-dialog"
import { MobileRouteContext } from "@/components/shared/mobile-route-context"
import { useAuthStore } from "@/stores/auth"
import { hasPermission } from "@/lib/permissions"
import { money } from "@/lib/money"

interface BatchRow {
  id: string
  batch_number: string | null
  quantity: number
  buying_price: number
  expiry_date: string | null
  received_at: string
  supplier_id: string | null
  supplier_name: string | null
}

interface SupplierAggregate {
  supplier_id: string
  supplier_name: string
  total_qty: number
  total_cost: number
  last_received: string
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierAggregate[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [variantsOpen, setVariantsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const user = useAuthStore((state) => state.user)
  const canEdit = hasPermission(user, "inventory.edit")
  const canCreatePo = hasPermission(user, "purchase_orders.create")

  const reload = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getProduct(id),
      query<BatchRow>(
        `SELECT b.id, b.batch_number, b.quantity, b.buying_price, b.expiry_date, b.received_at,
                b.supplier_id, s.name as supplier_name
         FROM batches b
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.product_id = ?1
         ORDER BY b.received_at DESC`,
        [id],
      ),
      query<SupplierAggregate>(
        `SELECT b.supplier_id, s.name as supplier_name,
                SUM(b.quantity) as total_qty,
                SUM(b.quantity * b.buying_price) as total_cost,
                MAX(b.received_at) as last_received
         FROM batches b
         JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.product_id = ?1 AND b.supplier_id IS NOT NULL
         GROUP BY b.supplier_id, s.name
         ORDER BY total_cost DESC`,
        [id],
      ),
      listVariants(id, true).catch(() => [] as ProductVariant[]),
    ])
      .then(([p, b, sup, vars]) => {
        setProduct(p)
        setBatches(b)
        setSuppliers(sup)
        setVariants(vars)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading product…</div>
  if (!product) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/inventory/products" />
        <p className="text-sm text-muted-foreground">Product not found.</p>
      </div>
    )
  }

  const onHand = batches.reduce((s, b) => s + b.quantity, 0)
  const valueAtCost = batches.reduce((s, b) => s + b.quantity * b.buying_price, 0)
  const margin = product.selling_price && product.buying_price
    ? Math.round(((product.selling_price - product.buying_price) / product.selling_price) * 100)
    : null
  const expiringSoon = batches.filter(
    (b) =>
      b.expiry_date &&
      isAfter(new Date(b.expiry_date), new Date()) &&
      isBefore(new Date(b.expiry_date), addDays(new Date(), 30)),
  ).length
  const expired = batches.filter(
    (b) => b.expiry_date && isBefore(new Date(b.expiry_date), new Date()),
  ).length

  return (
    <div className="p-4 sm:p-6">
      <BackButton fallback="/inventory/products" label="Back to products" />
      <div className="mt-3">
        <MobileRouteContext />
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-[1280px] flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Inventory", to: "/inventory" },
          { label: "Products", to: "/inventory/products" },
          { label: product.name },
        ]}
      />
      <EntityHero
        eyebrow="Product"
        title={product.name}
        subtitle={[product.sku, product.barcode, product.unit, product.category_name]
          .filter(Boolean)
          .join(" · ") || "No identifiers"}
        badges={[
          ...(onHand <= 0 ? [{ label: "Out of stock", variant: "destructive" as const }] : []),
          ...(onHand > 0 && onHand <= product.reorder_level ? [{ label: "Low stock", variant: "outline" as const }] : []),
          ...(expired > 0 ? [{ label: `${expired} expired`, variant: "destructive" as const }] : []),
          ...(expiringSoon > 0 ? [{ label: `${expiringSoon} expiring`, variant: "outline" as const }] : []),
        ]}
        actions={
          <>
            {canEdit && (
              <Button size="sm" onClick={() => setReceiveOpen(true)} className="min-h-11 flex-1 sm:flex-none lg:min-h-0">
                <PlusCircle className="h-3.5 w-3.5" />
                Receive stock
              </Button>
            )}
            {canCreatePo && (
              <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none lg:min-h-0" onClick={() => navigate("/purchase-orders/new", { state: { poSeed: { items: [{ product_id: product.id, product_name: product.name, quantity: Math.max(1, product.reorder_level - onHand), unit_cost: product.buying_price || 0 }] } } })}>
                <ShoppingCart className="h-3.5 w-3.5" />
                Reorder
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)} className="min-h-11 flex-1 sm:flex-none lg:min-h-0">
                  <Layers className="h-3.5 w-3.5" />
                  Variants ({variants.length})
                </Button>
                <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((value) => !value)} className="min-h-11 flex-1 sm:flex-none lg:min-h-0">
                  <Pencil className="h-3.5 w-3.5" />
                  {editing ? "Done editing" : "Edit"}
                </Button>
              </>
            )}
          </>
        }
        stats={[
          { label: "On hand", value: onHand.toString(), tone: onHand <= 0 ? "danger" : onHand <= product.reorder_level ? "warning" : "muted" },
          { label: "Cost", value: money(product.buying_price) },
          { label: "Sell", value: money(product.selling_price) },
          { label: "Margin", value: margin !== null ? `${margin}%` : "—", tone: margin !== null && margin > 30 ? "positive" : "muted" },
          { label: "Value @ cost", value: money(valueAtCost) },
          { label: "Reorder at", value: product.reorder_level.toString() },
        ]}
      />
      <LazyTabs
        className="[&_[role=tablist]]:flex-nowrap [&_[role=tablist]]:overflow-x-auto lg:[&_[role=tablist]]:flex-wrap lg:[&_[role=tablist]]:overflow-visible"
        tabs={[
          { id: "overview", label: "Overview", render: () => <OverviewTab product={product} editing={editing} onSaved={() => { setEditing(false); reload() }} /> },
          { id: "stock", label: "Stock", count: batches.length, render: () => <BatchesTab batches={batches} canReceive={canEdit} onReceive={() => setReceiveOpen(true)} /> },
          { id: "variants", label: "Variants", count: variants.length, render: () => <VariantsTab variants={variants} canManage={canEdit} onManage={() => setVariantsOpen(true)} /> },
          ...(((product as unknown as { tracked_by_serial?: number }).tracked_by_serial === 1)
            ? [{ id: "units", label: "Units", render: () => <UnitsTab productId={product.id} /> }]
            : []),
          { id: "substitutes", label: "Substitutes", render: () => <SubstitutesTab product={product} canEdit={canEdit} /> },
          { id: "images", label: "Images", render: () => <ImagesTab product={product} onSaved={reload} canEdit={canEdit} /> },
          { id: "sales", label: "Sales", render: () => <SalesTab id={product.id} /> },
          { id: "suppliers", label: "Suppliers", count: suppliers.length, render: () => <SuppliersTab suppliers={suppliers} /> },
          { id: "activity", label: "Activity", render: () => <ActivityTab id={product.id} /> },
        ]}
      />
      <ReceiveStockDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onSaved={() => {
          setReceiveOpen(false)
          reload()
        }}
        prefillProductId={product.id}
      />
      <VariantsDrawer
        productId={product.id}
        productName={product.name}
        open={variantsOpen}
        onOpenChange={(o) => {
          setVariantsOpen(o)
          if (!o) reload()
        }}
      />
      </div>
    </div>
  )
}

function OverviewTab({ product, editing, onSaved }: { product: Product; editing: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState({
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    unit: product.unit ?? "pcs",
    reorder_level: product.reorder_level,
    tax_rate: product.tax_rate,
    description: product.description ?? "",
    name: product.name,
    buying_price: product.buying_price,
    selling_price: product.selling_price,
    category_id: product.category_id ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  // Re-sync draft when product changes (e.g. after reload).
  useEffect(() => {
    setDraft({
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      unit: product.unit ?? "pcs",
      reorder_level: product.reorder_level,
      tax_rate: product.tax_rate,
      description: product.description ?? "",
      name: product.name,
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      category_id: product.category_id ?? "",
    })
  }, [product])

  // Load categories when entering edit mode.
  useEffect(() => {
    if (!editing) return
    getCategories().then(setCategories).catch(() => {})
  }, [editing])

  const save = async () => {
    setSaving(true)
    try {
      await updateProduct(product.id, {
        name: draft.name,
        sku: draft.sku || undefined,
        barcode: draft.barcode || undefined,
        unit: draft.unit,
        reorder_level: draft.reorder_level,
        tax_rate: draft.tax_rate,
        description: draft.description,
        buying_price: draft.buying_price,
        selling_price: draft.selling_price,
        category_id: draft.category_id || undefined,
      })
      toast.success("Product updated")
      onSaved()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Name" value={product.name} className="md:col-span-2" />
        <Field label="SKU" value={product.sku} />
        <Field label="Barcode" value={product.barcode} />
        <Field label="Unit" value={product.unit} />
        <Field label="Category" value={product.category_name ?? "Uncategorised"} />
        <Field label="VAT rate" value={`${product.tax_rate}%`} />
        <Field label="Reorder level" value={String(product.reorder_level)} />
        <Field label="Cost" value={money(product.buying_price)} />
        <Field label="Sell" value={money(product.selling_price)} />
        <Field label="Description" value={product.description} className="md:col-span-2" />
      </div>
    )
  }

  // Edit mode — each field is an Input. Save / Cancel pinned at the
  // bottom right so the user sees their change before committing.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <EditField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required className="md:col-span-2" />
        <EditField label="SKU" value={draft.sku} onChange={(v) => setDraft({ ...draft, sku: v })} />
        <EditField label="Barcode" value={draft.barcode} onChange={(v) => setDraft({ ...draft, barcode: v })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Unit</label>
          <UnitSelect value={draft.unit} onChange={(v) => setDraft({ ...draft, unit: v })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Category
          </label>
          <Combobox
            value={draft.category_id}
            onChange={(v) => setDraft({ ...draft, category_id: v })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Uncategorised"
            searchPlaceholder="Search or create category…"
            className="[&_button]:h-11 lg:[&_button]:h-9"
            onCreate={async (name) => {
              // Create the category inline so the user can keep typing
              // without leaving the form.
              const id = crypto.randomUUID()
              await execute(
                `INSERT INTO categories (id, name) VALUES (?1, ?2)`,
                [id, name],
              )
              const next = { value: id, label: name }
              const fresh: Category = { id, name, parent_id: null, sort_order: 0 }
              setCategories((prev) => [...prev, fresh])
              return next
            }}
          />
        </div>
        <EditField
          label="VAT rate (%)"
          type="number"
          value={String(draft.tax_rate)}
          onChange={(v) => setDraft({ ...draft, tax_rate: parseFloat(v) || 0 })}
        />
        <EditField
          label="Reorder level"
          type="number"
          value={String(draft.reorder_level)}
          onChange={(v) => setDraft({ ...draft, reorder_level: parseFloat(v) || 0 })}
        />
        <EditField
          label="Cost (buying)"
          type="number"
          value={String(draft.buying_price)}
          onChange={(v) => setDraft({ ...draft, buying_price: parseFloat(v) || 0 })}
        />
        <EditField
          label="Sell (retail)"
          type="number"
          value={String(draft.selling_price)}
          onChange={(v) => setDraft({ ...draft, selling_price: parseFloat(v) || 0 })}
        />
        <EditField
          label="Description"
          value={draft.description}
          onChange={(v) => setDraft({ ...draft, description: v })}
          multiline
          className="md:col-span-2"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-foreground/10 pt-4 [&_button]:min-h-11 lg:[&_button]:min-h-0">
        <Button type="button" variant="outline" size="sm" onClick={onSaved} disabled={saving}>
          <XIcon className="h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Check className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  multiline = false,
  className = "",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  multiline?: boolean
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {required ? <span className="text-rose-600">*</span> : null}
      </span>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="min-h-11 rounded-md border border-foreground/15 bg-background px-3 py-2 text-[14px] outline-none focus:border-foreground/40 resize-y"
          placeholder={placeholder}
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="h-11"
        />
      )}
    </label>
  )
}

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="text-[14px] text-foreground/90">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  )
}

function BatchesTab({ batches, canReceive, onReceive }: {
  batches: BatchRow[]
  canReceive: boolean
  onReceive: () => void
}) {
  if (batches.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center">
        <p className="text-sm text-muted-foreground">No stock has been received for this product.</p>
        {canReceive && <Button onClick={onReceive} className="mt-4 min-h-11"><PlusCircle className="size-4" /> Receive first stock</Button>}
      </div>
    )
  }
  const statusFor = (batch: BatchRow) => {
    const expired = batch.expiry_date && isBefore(new Date(batch.expiry_date), new Date())
    const expiring = batch.expiry_date && !expired && isBefore(new Date(batch.expiry_date), addDays(new Date(), 30))
    return { expired, expiring }
  }
  return (
    <>
      <div data-mobile-list="product-batches" className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 lg:hidden">
        {batches.map((batch) => {
          const { expired, expiring } = statusFor(batch)
          return (
            <article key={batch.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{batch.batch_number || "Unnumbered batch"}</p><p className="mt-0.5 text-xs text-muted-foreground">{batch.supplier_name || "No supplier recorded"}</p></div>
                <strong className="font-mono">{batch.quantity}</strong>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                <div><dt className="text-muted-foreground">Received</dt><dd>{format(new Date(batch.received_at), "d MMM yyyy")}</dd></div>
                <div><dt className="text-muted-foreground">Expires</dt><dd className={expired ? "text-red-600" : expiring ? "text-amber-600" : ""}>{batch.expiry_date ? format(new Date(batch.expiry_date), "d MMM yyyy") : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Unit cost</dt><dd className="font-mono">{money(batch.buying_price)}</dd></div>
              </dl>
            </article>
          )
        })}
      </div>
      <div data-desktop-table="product-batches" className="hidden overflow-x-auto lg:block">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="py-2 text-left font-normal">Batch</th><th className="py-2 text-left font-normal">Supplier</th><th className="py-2 text-left font-normal">Received</th><th className="py-2 text-left font-normal">Expires</th><th className="py-2 text-right font-normal">Qty</th><th className="py-2 text-right font-normal">Cost</th>
          </tr></thead>
          <tbody>{batches.map((batch) => { const { expired, expiring } = statusFor(batch); return (
            <tr key={batch.id} className="border-b border-foreground/5">
              <td className="py-2.5">{batch.batch_number || "—"}</td><td className="py-2.5">{batch.supplier_name || "—"}</td><td className="py-2.5 text-muted-foreground">{format(new Date(batch.received_at), "d MMM yyyy")}</td><td className={`py-2.5 ${expired ? "text-red-600" : expiring ? "text-amber-600" : "text-muted-foreground"}`}>{batch.expiry_date ? format(new Date(batch.expiry_date), "d MMM yyyy") : "—"}</td><td className="py-2.5 text-right tabular-nums">{batch.quantity}</td><td className="py-2.5 text-right font-mono tabular-nums">{money(batch.buying_price)}</td>
            </tr>
          ) })}</tbody>
        </table>
      </div>
    </>
  )
}

function SalesTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "product", id, limit: 50 })
  const sales = events.filter((e) => e.type === "sale")
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (sales.length === 0) return <p className="text-sm text-muted-foreground">Not sold yet.</p>
  return (
    <ul className="flex max-h-[60vh] flex-col divide-y divide-foreground/5 overflow-y-auto rounded-md border border-foreground/10">
      {sales.map((s) => (
        <li
          key={s.id}
          className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer"
          onClick={() => s.route && (window.location.href = s.route)}
        >
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{s.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(s.at), "d MMM yyyy · HH:mm")}
            </span>
          </div>
          <span className="font-mono text-[13px] tabular-nums">{money(s.amount ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}

function SuppliersTab({ suppliers }: { suppliers: SupplierAggregate[] }) {
  if (suppliers.length === 0)
    return <p className="text-sm text-muted-foreground">No suppliers recorded yet.</p>
  return (
    <ul className="flex max-h-[60vh] flex-col divide-y divide-foreground/5 overflow-y-auto rounded-md border border-foreground/10">
      {suppliers.map((s) => (
        <li
          key={s.supplier_id}
          className="flex min-h-11 items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer"
          onClick={() => (window.location.href = `/suppliers/${s.supplier_id}`)}
        >
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{s.supplier_name}</span>
            <span className="text-[11px] text-muted-foreground">
              Last received {format(new Date(s.last_received), "d MMM yyyy")}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:gap-4">
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{s.total_qty}</span>
            <span className="font-mono text-[13px] tabular-nums">{money(s.total_cost)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActivityTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "product", id, limit: 100 })
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
      {events.map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[64px_1fr] items-baseline gap-3 border-b border-foreground/5 pb-2.5 sm:grid-cols-[80px_1fr_auto] sm:gap-4"
        >
          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {format(new Date(e.at), "d MMM HH:mm")}
          </time>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{e.label}</span>
            {e.summary && <span className="text-[12px] text-muted-foreground">{e.summary}</span>}
          </div>
          {e.amount !== undefined && (
            <span className="col-start-2 font-mono text-[12px] tabular-nums sm:col-start-auto">{money(e.amount)}</span>
          )}
        </li>
      ))}
    </ol>
  )
}


function VariantsTab({ variants, canManage, onManage }: { variants: ProductVariant[]; canManage: boolean; onManage: () => void }) {
  if (variants.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center">
        <Layers className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No variants yet. Variants track stock by colour, size, shade, or another option.</p>
        {canManage && <Button className="mt-4 min-h-11" onClick={onManage}><Layers className="size-4" /> Add variants</Button>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{variants.length} variant{variants.length === 1 ? "" : "s"}.</p>
        {canManage && <Button variant="outline" onClick={onManage} className="min-h-11 sm:w-auto lg:min-h-0"><Layers className="size-4" /> Manage variants</Button>}
      </div>
      <div data-mobile-list="product-variants" className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 lg:hidden">
        {variants.map((variant) => (
          <article key={variant.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{variant.variant_name}</p><p className="truncate font-mono text-[11px] text-muted-foreground">{variant.variant_sku || "No SKU"}</p></div><span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${variant.active ? "text-emerald-600" : "text-muted-foreground"}`}>{variant.active ? "Active" : "Retired"}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{[variant.color, variant.size, variant.shade].filter(Boolean).join(" · ") || "No option values"}</p>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-muted-foreground">Stock</dt><dd className="font-mono">{variant.stock_qty}</dd></div><div><dt className="text-muted-foreground">Cost</dt><dd className="font-mono">{variant.buying_price !== null ? money(variant.buying_price) : "—"}</dd></div><div><dt className="text-muted-foreground">Sell</dt><dd className="font-mono">{variant.selling_price !== null ? money(variant.selling_price) : "—"}</dd></div></dl>
          </article>
        ))}
      </div>
      <div data-desktop-table="product-variants" className="hidden overflow-x-auto lg:block">
        <table className="w-full text-[13px]"><thead><tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><th className="py-2 text-left font-normal">Variant</th><th className="py-2 text-left font-normal">SKU</th><th className="py-2 text-left font-normal">Axis</th><th className="py-2 text-right font-normal">Cost</th><th className="py-2 text-right font-normal">Sell</th><th className="py-2 text-right font-normal">Stock</th><th className="py-2 text-left font-normal">Status</th></tr></thead>
          <tbody>{variants.map((variant) => <tr key={variant.id} className="border-b border-foreground/5"><td className="py-2.5">{variant.variant_name}</td><td className="py-2.5 font-mono text-[11px] text-muted-foreground">{variant.variant_sku}</td><td className="py-2.5 text-xs text-muted-foreground">{[variant.color, variant.size, variant.shade].filter(Boolean).join(" · ") || "—"}</td><td className="py-2.5 text-right font-mono">{variant.buying_price !== null ? money(variant.buying_price) : "—"}</td><td className="py-2.5 text-right font-mono">{variant.selling_price !== null ? money(variant.selling_price) : "—"}</td><td className="py-2.5 text-right font-mono">{variant.stock_qty}</td><td className={`py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] ${variant.active ? "text-emerald-600" : "text-muted-foreground"}`}>{variant.active ? "Active" : "Retired"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

function SubstitutesTab({ product, canEdit }: { product: Product; canEdit: boolean }) {
  const [subs, setSubs] = useState<SubstitutionWithProduct[]>([])
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; sku: string; selling_price: number; stock: number; generic_name: string }>>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const [s, g] = await Promise.all([
        getSubstitutions(product.id),
        suggestSubstitutionsFromGeneric(product.id).catch(() => []),
      ])
      setSubs(s)
      setSuggestions(g)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    getProducts().then((rows) => setAllProducts(rows.filter((p) => p.id !== product.id))).catch(() => {})
  }, [product.id])

  const add = async (substituteId: string) => {
    setAdding(true)
    try {
      await addSubstitution(product.id, substituteId)
      toast.success("Substitute added")
      await reload()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setAdding(false)
    }
  }

  const remove = async (substituteId: string) => {
    if (!(await confirm({ title: "Remove this substitute?", variant: "destructive" }))) return
    try {
      await removeSubstitution(product.id, substituteId)
      toast.success("Substitute removed")
      await reload()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const currentIds = new Set(subs.map((s) => s.substitute_product_id))
  const filteredSuggestions = suggestions.filter((s) => !currentIds.has(s.id))
  const pickableProducts = allProducts.filter((p) => !currentIds.has(p.id))

  return (
    <div className="flex flex-col gap-6">
      {/* Current substitutes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Current substitutes
            <span className="ml-2 tabular-nums text-foreground/70">{subs.length}</span>
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Suggested at POS when this product is out of stock or the patient asks for an alternative.
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : subs.length === 0 ? (
          <div className="rounded-md border border-dashed border-foreground/15 p-6 text-center text-[13px] text-muted-foreground">
            No substitutes set up yet. Use the picker below to add equivalents.
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
            {subs.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{s.substitute_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {s.substitute_sku ? `SKU ${s.substitute_sku} · ` : ""}
                    {s.substitute_generic ? `Generic: ${s.substitute_generic} · ` : ""}
                    Stock {s.substitute_stock}
                  </div>
                </div>
                <span className="font-mono tabular-nums text-[12px] text-muted-foreground">
                  {money(s.substitute_price)}
                </span>
                {canEdit && (
                  <Button variant="ghost" size="icon-xs" onClick={() => remove(s.substitute_product_id)} title="Remove substitute" className="min-h-11 min-w-11 lg:min-h-0 lg:min-w-0">
                    <XIcon className="h-3 w-3 text-rose-600" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Auto-suggestions from generic_name */}
      {filteredSuggestions.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Suggested · same generic
            <span className="ml-2 tabular-nums text-foreground/70">{filteredSuggestions.length}</span>
          </h3>
          <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10 bg-foreground/[0.02]">
            {filteredSuggestions.map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Generic: {s.generic_name} · Stock {s.stock}
                  </div>
                </div>
                <span className="font-mono tabular-nums text-[12px] text-muted-foreground">{money(s.selling_price)}</span>
                {canEdit && (
                  <Button size="sm" disabled={adding} onClick={() => add(s.id)} className="min-h-11 lg:min-h-0">
                    <PlusCircle className="h-3.5 w-3.5" /> Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Manual picker — any product */}
      {canEdit && <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Add any product as substitute
        </h3>
        <Combobox
          value=""
          onChange={(id) => {
            if (id) add(id)
          }}
          options={pickableProducts.map((p) => ({ value: p.id, label: p.name, hint: p.sku ?? undefined }))}
          placeholder="Search the catalogue…"
          searchPlaceholder="Type product name or SKU…"
          emptyText="No matches"
          disabled={adding}
        />
        <p className="text-[11px] leading-[1.55] text-muted-foreground">
          Use this when the substitute isn't a same-generic match (e.g. a different brand, a different
          dosage form, or a non-pharmacy alternative). Once added, the POS will offer it whenever the
          current product is dispensed or out of stock.
        </p>
      </section>}
    </div>
  )
}

function ImagesTab({ product, onSaved, canEdit }: { product: Product; onSaved: () => void; canEdit: boolean }) {
  const [draftUrl, setDraftUrl] = useState(product.image_path ?? "")
  const [saving, setSaving] = useState(false)

  const saveImage = async () => {
    setSaving(true)
    try {
      await execute(`UPDATE products SET image_path = ?1, updated_at = datetime('now') WHERE id = ?2`, [
        draftUrl.trim() || null,
        product.id,
      ])
      toast.success(draftUrl.trim() ? "Product image saved" : "Product image cleared")
      onSaved()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Local file picker — uses the same convertFileSrc trick the customer-
  // display playlist uses. The Tauri asset:// scope in tauri.conf.json
  // covers $HOME / $PICTURE / $DOWNLOAD etc., and the persisted-scope
  // plugin holds on to files outside that range across app restarts.
  const pickLocalImage = async () => {
    try {
      const [{ open: openFileDialog }, { convertFileSrc }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/api/core"),
      ])
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Image files",
            extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"],
          },
        ],
      })
      if (!picked || typeof picked !== "string") return
      setDraftUrl(convertFileSrc(picked))
      toast.success("Local image selected", { description: picked.split(/[\\/]/).pop() })
    } catch (e) {
      toast.error("Couldn't open file picker", { description: String(e) })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-2">
        <div className="aspect-square w-full rounded-md border border-foreground/10 bg-foreground/[0.02] overflow-hidden grid place-items-center">
          {draftUrl ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/img-redundant-alt
            <img
              src={draftUrl}
              alt={`Image for ${product.name}`}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <ImageSquare className="h-10 w-10 opacity-40" />
              <span className="text-[11px]">No image yet</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-[1.55]">
          Used on the POS product card watermark and on receipts that include images.
          Square images (1:1) render best.
        </p>
      </div>
      {canEdit ? <div className="flex flex-col gap-3 [&_button]:min-h-11 lg:[&_button]:min-h-0">
        {/* Picker row — same layout pattern as customer-display so the
            URL field below gets a full-width row of its own. */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={pickLocalImage}>
            <Folder className="h-3.5 w-3.5" />
            Pick local image
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground ml-auto">
            or paste a URL below
          </span>
        </div>

        <div className="border-t border-foreground/5 pt-3 flex flex-col gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Image URL
          </label>
          <Input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://example.com/cement-50kg.jpg"
            className="w-full font-mono text-[12px]"
          />
          <p className="text-[11px] text-muted-foreground leading-[1.55]">
            Paste a web URL (https://…) for an image hosted online — best when you sync
            across machines. Or use <span className="font-medium">Pick local image</span>{" "}
            above to load a file from this PC; the URL field auto-fills with an{" "}
            <span className="font-mono">asset://</span> path the desktop window can render.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={saveImage} disabled={saving}>
            {saving ? "Saving…" : "Save image"}
          </Button>
          {product.image_path ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftUrl("")
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div> : <div className="text-sm text-muted-foreground">You have view-only access to this product image.</div>}
    </div>
  )
}


function UnitsTab({ productId }: { productId: string }) {
  const [units, setUnits] = useState<EquipmentUnit[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { listUnits({ productId, limit: 500 }).then(setUnits).finally(() => setLoading(false)) }, [productId])
  const STATUS: Record<string, string> = { in_stock: "text-emerald-600", reserved: "text-amber-600", sold: "text-blue-600", rented: "text-violet-600", in_service: "text-orange-600", written_off: "text-red-600" }
  const warranty = (unit: EquipmentUnit) => { const state = warrantyState(unit.warranty_expiry); const days = warrantyDaysRemaining(unit.warranty_expiry); return { text: state === "none" ? "—" : state === "expired" ? "Expired" : days != null ? `${days}d left` : "Active", className: state === "expired" ? "text-red-600" : state === "expiring" ? "text-amber-600" : state === "active" ? "text-emerald-600" : "text-muted-foreground" } }
  if (loading) return <p className="text-sm text-muted-foreground">Loading units…</p>
  if (units.length === 0) return <p className="text-sm text-muted-foreground">Receive serialized stock to create the first unit.</p>
  return <>
    <div data-mobile-list="product-units" className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 lg:hidden">{units.map((unit) => { const w = warranty(unit); return <article key={unit.id} className="rounded-lg border border-border p-4"><p className="font-mono font-medium">{unit.serial_number}</p><div className="mt-2 flex justify-between text-xs"><span className={`capitalize ${STATUS[unit.status] ?? ""}`}>{unit.status.replace("_", " ")}</span><span className={w.className}>{w.text}</span></div></article> })}</div>
    <div data-desktop-table="product-units" className="hidden lg:block"><table className="w-full text-[13px]"><thead><tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><th className="py-2 text-left font-normal">Serial</th><th className="py-2 text-left font-normal">Status</th><th className="py-2 text-left font-normal">Warranty</th></tr></thead><tbody>{units.map((unit) => { const w = warranty(unit); return <tr key={unit.id} className="border-b border-foreground/5"><td className="py-2.5 font-mono">{unit.serial_number}</td><td className={`py-2.5 capitalize ${STATUS[unit.status] ?? ""}`}>{unit.status.replace("_", " ")}</td><td className={`py-2.5 ${w.className}`}>{w.text}</td></tr> })}</tbody></table></div>
  </>
}
