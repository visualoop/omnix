import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { Wallet, Plus, Loader2, Check, FileText, Trash2, Printer, Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Can } from "@/components/require-role";
import {
  listPayrollRuns, createPayrollRun, getPayrollRun, approvePayrollRun, markPayrollRunPaid, deletePayrollRun,
  type PayrollRun, type Payslip,
} from "@/services/payroll";
import { listBranches, type BranchWithStats } from "@/services/branches";
import { downloadPayslipPdf, downloadPayrollRunPdf } from "@/services/payslip-pdf";
import {
  exportPayeP10Csv, exportNssfReturnCsv, exportShifReturnCsv, exportHousingLevyReturnCsv, exportBankFileCsv, downloadCsv,
} from "@/services/payroll-exports";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRuns(await listPayrollRuns()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate monthly payroll. Computes PAYE, NSSF (Year 4), SHIF, Housing Levy per Kenya 2026 rates.
          </p>
        </div>
        <Can permission="hr.payroll.run">
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Payroll Run
          </Button>
        </Can>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Employees</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Gross</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Deductions</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Net</th>
              <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={3} />
            ) : runs.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Wallet}
                  title="No payroll runs yet"
                  description="Generate your first payroll run for this month."
                  cta={{ label: "Run Payroll", onClick: () => setCreating(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              runs.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                  onClick={() => setViewing(r.id)}
                >
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium">{MONTHS[r.period_month - 1]} {r.period_year}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Run {new Date(r.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{r.employee_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-mono">{KES(r.gross_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-mono text-red-600">-{KES(r.deductions_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-mono font-semibold">{KES(r.net_total)}</td>
                  <td className="px-3 py-2 text-center">
                    <RunStatusBadge status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewPayrollRunDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); load(); }}
      />
      <PayrollRunSheet
        runId={viewing}
        onClose={() => setViewing(null)}
        onChange={load}
      />
    </div>
  );
}

function RunStatusBadge({ status }: { status: PayrollRun["status"] }) {
  switch (status) {
    case "draft": return <Badge variant="outline">Draft</Badge>;
    case "approved": return <Badge className="bg-blue-600 hover:bg-blue-600">Approved</Badge>;
    case "paid": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>;
    case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
  }
}

function NewPayrollRunDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [branchId, setBranchId] = useState<string>("");
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      listBranches(false).then(setBranches);
    }
  }, [open]);

  const create = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      await createPayrollRun({
        year, month,
        branch_id: branchId || undefined,
        user_id: userId,
      });
      toast.success("Payroll run generated");
      onCreated();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Payroll Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Branch (optional)</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
            >
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 leading-relaxed">
            <p>Generates draft payslips for all <b>active employees with a salary &gt; 0</b>.</p>
            <p className="mt-1">Computed deductions: <b>PAYE</b>, <b>NSSF Year 4</b>, <b>SHIF (2.75%)</b>, <b>Housing Levy (1.5%)</b>.</p>
            <p className="mt-1 text-[11px]">You can review and approve before paying.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollRunSheet({ runId, onClose, onChange }: {
  runId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<{
    run: PayrollRun;
    payslips: Array<Payslip & { employee_name: string; employee_number: string }>;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [viewingPayslip, setViewingPayslip] = useState<(Payslip & { employee_name: string; employee_number: string }) | null>(null);

  useEffect(() => {
    if (runId) {
      getPayrollRun(runId).then(setData);
    } else {
      setData(null);
    }
  }, [runId]);

  if (!runId || !data) return null;

  const approve = async () => {
    if (!userId) return;
    setWorking(true);
    try {
      await approvePayrollRun(runId, userId);
      toast.success("Approved");
      onChange();
      const fresh = await getPayrollRun(runId); setData(fresh);
    } finally { setWorking(false); }
  };
  const markPaid = async () => {
    setWorking(true);
    try {
      await markPayrollRunPaid(runId);
      toast.success("Marked as paid");
      onChange();
      const fresh = await getPayrollRun(runId); setData(fresh);
    } finally { setWorking(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete payroll run for ${MONTHS[data.run.period_month - 1]} ${data.run.period_year}? This cannot be undone.` }))) return;
    setWorking(true);
    try {
      await deletePayrollRun(runId);
      toast.success("Deleted");
      onChange();
      onClose();
    } finally { setWorking(false); }
  };

  return (
    <Sheet open={!!runId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[700px] sm:max-w-[700px]">
        <SheetHeader>
          <SheetTitle>
            {MONTHS[data.run.period_month - 1]} {data.run.period_year} Payroll
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Employees" value={String(data.run.employee_count)} />
            <Stat label="Gross" value={KES(data.run.gross_total)} />
            <Stat label="Net" value={KES(data.run.net_total)} highlight />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <RunStatusBadge status={data.run.status} />
            <div className="ml-auto flex gap-1 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Statutory Returns
                  <ChevronDown className="h-3 w-3 ml-1" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={async () => {
                    const csv = await exportPayeP10Csv(runId);
                    downloadCsv(`PAYE-P10-${data.run.period_year}-${String(data.run.period_month).padStart(2, "0")}.csv`, csv);
                  }}>KRA PAYE (P10) CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const csv = await exportNssfReturnCsv(runId);
                    downloadCsv(`NSSF-${data.run.period_year}-${String(data.run.period_month).padStart(2, "0")}.csv`, csv);
                  }}>NSSF Return CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const csv = await exportShifReturnCsv(runId);
                    downloadCsv(`SHIF-${data.run.period_year}-${String(data.run.period_month).padStart(2, "0")}.csv`, csv);
                  }}>SHIF Return CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const csv = await exportHousingLevyReturnCsv(runId);
                    downloadCsv(`Housing-Levy-${data.run.period_year}-${String(data.run.period_month).padStart(2, "0")}.csv`, csv);
                  }}>Housing Levy CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const csv = await exportBankFileCsv(runId);
                    downloadCsv(`Bank-Payroll-${data.run.period_year}-${String(data.run.period_month).padStart(2, "0")}.csv`, csv);
                  }}>Bank Payroll File CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" onClick={() => downloadPayrollRunPdf(data.payslips, data.run)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> All Payslips PDF
              </Button>
              {data.run.status === "draft" && (
                <Can permission="hr.payroll.approve">
                  <Button size="sm" onClick={approve} disabled={working}>
                    {working && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    <Check className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                </Can>
              )}
              {data.run.status === "approved" && (
                <Button size="sm" onClick={markPaid} disabled={working}>
                  {working && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Mark Paid
                </Button>
              )}
              {data.run.status === "draft" && (
                <Button variant="ghost" size="sm" onClick={remove} disabled={working}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Employee</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gross</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PAYE</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">NSSF</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SHIF</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Housing</th>
                  <th className="text-right px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Net</th>
                  <th className="text-right px-2 py-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.payslips.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-accent/30">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{p.employee_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{p.employee_number}</div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono">{p.gross_pay.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-red-700">{p.paye.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-red-700">{p.nssf_employee.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-red-700">{p.shif.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono text-red-700">{p.housing_levy_employee.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-mono font-semibold">{p.net_pay.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <Button variant="ghost" size="icon-xs" onClick={() => setViewingPayslip(p as any)} title="View payslip">
                        <FileText className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-2 py-1.5">Total</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">{data.run.gross_total.toFixed(0)}</td>
                  <td colSpan={4}></td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">{data.run.net_total.toFixed(0)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-muted-foreground">
            <p>Per Kenyan tax law: PAYE bands 10%/25%/30%/32.5%/35% with KES 2,400 personal relief. NSSF 6% capped at 6,480. SHIF 2.75% min KES 300. Housing Levy 1.5%.</p>
            <p className="mt-1">Employer also pays: NSSF match (max 6,480), Housing 1.5%, NITA KES 50/employee.</p>
          </div>
        </div>

        <PayslipDialog payslip={viewingPayslip} onClose={() => setViewingPayslip(null)} run={data.run} />
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold font-mono mt-1 ${highlight ? "text-emerald-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PayslipDialog({ payslip, onClose, run }: {
  payslip: any;
  onClose: () => void;
  run: PayrollRun;
}) {
  if (!payslip) return null;
  return (
    <Dialog open={!!payslip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payslip — {MONTHS[run.period_month - 1]} {run.period_year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs print:text-[10pt]" id="payslip-print">
          <div className="border-b border-border pb-2">
            <div className="font-semibold">{payslip.employee_name}</div>
            <div className="text-muted-foreground font-mono">{payslip.employee_number}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Earnings</div>
            <Row label="Base salary" value={payslip.base_salary} />
            {payslip.overtime > 0 && <Row label="Overtime" value={payslip.overtime} />}
            {payslip.commission > 0 && <Row label="Commission" value={payslip.commission} />}
            {payslip.bonus > 0 && <Row label="Bonus" value={payslip.bonus} />}
            {payslip.allowances > 0 && <Row label="Allowances" value={payslip.allowances} />}
            <Row label="Gross Pay" value={payslip.gross_pay} bold />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Statutory Deductions</div>
            <Row label="PAYE" value={-payslip.paye} />
            <Row label="NSSF" value={-payslip.nssf_employee} />
            <Row label="SHIF" value={-payslip.shif} />
            <Row label="Housing Levy" value={-payslip.housing_levy_employee} />
          </div>

          {(payslip.advances > 0 || payslip.loans > 0 || payslip.other_deductions > 0) && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Other Deductions</div>
              {payslip.advances > 0 && <Row label="Advances" value={-payslip.advances} />}
              {payslip.loans > 0 && <Row label="Loans" value={-payslip.loans} />}
              {payslip.other_deductions > 0 && <Row label="Other" value={-payslip.other_deductions} />}
            </div>
          )}

          <div className="border-t-2 border-foreground pt-2">
            <Row label="NET PAY" value={payslip.net_pay} bold />
          </div>

          <div className="text-[9px] text-muted-foreground border-t border-border pt-2 leading-relaxed">
            <div>Employer-side: NSSF {payslip.nssf_employer.toFixed(0)} · Housing {payslip.housing_levy_employer.toFixed(0)} · NITA {payslip.nita_levy.toFixed(0)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => downloadPayslipPdf(payslip, run)}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
          <Button size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-mono tabular-nums">{Math.abs(value).toFixed(2)}</span>
    </div>
  );
}
