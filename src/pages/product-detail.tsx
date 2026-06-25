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
import { Input } from "@/components/ui/input"
import { getProduct, type Product } from "@/services/inventory"
import { listVariants, type ProductVariant } from "@/services/retail"
import { useEntityHistory } from "@/hooks/use-entity-history"
import { Pencil, PlusCircle, Stack as Layers, ImageSquare } from "@phosphor-icons/react"
import { format, isAfter, isBefore, addDays } from "date-fns"
import { execute, query } from "@/lib/db"
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog"
import { VariantsDrawer } from "@/components/inventory/variants-drawer"
import { toast } from "sonner"

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n)

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
    <div className="flex flex-col gap-5 p-6 max-w-[1280px] mx-auto">
      <Breadcrumbs
        items={[
          { label: "Inventory", to: "/inventory" },
          { label: "Products", to: "/inventory/products" },
          { label: product.name },
        ]}
      />
      <BackButton fallback="/inventory/products" label="Back to products" />
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
            <Button size="sm" onClick={() => setReceiveOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              Receive stock
            </Button>
            <Button size="sm" variant="outline" onClick={() => setVariantsOpen(true)}>
              <Layers className="h-3.5 w-3.5" />
              Variants ({variants.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/inventory/products?edit=${product.id}`)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </>
        }
        stats={[
          { label: "On hand", value: onHand.toString(), tone: onHand <= 0 ? "danger" : onHand <= product.reorder_level ? "warning" : "muted" },
          { label: "Cost", value: KES(product.buying_price) },
          { label: "Sell", value: KES(product.selling_price) },
          { label: "Margin", value: margin !== null ? `${margin}%` : "—", tone: margin !== null && margin > 30 ? "positive" : "muted" },
          { label: "Value @ cost", value: KES(valueAtCost) },
          { label: "Reorder at", value: product.reorder_level.toString() },
        ]}
      />
      <LazyTabs
        tabs={[
          { id: "overview", label: "Overview", render: () => <OverviewTab product={product} /> },
          { id: "stock", label: "Stock", count: batches.length, render: () => <BatchesTab batches={batches} /> },
          { id: "variants", label: "Variants", count: variants.length, render: () => <VariantsTab variants={variants} onManage={() => setVariantsOpen(true)} /> },
          { id: "images", label: "Images", render: () => <ImagesTab product={product} onSaved={reload} /> },
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
  )
}

function OverviewTab({ product }: { product: Product }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="SKU" value={product.sku} />
      <Field label="Barcode" value={product.barcode} />
      <Field label="Unit" value={product.unit} />
      <Field label="Category" value={product.category_name ?? "Uncategorised"} />
      <Field label="VAT rate" value={`${product.tax_rate}%`} />
      <Field label="Reorder level" value={String(product.reorder_level)} />
      <Field label="Description" value={product.description} className="md:col-span-2" />
    </div>
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

function BatchesTab({ batches }: { batches: BatchRow[] }) {
  if (batches.length === 0) return <p className="text-sm text-muted-foreground">No batches yet.</p>
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <th className="text-left py-2 font-normal">Batch</th>
          <th className="text-left py-2 font-normal">Supplier</th>
          <th className="text-left py-2 font-normal">Received</th>
          <th className="text-left py-2 font-normal">Expires</th>
          <th className="text-right py-2 font-normal">Qty</th>
          <th className="text-right py-2 font-normal">Cost</th>
        </tr>
      </thead>
      <tbody>
        {batches.map((b) => {
          const isExpired = b.expiry_date && isBefore(new Date(b.expiry_date), new Date())
          const isExpiring = b.expiry_date && !isExpired && isBefore(new Date(b.expiry_date), addDays(new Date(), 30))
          return (
            <tr key={b.id} className="border-b border-foreground/5">
              <td className="py-2.5">{b.batch_number || "—"}</td>
              <td className="py-2.5">{b.supplier_name || "—"}</td>
              <td className="py-2.5 text-muted-foreground">{format(new Date(b.received_at), "d MMM yyyy")}</td>
              <td className={`py-2.5 ${isExpired ? "text-red-600" : isExpiring ? "text-amber-600" : "text-muted-foreground"}`}>
                {b.expiry_date ? format(new Date(b.expiry_date), "d MMM yyyy") : "—"}
              </td>
              <td className="py-2.5 text-right tabular-nums">{b.quantity}</td>
              <td className="py-2.5 text-right font-mono tabular-nums">{KES(b.buying_price)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SalesTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "product", id, limit: 50 })
  const sales = events.filter((e) => e.type === "sale")
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (sales.length === 0) return <p className="text-sm text-muted-foreground">Not sold yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {sales.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer"
          onClick={() => s.route && (window.location.href = s.route)}
        >
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{s.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(s.at), "d MMM yyyy · HH:mm")}
            </span>
          </div>
          <span className="font-mono text-[13px] tabular-nums">{KES(s.amount ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}

function SuppliersTab({ suppliers }: { suppliers: SupplierAggregate[] }) {
  if (suppliers.length === 0)
    return <p className="text-sm text-muted-foreground">No suppliers recorded yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {suppliers.map((s) => (
        <li
          key={s.supplier_id}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer"
          onClick={() => (window.location.href = `/suppliers/${s.supplier_id}`)}
        >
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{s.supplier_name}</span>
            <span className="text-[11px] text-muted-foreground">
              Last received {format(new Date(s.last_received), "d MMM yyyy")}
            </span>
          </div>
          <div className="flex gap-4">
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{s.total_qty}</span>
            <span className="font-mono text-[13px] tabular-nums">{KES(s.total_cost)}</span>
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
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li
          key={e.id}
          className="grid grid-cols-[80px_1fr_auto] items-baseline gap-4 border-b border-foreground/5 pb-2.5"
        >
          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {format(new Date(e.at), "d MMM HH:mm")}
          </time>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{e.label}</span>
            {e.summary && <span className="text-[12px] text-muted-foreground">{e.summary}</span>}
          </div>
          {e.amount !== undefined && (
            <span className="font-mono text-[12px] tabular-nums">{KES(e.amount)}</span>
          )}
        </li>
      ))}
    </ol>
  )
}


function VariantsTab({ variants, onManage }: { variants: ProductVariant[]; onManage: () => void }) {
  if (variants.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-foreground/15 p-8 text-center">
        <Layers className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No variants yet. Variants let you track stock per colour, size, shade, or any axis.
        </p>
        <Button size="sm" className="mt-4" onClick={onManage}>
          <Layers className="h-3.5 w-3.5" />
          Add variants
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {variants.length} variant{variants.length === 1 ? "" : "s"}. Click the button to add, edit, or retire any.
        </p>
        <Button size="sm" variant="outline" onClick={onManage}>
          <Layers className="h-3.5 w-3.5" />
          Manage variants
        </Button>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="text-left py-2 font-normal">Variant</th>
            <th className="text-left py-2 font-normal">SKU</th>
            <th className="text-left py-2 font-normal">Axis</th>
            <th className="text-right py-2 font-normal">Cost</th>
            <th className="text-right py-2 font-normal">Sell</th>
            <th className="text-right py-2 font-normal">Stock</th>
            <th className="text-left py-2 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id} className="border-b border-foreground/5">
              <td className="py-2.5">{v.variant_name}</td>
              <td className="py-2.5 font-mono text-[11px] text-muted-foreground">{v.variant_sku}</td>
              <td className="py-2.5 text-[12px] text-muted-foreground">
                {[v.color, v.size, v.shade].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">
                {v.buying_price !== null ? KES(v.buying_price) : "—"}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">
                {v.selling_price !== null ? KES(v.selling_price) : "—"}
              </td>
              <td className="py-2.5 text-right font-mono tabular-nums">{v.stock_qty}</td>
              <td className="py-2.5">
                {v.active ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                    Active
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Retired
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImagesTab({ product, onSaved }: { product: Product; onSaved: () => void }) {
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
      <div className="flex flex-col gap-3">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Image URL
        </label>
        <Input
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://example.com/cement-50kg.jpg  or  file:///C:/Users/.../image.jpg"
        />
        <p className="text-[12px] text-muted-foreground leading-[1.55]">
          Paste a web URL (https://…) or a local file path (file:///C:/…). Local paths
          work because Omnix runs as a desktop app and has filesystem access. Use a hosted
          URL if you sync across machines.
        </p>
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
      </div>
    </div>
  )
}
