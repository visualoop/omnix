import { useEffect, useState } from "react";
import { confirm, prompt } from "@/components/ui/confirm-dialog";
import {
  Airplane as Plane,
  Check,
  CircleNotch as Loader2,
  Plus,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Can } from "@/components/require-role";
import {
  listLeaveRequests, listLeaveTypes, createLeaveRequest,
  approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest, getLeaveBalance,
  type LeaveRequestWithDetails, type LeaveType, type LeaveStatus,
} from "@/services/leave";
import { listEmployees, type EmployeeWithDetails } from "@/services/employees";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

export function LeavePage() {
  const [tab, setTab] = useState<LeaveStatus>("pending");
  const [requests, setRequests] = useState<LeaveRequestWithDetails[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, t, e] = await Promise.all([
        listLeaveRequests({ status: tab }),
        listLeaveTypes(),
        listEmployees({ active: true }),
      ]);
      setRequests(reqs);
      setTypes(t);
      setEmployees(e);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const approve = async (id: string) => {
    if (!userId) return;
    await approveLeaveRequest(id, userId);
    toast.success("Approved");
    load();
  };
  const reject = async (id: string) => {
    if (!userId) return;
    const reason = (await prompt({ title: "Rejection reason?" })) || "";
    if (!reason) return;
    await rejectLeaveRequest(id, userId, reason);
    toast.success("Rejected");
    load();
  };
  const cancel = async (id: string) => {
    if (!(await confirm({ title: "Cancel this request?" }))) return;
    await cancelLeaveRequest(id);
    toast.success("Cancelled");
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HR"
        title="Leave"
        description="Leave requests, approvals, annual balances per employee."
        actions={
          <Can permission="hr.leave.request">
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New request
            </Button>
          </Can>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as LeaveStatus)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsPanel value={tab} className="mt-3">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Dates</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Days</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={6} rows={3} />
                ) : requests.length === 0 ? (
                  <tr><td colSpan={6} className="p-0">
                    <EmptyState
                      icon={Plane}
                      title={`No ${tab} requests`}
                      description={tab === "pending" ? "All caught up. New leave requests will appear here." : ""}
                    />
                  </td></tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="px-3 py-2">
                        <div className="text-xs font-medium">{r.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.employee_number}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{r.leave_type_name}</div>
                        <Badge variant="outline" className="mt-0.5 text-[9px]">
                          {r.leave_type_paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-mono">{r.days}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={r.reason || undefined}>
                        {r.reason || "—"}
                        {r.rejection_reason && (
                          <div className="text-[10px] text-red-600 mt-0.5">Rejected: {r.rejection_reason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Can permission="hr.leave.approve">
                              <Button variant="ghost" size="icon-xs" onClick={() => approve(r.id)} title="Approve" className="text-emerald-600 hover:bg-emerald-100">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon-xs" onClick={() => reject(r.id)} title="Reject" className="text-red-600 hover:bg-red-100">
                                <X className="h-3 w-3" />
                              </Button>
                            </Can>
                            <Can permission="hr.leave.request">
                              <Button variant="ghost" size="icon-xs" onClick={() => cancel(r.id)} title="Cancel">
                                ×
                              </Button>
                            </Can>
                          </div>
                        )}
                        {r.status === "approved" && r.approver_username && (
                          <span className="text-[10px] text-muted-foreground">by {r.approver_username}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsPanel>
      </Tabs>

      <NewLeaveRequest
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); load(); }}
        types={types}
        employees={employees}
      />
    </div>
  );
}

function NewLeaveRequest({ open, onClose, onSaved, types, employees }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  types: LeaveType[];
  employees: EmployeeWithDetails[];
}) {
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const [balance, setBalance] = useState<{ allowed: number; used: number; remaining: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        employee_id: "",
        leave_type_id: "",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        reason: "",
      });
      setBalance(null);
    }
  }, [open]);

  useEffect(() => {
    if (form.employee_id && form.leave_type_id) {
      getLeaveBalance(form.employee_id, form.leave_type_id).then(setBalance);
    } else {
      setBalance(null);
    }
  }, [form.employee_id, form.leave_type_id]);

  const days = Math.max(1, Math.ceil(
    (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000,
  ) + 1);

  const save = async () => {
    if (!form.employee_id || !form.leave_type_id) {
      toast.error("Employee and type required");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest(form);
      toast.success("Leave requested");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>New Leave Request</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <Field label="Employee">
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
            >
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} — {e.employee_number}</option>
              ))}
            </select>
          </Field>
          <Field label="Leave Type">
            <select
              value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
            >
              <option value="">Select type...</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.days_per_year}d/yr)</option>
              ))}
            </select>
          </Field>

          {balance && (
            <Card>
              <CardContent className="p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Allowed this year</span><span className="font-mono">{balance.allowed} days</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Used</span><span className="font-mono">{balance.used} days</span></div>
                <div className="flex justify-between font-semibold"><span>Remaining</span><span className="font-mono">{balance.remaining} days</span></div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Date">
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </Field>
            <Field label="End Date">
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
          </div>

          <div className="text-xs text-muted-foreground">
            Total: <b>{days}</b> day{days !== 1 ? "s" : ""}
            {balance && days > balance.remaining && (
              <span className="text-red-600 ml-2">⚠️ Exceeds balance by {days - balance.remaining}</span>
            )}
          </div>

          <Field label="Reason">
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
              placeholder="Optional"
            />
          </Field>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Submit
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" });
}
