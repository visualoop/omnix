/**
 * Wastage report — every write-off in a date range grouped by reason.
 * Backs the "how much stock did we lose to expiry/damage this month?"
 * question owners want to answer without opening every batch.
 */
import { useEffect, useState } from "react"
import {
  Calendar,
  Trash as Trash2,
  Warning as AlertTriangle,
} from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { getWastageReport, getWastageSummary, type WastageRow, type WastageSummary } from "@/services/wastage"
import { money as KES } from "@/lib/money"

export function WastageReportPage() {
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  })
  const [rows, setRows] = useState<WastageRow[]>([])
  const [summary, setSummary] = useState<WastageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getWastageReport({ startDate: period.start, endDate: period.end }),
      getWastageSummary({ startDate: period.start, endDate: period.end }),
    ])
      .then(([r, s]) => {
        setRows(r)
        setSummary(s)
      })
      .finally(() => setLoading(false))
  }, [period.start, period.end])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          Wastage
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Expired / damaged / returned batches. Written off from Pharmacy → Expiry Alerts.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="date"
          value={period.start}
          onChange={(e) => setPeriod({ ...period, start: e.target.value })}
          className="h-8 w-36"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={period.end}
          onChange={(e) => setPeriod({ ...period, end: e.target.value })}
          className="h-8 w-36"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total cost"
          value={summary ? KES(summary.total_cost) : "—"}
          variant="destructive"
        />
        <StatCard
          label="Units written off"
          value={summary ? String(summary.total_units) : "—"}
        />
        <StatCard
          label="Write-off events"
          value={loading ? "—" : String(rows.length)}
        />
      </div>

      {summary && summary.by_reason.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.by_reason.map((r) => (
            <div key={r.reason} className="border border-border rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
              <div className="mt-1 text-lg font-semibold font-mono">{KES(r.cost)}</div>
              <div className="text-[11px] text-muted-foreground">{r.units} units</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">Reason</th>
              <th className="text-left px-3 py-2 font-medium">Product</th>
              <th className="text-left px-3 py-2 font-medium">Batch</th>
              <th className="text-right px-3 py-2 font-medium">Qty</th>
              <th className="text-right px-3 py-2 font-medium">Cost</th>
              <th className="text-left px-3 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center">
                  <AlertTriangle className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No wastage in the selected period.</p>
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.batch_id}-${i}`} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(r.written_off_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="px-2 py-0.5 rounded font-medium text-[11px]"
                      style={{
                        backgroundColor: r.reason === "expired" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                        color: r.reason === "expired" ? "rgb(185,28,28)" : "rgb(146,64,14)",
                      }}
                    >
                      {r.reason.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium">{r.product_name}</td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{r.batch_number || "—"}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{r.quantity}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-mono">{KES(r.cost_value)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.user_name || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant?: "destructive"
}) {
  return (
    <div className={`border rounded-lg p-3 ${variant === "destructive" ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold font-mono ${variant === "destructive" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  )
}
