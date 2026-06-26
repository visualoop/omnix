/**
 * Sale detail page — /sales/:id
 *
 * Editorial layout: receipt-style layout. EntityHero with totals,
 * line-items table, payment summary, and quick actions (reprint,
 * return, void).
 *
 * Tabs: Items · Payments · Audit
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import { query } from "@/lib/db"
import type { Sale } from "@/services/sales"
import { buildReceiptData, printReceipt } from "@/services/receipt"
import { toast } from "sonner"
import { useEntityHistory } from "@/hooks/use-entity-history"
import { Printer, ArrowUUpLeft } from "@phosphor-icons/react"
import { format } from "date-fns"

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n)

interface SaleItemRow {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  discount: number
  total: number
}

interface PaymentRow {
  id: string
  method_name: string
  amount: number
  reference: string | null
  created_at: string
}

interface SaleWithDetails extends Sale {
  customer_name?: string | null
}

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<SaleWithDetails | null>(null)
  const [items, setItems] = useState<SaleItemRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      query<SaleWithDetails>(
        `SELECT s.*, c.name as customer_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.id = ?1`,
        [id],
      ),
      query<SaleItemRow>(
        `SELECT id, product_name, quantity, unit_price, discount, total
         FROM sale_items WHERE sale_id = ?1 ORDER BY rowid`,
        [id],
      ),
      query<PaymentRow>(
        `SELECT id, method_name, amount, reference, created_at
         FROM payments WHERE sale_id = ?1 ORDER BY created_at`,
        [id],
      ),
    ])
      .then(([s, i, p]) => {
        if (!mounted) return
        setSale(s[0] ?? null)
        setItems(i)
        setPayments(p)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading sale…</div>
  if (!sale) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/sales/history" />
        <p className="text-sm text-muted-foreground">Sale not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[1100px] mx-auto">
      <Breadcrumbs
        items={[
          { label: "Sales", to: "/sales/history" },
          { label: `Receipt #${sale.sale_number}` },
        ]}
      />
      <BackButton fallback="/sales/history" label="Back to sales" />
      <EntityHero
        eyebrow={`Sale · ${sale.payment_status}`}
        title={`Receipt #${sale.sale_number}`}
        subtitle={
          <>
            {format(new Date(sale.created_at), "EEEE, d MMM yyyy · HH:mm")}
            {sale.customer_name ? <> · for {sale.customer_name}</> : null}
          </>
        }
        badges={[
          { label: sale.status, variant: sale.status === "completed" ? "default" : "secondary" },
        ]}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const data = await buildReceiptData(sale.id)
                  if (!data) {
                    toast.error("Couldn't build receipt — sale data missing")
                    return
                  }
                  await printReceipt(data)
                } catch (e) {
                  toast.error(String(e))
                }
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              Reprint
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/returns?sale=${sale.id}`)}>
              <ArrowUUpLeft className="h-3.5 w-3.5" />
              Return
            </Button>
          </>
        }
        stats={[
          { label: "Items", value: items.length },
          { label: "Subtotal", value: KES(sale.subtotal) },
          { label: "Tax", value: KES(sale.tax_amount) },
          { label: "Discount", value: KES(sale.discount_amount), tone: sale.discount_amount > 0 ? "positive" : "muted" },
          { label: "Total", value: KES(sale.total) },
        ]}
      />
      <LazyTabs
        tabs={[
          { id: "items", label: "Items", count: items.length, render: () => <ItemsTab items={items} /> },
          { id: "payments", label: "Payments", count: payments.length, render: () => <PaymentsTab payments={payments} /> },
          { id: "audit", label: "Audit", render: () => <AuditTab id={sale.id} /> },
        ]}
      />
    </div>
  )
}

function ItemsTab({ items }: { items: SaleItemRow[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No line items.</p>
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <th className="text-left py-2 font-normal">Item</th>
          <th className="text-right py-2 font-normal">Qty</th>
          <th className="text-right py-2 font-normal">Price</th>
          <th className="text-right py-2 font-normal">Disc</th>
          <th className="text-right py-2 font-normal">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id} className="border-b border-foreground/5">
            <td className="py-2.5">{it.product_name}</td>
            <td className="text-right tabular-nums">{it.quantity}</td>
            <td className="text-right font-mono tabular-nums">{KES(it.unit_price)}</td>
            <td className="text-right font-mono tabular-nums text-muted-foreground">{it.discount > 0 ? KES(it.discount) : "—"}</td>
            <td className="text-right font-mono tabular-nums">{KES(it.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PaymentsTab({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="text-sm text-muted-foreground">No payments yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{p.method_name}</span>
            <span className="text-[11px] text-muted-foreground">
              {p.reference ?? "—"} · {format(new Date(p.created_at), "d MMM yyyy HH:mm")}
            </span>
          </div>
          <span className="font-mono text-[13px] tabular-nums">{KES(p.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function AuditTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "sale", id, limit: 50 })
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No audit entries.</p>
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[80px_1fr] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {format(new Date(e.at), "d MMM HH:mm")}
          </time>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{e.label}</span>
            {e.summary && <span className="text-[12px] text-muted-foreground">{e.summary}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}
