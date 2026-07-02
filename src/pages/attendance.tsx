import { useEffect, useState } from "react";
import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Clock,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listAttendance, setAttendanceStatus, workedMinutes, formatDuration,
  type AttendanceWithEmployee, type AttendanceStatus,
} from "@/services/attendance";
import { listEmployees, type EmployeeWithDetails } from "@/services/employees";
import { useActiveBranch } from "@/stores/active-branch";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "P", color: "bg-emerald-500 text-white" },
  { value: "absent", label: "A", color: "bg-red-500 text-white" },
  { value: "sick", label: "S", color: "bg-amber-500 text-white" },
  { value: "leave", label: "L", color: "bg-blue-500 text-white" },
  { value: "holiday", label: "H", color: "bg-purple-500 text-white" },
  { value: "half-day", label: "½", color: "bg-teal-500 text-white" },
];

export function AttendancePage() {
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [records, setRecords] = useState<AttendanceWithEmployee[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const branchId = useActiveBranch((s) => s.active?.id);

  const load = async () => {
    setLoading(true);
    try {
      const [emps, recs] = await Promise.all([
        listEmployees({ active: true, branchId }),
        listAttendance({ startDate: date, endDate: date, branchId }),
      ]);
      setEmployees(emps);
      setRecords(recs);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [date, branchId]);

  const recordByEmp = new Map(records.map((r) => [r.employee_id, r]));

  const setStatus = async (employee_id: string, status: AttendanceStatus) => {
    try {
      await setAttendanceStatus({ employee_id, work_date: date, status });
      toast.success("Saved");
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const counts = {
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    sick: records.filter((r) => r.status === "sick").length,
    leave: records.filter((r) => r.status === "leave").length,
    unmarked: employees.length - records.length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/people" }}
        eyebrow="HR"
        title="Attendance"
        description="Daily attendance tracking. Click a status badge to mark each employee."
        actions={
          <div className="flex items-center gap-1 border border-foreground/15 rounded-md">
            <Button variant="ghost" size="icon-xs" onClick={() => setDate(addDays(date, -1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 px-2 text-xs bg-transparent outline-none"
            />
            <Button variant="ghost" size="icon-xs" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-5 gap-3">
        <Stat label="Present" value={counts.present} color="text-emerald-600" />
        <Stat label="Absent" value={counts.absent} color="text-red-600" />
        <Stat label="Sick" value={counts.sick} color="text-amber-600" />
        <Stat label="On Leave" value={counts.leave} color="text-blue-600" />
        <Stat label="Unmarked" value={counts.unmarked} color="text-muted-foreground" />
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Job</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Clock In</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Clock Out</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Hours</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={4} />
            ) : employees.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Clock}
                  title="No active employees"
                  description="Add employees first to track attendance."
                />
              </td></tr>
            ) : (
              employees.map((e) => {
                const rec = recordByEmp.get(e.id);
                return (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/15 text-primary font-medium flex items-center justify-center text-[10px] shrink-0">
                          {e.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{e.full_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{e.employee_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.job_title}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-0.5">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setStatus(e.id, s.value)}
                            title={s.value}
                            className={`h-6 w-6 rounded text-[10px] font-bold flex items-center justify-center transition ${
                              rec?.status === s.value
                                ? s.color
                                : "bg-muted hover:bg-muted/70 text-muted-foreground"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono">{rec?.clock_in ? formatTime(rec.clock_in) : "—"}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono">{rec?.clock_out ? formatTime(rec.clock_out) : "—"}</td>
                    <td className="px-3 py-2 text-right text-xs font-mono">
                      {rec ? formatDuration(workedMinutes(rec)) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground flex gap-3 flex-wrap">
        <span><b className="text-emerald-600">P</b> Present</span>
        <span><b className="text-red-600">A</b> Absent</span>
        <span><b className="text-amber-600">S</b> Sick</span>
        <span><b className="text-blue-600">L</b> Leave</span>
        <span><b className="text-purple-600">H</b> Holiday</span>
        <span><b className="text-teal-600">½</b> Half day</span>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold font-mono mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });
}
