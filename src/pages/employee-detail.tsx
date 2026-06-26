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
    <div className="flex flex-col gap-5 p-6 max-w-[1280px] mx-auto">
      <Breadcrumbs items={[{ label: "Team", to: "/hr/employees" }, { label: employee.full_name }]} />
      <BackButton fallback="/hr/employees" label="Back to team" />
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
          { id: "kin", label: "Next of kin", render: () => <KinTab employee={employee} /> },
          { id: "documents", label: "Documents", render: () => <DocumentsTab employee={employee} /> },
        ]}
      />
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
