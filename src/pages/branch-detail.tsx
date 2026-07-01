/**
 * Branch detail page — /settings/branches/:id
 *
 * Tabs: Overview · Hours · Compliance · Activity
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import { getBranch, type Branch } from "@/services/branches"
import { Pencil } from "@phosphor-icons/react"
import { query } from "@/lib/db"

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n)

interface BranchStats {
  user_count: number
  sales_today: number
  sales_today_count: number
  sales_30d: number
}

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [stats, setStats] = useState<BranchStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      getBranch(id),
      query<BranchStats>(
        `SELECT
           (SELECT COUNT(*) FROM user_branches ub
              INNER JOIN users u ON u.id = ub.user_id
              WHERE ub.branch_id = ?1 AND u.active = 1) as user_count,
           COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed'), 0)
             - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) = date('now')), 0) as sales_today,
           (SELECT COUNT(*) FROM sales WHERE branch_id = ?1 AND date(created_at) = date('now') AND status = 'completed') as sales_today_count,
           COALESCE((SELECT SUM(total) FROM sales WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days') AND status = 'completed'), 0)
             - COALESCE((SELECT SUM(refund_amount) FROM sale_returns WHERE branch_id = ?1 AND date(created_at) >= date('now', '-30 days')), 0) as sales_30d`,
        [id],
      ),
    ])
      .then(([b, s]) => {
        if (!mounted) return
        setBranch(b)
        setStats(s[0] ?? { user_count: 0, sales_today: 0, sales_today_count: 0, sales_30d: 0 })
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading branch…</div>
  if (!branch) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/settings/branches" />
        <p className="text-sm text-muted-foreground">Branch not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[1280px] mx-auto">
      <Breadcrumbs
        items={[
          { label: "Settings", to: "/settings" },
          { label: "Branches", to: "/settings/branches" },
          { label: branch.name },
        ]}
      />
      <BackButton fallback="/settings/branches" label="Back to branches" />
      <EntityHero
        eyebrow="Branch"
        title={branch.name}
        subtitle={[branch.code, branch.address].filter(Boolean).join(" · ")}
        badges={[
          { label: branch.active ? "Active" : "Closed", variant: branch.active ? "default" : "destructive" },
          ...(branch.is_default ? [{ label: "Default", variant: "outline" as const }] : []),
        ]}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/settings/branches")}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
        stats={[
          { label: "Sales today", value: KES(stats?.sales_today ?? 0) },
          { label: "Receipts today", value: stats?.sales_today_count ?? 0 },
          { label: "Sales (30d)", value: KES(stats?.sales_30d ?? 0) },
          { label: "Users", value: stats?.user_count ?? 0 },
        ]}
      />
      <LazyTabs
        tabs={[
          { id: "overview", label: "Overview", render: () => <OverviewTab branch={branch} /> },
          { id: "hours", label: "Hours", render: () => <HoursTab branch={branch} /> },
          { id: "compliance", label: "Compliance", render: () => <ComplianceTab branch={branch} /> },
        ]}
      />
    </div>
  )
}

function OverviewTab({ branch: b }: { branch: Branch }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Code" value={b.code} />
      <Field label="Phone" value={b.phone} />
      <Field label="Email" value={b.email} />
      <Field label="Timezone" value={b.timezone} />
      <Field label="Address" value={b.address} className="md:col-span-2" />
      <Field label="Notes" value={b.notes} className="md:col-span-2" />
    </div>
  )
}

function HoursTab({ branch: b }: { branch: Branch }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Open" value={b.open_time} />
      <Field label="Close" value={b.close_time} />
    </div>
  )
}

function ComplianceTab({ branch: b }: { branch: Branch }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="KRA PIN" value={b.kra_pin} />
      <Field label="eTIMS device" value={b.etims_device_id} />
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
