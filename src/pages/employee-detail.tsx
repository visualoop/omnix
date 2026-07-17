/**
 * Employee detail page — /hr/employees/:id
 *
 * Tabs: Profile · Compensation · Attendance · Documents
 */
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { BackButton } from "@/components/ui/back-button"
import { EntityHero } from "@/components/ui/entity-hero"
import { LazyTabs } from "@/components/ui/lazy-tabs"
import { Button } from "@/components/ui/button"
import { getEmployee, type Employee } from "@/services/employees"
import { Pencil } from "@phosphor-icons/react"
import { format, differenceInYears } from "date-fns"
import { query } from "@/lib/db"
import { MODULES_ALLOWED } from "@/lib/variant"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth"
import { confirm } from "@/components/ui/confirm-dialog"
import {
  getSalonStaffByEmployee, staffEarningsByDay, staffCommissionLines, payStaffCommissions,
  type SalonStaff, type StaffEarningDay, type StaffCommissionLine,
} from "@/services/salon"
const SALON_ENABLED = MODULES_ALLOWED.includes("salon")

const KES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n)

interface AttendanceSummary {
  days_present: number
  days_absent: number
  total_hours: number
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    Promise.all([
      getEmployee(id),
      query<AttendanceSummary>(
        `SELECT
           SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as days_present,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as days_absent,
           COALESCE(SUM(
             CASE
               WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL
               THEN (julianday(clock_out) - julianday(clock_in)) * 24
                    - (COALESCE(break_minutes, 0) / 60.0)
               ELSE 0
             END
           ), 0) as total_hours
         FROM attendance
         WHERE employee_id = ?1
           AND work_date >= date('now', '-30 days')`,
        [id],
      ),
    ])
      .then(([e, att]) => {
        if (!mounted) return
        setEmployee(e)
        setAttendance(att[0] ?? { days_present: 0, days_absent: 0, total_hours: 0 })
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading employee…</div>
  if (!employee) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <BackButton fallback="/hr/employees" />
        <p className="text-sm text-muted-foreground">Employee not found.</p>
      </div>
    )
  }

  const tenure = differenceInYears(new Date(), new Date(employee.hire_date))

  return (
    <div className="p-6">
      <BackButton fallback="/hr/employees" label="Back to team" />
      <div className="flex flex-col gap-5 max-w-[1280px] w-full mx-auto mt-3">
      <Breadcrumbs items={[{ label: "Team", to: "/hr/employees" }, { label: employee.full_name }]} />
      <EntityHero
        eyebrow="Employee"
        title={employee.full_name}
        subtitle={[employee.employee_number, employee.job_title, employee.phone].filter(Boolean).join(" · ")}
        badges={[
          { label: employee.active ? "Active" : "Terminated", variant: employee.active ? "default" : "destructive" },
          { label: employee.employment_type, variant: "outline" },
          ...(employee.is_pharmacist ? [{ label: "Pharmacist", variant: "outline" as const }] : []),
        ]}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("/hr/employees")}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        }
        stats={[
          { label: "Hired", value: format(new Date(employee.hire_date), "d MMM yyyy") },
          { label: "Tenure", value: tenure > 0 ? `${tenure}y` : "<1y" },
          { label: "Pay", value: KES(employee.base_salary || employee.daily_rate || employee.hourly_rate || 0) },
          { label: "Pay type", value: employee.pay_type },
          { label: "Days (30d)", value: `${attendance?.days_present ?? 0}` },
          { label: "Hours (30d)", value: (attendance?.total_hours ?? 0).toFixed(0) },
        ]}
      />
      <LazyTabs
        tabs={[
          { id: "profile", label: "Profile", render: () => <ProfileTab employee={employee} /> },
          { id: "compensation", label: "Compensation", render: () => <CompTab employee={employee} /> },
          ...(SALON_ENABLED ? [{ id: "earnings", label: "Earnings", render: () => <EarningsTab employeeId={employee.id} /> }] : []),
          { id: "kin", label: "Next of kin", render: () => <KinTab employee={employee} /> },
          { id: "documents", label: "Documents", render: () => <DocumentsTab employee={employee} /> },
        ]}
      />
      </div>
    </div>
  )
}

function EarningsTab({ employeeId }: { employeeId: string }) {
  const [staff, setStaff] = useState<SalonStaff | null>(null)
  const [days, setDays] = useState<StaffEarningDay[]>([])
  const [lines, setLines] = useState<StaffCommissionLine[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const userId = useAuthStore((s) => s.user?.id)

  const load = () => {
    setLoading(true)
    getSalonStaffByEmployee(employeeId).then((st) => {
      setStaff(st)
      if (!st) { setLoading(false); return }
      const to = new Date(); to.setHours(23, 59, 59, 999)
      const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0)
      Promise.all([
        staffEarningsByDay(st.id, from.toISOString(), to.toISOString()),
        staffCommissionLines(st.id, from.toISOString(), to.toISOString()),
      ]).then(([d, l]) => { setDays(d); setLines(l) }).finally(() => setLoading(false))
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() /* eslint-disable-line */ }, [employeeId])

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
  if (!staff) return <div className="py-8 text-center text-sm text-muted-foreground">This employee isn't enrolled as salon staff, so there are no salon earnings.</div>

  const earned = days.reduce((s, d) => s + d.earned, 0)
  const paid = days.reduce((s, d) => s + d.paid, 0)
  const outstanding = Math.max(0, earned - paid)

  const payOut = async () => {
    if (!userId || outstanding <= 0) return
    if (!(await confirm({ title: `Pay ${staff.display_name}?`, description: `Marks their outstanding salon commissions (${KES(outstanding)}) as paid and records the payout.` }))) return
    setPaying(true)
    try {
      const to = new Date(); to.setHours(23, 59, 59, 999)
      const res = await payStaffCommissions({ staff_id: staff.id, uptoIso: to.toISOString(), userId, periodDate: new Date().toISOString().slice(0, 10) })
      toast.success(`Paid ${KES(res.amount)} (${res.count} commission${res.count === 1 ? "" : "s"})`)
      load()
    } catch (e) { toast.error(String(e)) } finally { setPaying(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Salon earnings · last 30 days</div>
        {outstanding > 0 && <Button size="sm" disabled={paying} onClick={payOut}>{paying ? "…" : `Pay ${KES(outstanding)}`}</Button>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Earned</div><div className="text-[18px] font-semibold tabular-nums mt-0.5">{KES(earned)}</div></div>
        <div className="rounded-lg border border-border p-3"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Paid</div><div className="text-[18px] font-semibold tabular-nums mt-0.5 text-muted-foreground">{KES(paid)}</div></div>
        <div className="rounded-lg border border-border p-3"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Outstanding</div><div className="text-[18px] font-semibold tabular-nums mt-0.5 text-amber-600 dark:text-amber-400">{KES(outstanding)}</div></div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Daily earnings</div>
        {days.length === 0 ? <p className="text-[13px] text-muted-foreground">No earnings in the last 30 days.</p> : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="text-left px-3 py-2">Day</th><th className="text-right px-3 py-2">Jobs</th><th className="text-right px-3 py-2">Earned</th><th className="text-right px-3 py-2">Paid</th></tr></thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(d.day).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.jobs}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(d.earned)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{d.paid >= d.earned - 0.01 ? "Paid" : KES(d.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Commission lines</div>
        {lines.length === 0 ? <p className="text-[13px] text-muted-foreground">No commission lines.</p> : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Service</th><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">%</th><th className="text-right px-3 py-2">Earned</th><th className="text-right px-3 py-2">Status</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2 text-[12px]">{new Date(l.created_at).toLocaleDateString([], { day: "numeric", month: "short" })}</td>
                    <td className="px-3 py-2">{l.service_name ?? (l.kind === "retail" ? "Retail" : "—")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.client_name ?? "Walk-in"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.pct}%</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-medium">{KES(l.amount)}</td>
                    <td className="px-3 py-2 text-right">{l.paid_at ? <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Paid</span> : <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">Owed</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileTab({ employee: e }: { employee: Employee }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Phone" value={e.phone} />
      <Field label="Email" value={e.email} />
      <Field label="National ID" value={e.id_number} />
      <Field label="KRA PIN" value={e.kra_pin} />
      <Field label="NSSF" value={e.nssf_number} />
      <Field label="SHIF" value={e.shif_number} />
      <Field label="Date of birth" value={e.date_of_birth ? format(new Date(e.date_of_birth), "d MMM yyyy") : null} />
      <Field label="Gender" value={e.gender} />
      <Field label="Address" value={e.address} className="md:col-span-2" />
    </div>
  )
}

function CompTab({ employee: e }: { employee: Employee }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Pay type" value={e.pay_type} />
      <Field label="Base salary" value={KES(e.base_salary)} />
      <Field label="Daily rate" value={e.daily_rate ? KES(e.daily_rate) : null} />
      <Field label="Hourly rate" value={e.hourly_rate ? KES(e.hourly_rate) : null} />
      <Field label="Commission" value={e.commission_rate != null ? `${e.commission_rate}%` : null} />
      <Field label="Bank" value={e.bank_name} />
      <Field label="Bank account" value={e.bank_account} />
      <Field label="M-Pesa / Paybill" value={e.paybill_or_phone} />
    </div>
  )
}

function KinTab({ employee: e }: { employee: Employee }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Name" value={e.next_of_kin_name} />
      <Field label="Phone" value={e.next_of_kin_phone} />
      <Field label="Relationship" value={e.next_of_kin_relationship} />
    </div>
  )
}

function DocumentsTab({ employee: e }: { employee: Employee }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {e.is_pharmacist ? (
        <>
          <Field label="Pharmacist license #" value={e.pharmacist_license_number} />
          <Field label="License expires" value={e.pharmacist_license_expiry ? format(new Date(e.pharmacist_license_expiry), "d MMM yyyy") : null} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground md:col-span-2">No documents on file. Upload from the Files tab once available.</p>
      )}
      <Field label="Notes" value={e.notes} className="md:col-span-2" />
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
