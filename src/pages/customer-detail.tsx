/**
 * Customer detail page — /customers/:id
 *
 * Editorial layout:
 *   Breadcrumbs → BackButton → EntityHero (with stats) → LazyTabs.
 *
 * Tabs:
 *   - Overview   contact info, credit, addresses, notes
 *   - Sales      every receipt this customer purchased
 *   - Payments   every payment they made
 *   - Activity   merged feed via useEntityHistory
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import { getCustomer, getCustomerStats, type Customer } from "@/services/erp"
import { useEntityHistory } from "@/hooks/use-entity-history"
import { Pencil, ShoppingCart, Receipt as ReceiptIcon } from "@phosphor-icons/react"
import { format } from "date-fns"

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n)

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [stats, setStats] = useState<{
    total_purchases: number
    total_amount: number
    last_purchase: string | null
    outstanding_balance: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (!id) return
    setLoading(true)
    Promise.all([getCustomer(id), getCustomerStats(id)])
      .then(([c, s]) => {
        if (!mounted) return
        setCustomer(c)
        setStats(s)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading customer…</div>
  if (!customer) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/customers" />
        <p className="text-sm text-muted-foreground">Customer not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <BackButton fallback="/customers" label="Back to customers" />
      <div className="flex flex-col gap-5 max-w-[1280px] w-full mx-auto mt-3">
      <Breadcrumbs
        items={[
          { label: "Customers", to: "/customers" },
          { label: customer.name },
        ]}
      />
      <EntityHero
        eyebrow="Customer"
        title={customer.name}
        subtitle={[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}
        badges={
          customer.credit_limit && customer.credit_limit > 0
            ? [{ label: `Credit ${KES(customer.credit_limit)}`, variant: "outline" }]
            : undefined
        }
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("/pos/sale", { state: { customerId: customer.id } })}>
              <ShoppingCart className="h-3.5 w-3.5" />
              New sale
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(`/customers`)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </>
        }
        stats={[
          { label: "Sales", value: stats?.total_purchases ?? 0 },
          { label: "Lifetime spend", value: KES(stats?.total_amount ?? 0) },
          {
            label: "Outstanding",
            value: KES(stats?.outstanding_balance ?? 0),
            tone: (stats?.outstanding_balance ?? 0) > 0 ? "warning" : "muted",
          },
          {
            label: "Last visit",
            value: stats?.last_purchase ? format(new Date(stats.last_purchase), "d MMM yyyy") : "—",
          },
        ]}
      />
      <LazyTabs
        defaultTab="overview"
        tabs={[
          { id: "overview", label: "Overview", render: () => <OverviewTab customer={customer} /> },
          { id: "sales", label: "Sales", count: stats?.total_purchases, render: () => <SalesTab id={customer.id} /> },
          { id: "payments", label: "Payments", render: () => <PaymentsTab id={customer.id} /> },
          { id: "activity", label: "Activity", render: () => <ActivityTab id={customer.id} /> },
        ]}
      />
      </div>
    </div>
  )
}

function OverviewTab({ customer }: { customer: Customer }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Phone" value={customer.phone} />
      <Field label="Email" value={customer.email} />
      <Field label="Credit limit" value={customer.credit_limit ? KES(customer.credit_limit) : null} />
      <Field label="Balance" value={KES(customer.balance ?? 0)} />
      <Field label="Notes" value={customer.notes} className="md:col-span-2" />
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

function SalesTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "customer", id, limit: 50 })
  const sales = events.filter((e) => e.type === "sale")
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (sales.length === 0) return <p className="text-sm text-muted-foreground">No sales yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {sales.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/[0.02] cursor-pointer" onClick={() => s.route && (window.location.href = s.route)}>
          <div className="flex items-center gap-3">
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[13px] font-medium">{s.label}</span>
              <span className="text-[11px] text-muted-foreground">{format(new Date(s.at), "d MMM yyyy · HH:mm")}</span>
            </div>
          </div>
          <span className="font-mono text-[13px] tabular-nums">{KES(s.amount ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}

function PaymentsTab({ id }: { id: string }) {
  const { events, loading } = useEntityHistory({ kind: "customer", id, limit: 50 })
  const payments = events.filter((e) => e.type === "payment")
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (payments.length === 0) return <p className="text-sm text-muted-foreground">No payments yet.</p>
  return (
    <ul className="flex flex-col divide-y divide-foreground/5 rounded-md border border-foreground/10">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium">{p.label}</span>
            <span className="text-[11px] text-muted-foreground">{format(new Date(p.at), "d MMM yyyy · HH:mm")}</span>
          </div>
          <span className="font-mono text-[13px] tabular-nums text-emerald-600">{KES(p.amount ?? 0)}</span>
        </li>
      ))}
    </ul>
  )
}

function ActivityTab({ id }: { id: string }) {
  const { events, loading, error } = useEntityHistory({ kind: "customer", id, limit: 100 })
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[80px_1fr_auto] items-baseline gap-4 border-b border-foreground/5 pb-2.5">
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
