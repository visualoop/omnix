/**
 * Supplier detail page — /suppliers/:id
 *
 * Tabs: Overview · Purchase orders · Products supplied · Activity
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import {
  getSupplier,
  listPurchaseOrders,
  type Supplier,
  type PurchaseOrder,
} from "@/services/erp"
import { Pencil, FileText, Plus } from "@phosphor-icons/react"
import { format } from "date-fns"
import { query } from "@/lib/db"

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n)

interface SuppliedProduct {
  id: string
  name: string
  sku: string | null
  total_qty: number
  total_cost: number
  last_received: string
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<SuppliedProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      getSupplier(id),
      listPurchaseOrders({ supplier_id: id }),
      query<SuppliedProduct>(
        `SELECT p.id, p.name, p.sku,
                COALESCE(SUM(b.quantity), 0) as total_qty,
                COALESCE(SUM(b.quantity * b.buying_price), 0) as total_cost,
                MAX(b.received_at) as last_received
         FROM batches b
         JOIN products p ON p.id = b.product_id
         WHERE b.supplier_id = ?1
         GROUP BY p.id, p.name, p.sku
         ORDER BY total_cost DESC
         LIMIT 50`,
        [id],
      ),
    ])
      .then(([s, p, prods]) => {
        if (!mounted) return
        setSupplier(s)
        setPos(p)
        setProducts(prods)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading supplier…</div>
  if (!supplier) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/suppliers" />
        <p className="text-sm text-muted-foreground">Supplier not found.</p>
      </div>
    )
  }

  const totalSpend = pos.reduce((s, p) => s + p.total, 0)
  const totalReceived = pos.filter((p) => p.status === "received").length

  return (
    <div className="p-6">
      <BackButton fallback="/suppliers" label="Back to suppliers" />
      <div className="flex flex-col gap-5 max-w-[1280px] w-full mx-auto mt-3">
      <Breadcrumbs items={[{ label: "Suppliers", to: "/suppliers" }, { label: supplier.name }]} />
      <EntityHero
        eyebrow="Supplier"
        title={supplier.name}
        subtitle={[supplier.contact_person, supplier.phone, supplier.email].filter(Boolean).join(" · ") || "No contact details"}
        badges={[
          ...(supplier.payment_terms ? [{ label: supplier.payment_terms, variant: "outline" as const }] : []),
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate(`/purchase-orders/new?supplier=${supplier.id}`)}>
              <Plus className="h-3.5 w-3.5" />
              New PO
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/suppliers")}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </>
        }
        stats={[
          { label: "Purchase orders", value: pos.length },
          { label: "Total spend", value: KES(totalSpend) },
          {
            label: "Owed",
            value: KES(supplier.balance_owed ?? 0),
            tone: (supplier.balance_owed ?? 0) > 0 ? "warning" : "muted",
          },
          { label: "Received POs", value: totalReceived },
        ]}
      />
      <LazyTabs
        tabs={[
          { id: "overview", label: "Overview", render: () => <OverviewTab supplier={supplier} /> },
          { id: "pos", label: "Purchase orders", count: pos.length, render: () => <PoListTab pos={pos} /> },
          { id: "products", label: "Products supplied", count: products.length, render: () => <ProductsTab products={products} /> },
        ]}
      />
      </div>
    </div>
  )
}

function OverviewTab({ supplier }: { supplier: Supplier }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Contact" value={supplier.contact_person} />
      <Field label="Phone" value={supplier.phone} />
      <Field label="Email" value={supplier.email} />
      <Field label="Payment terms" value={supplier.payment_terms} />
      <Field label="Address" value={supplier.address} className="md:col-span-2" />
      <Field label="Notes" value={supplier.notes} className="md:col-span-2" />
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

function PoListTab({ pos }: { pos: PurchaseOrder[] }) {
  if (pos.length === 0) return <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {pos.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer"
          onClick={() => (window.location.href = `/purchase-orders/${p.id}`)}
        >
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{p.po_number}</span>
              <span className="text-[11px] text-muted-foreground">
                {format(new Date(p.order_date), "d MMM yyyy")} · {p.status}
              </span>
            </div>
          </div>
          <span className="font-mono text-[13px] tabular-nums">{KES(p.total)}</span>
        </li>
      ))}
    </ul>
  )
}

function ProductsTab({ products }: { products: SuppliedProduct[] }) {
  if (products.length === 0)
    return <p className="text-sm text-muted-foreground">No products from this supplier yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {products.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{p.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {p.sku ?? "—"} · last {format(new Date(p.last_received), "d MMM yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{p.total_qty}</span>
            <span className="font-mono text-[13px] tabular-nums">{KES(p.total_cost)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
