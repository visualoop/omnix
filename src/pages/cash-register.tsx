import { useState, useEffect } from "react";
import {
  FileText,
  Lock,
  LockOpen as LockOpen,
  Money as Banknote,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getOpenShift, openShift, closeShift, getRecentShifts, type CashShift } from "@/services/accounting";
import { printShiftHandover } from "@/services/shift-handover";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function CashRegisterPage() {
  const user = useAuthStore((s) => s.user);
  const [openShiftData, setOpenShiftData] = useState<CashShift | null>(null);
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!user) return;
    const [open, recent] = await Promise.all([
      getOpenShift(user.id),
      getRecentShifts(20),
    ]);
    setOpenShiftData(open);
    setShifts(recent);
  };

  useEffect(() => { load(); }, [user]);

  const handleOpen = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) { toast.error("Enter valid opening balance"); return; }
    await openShift(user!.id, balance);
    toast.success("Shift opened");
    setOpenDialog(false);
    setOpeningBalance("");
    load();
  };

  const handleClose = async () => {
    if (!openShiftData) return;
    const actual = parseFloat(actualCash);
    if (isNaN(actual) || actual < 0) { toast.error("Enter actual cash count"); return; }
    await closeShift(openShiftData.id, actual, notes || undefined);
    toast.success("Shift closed");
    setCloseDialog(false);
    setActualCash("");
    setNotes("");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Cash register"
        description="Open and close shifts. Reconcile drawer cash at end of day."
      />

      {/* Current shift status */}
      {openShiftData ? (
        <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LockOpen className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold">Shift Open</span>
              <Badge variant="default" className="text-xs">Active</Badge>
            </div>
            <Button size="sm" variant="default" onClick={() => setCloseDialog(true)}>
              <Lock className="h-4 w-4 mr-1" /> Close Shift
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-xs text-muted-foreground">Opened at</p>
              <p className="text-sm font-mono">{openShiftData.opened_at}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Opening balance</p>
              <p className="text-sm font-mono">KES {openShiftData.opening_balance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">No active shift</span>
            </div>
            <Button size="sm" onClick={() => setOpenDialog(true)}>
              <LockOpen className="h-4 w-4 mr-1" /> Open Shift
            </Button>
          </div>
        </div>
      )}

      {/* Recent shifts history */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Recent Shifts</h2>
        {shifts.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No shifts recorded yet</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Opened</th>
                  <th className="text-left px-4 py-2.5 font-medium">Closed</th>
                  <th className="text-right px-4 py-2.5 font-medium">Opening</th>
                  <th className="text-right px-4 py-2.5 font-medium">Expected</th>
                  <th className="text-right px-4 py-2.5 font-medium">Actual</th>
                  <th className="text-right px-4 py-2.5 font-medium">Variance</th>
                  <th className="text-right px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-xs">{s.opened_at}</td>
                    <td className="px-4 py-2 text-xs">{s.closed_at || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.opening_balance.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.expected_closing?.toFixed(2) || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.actual_closing?.toFixed(2) || "—"}</td>
                    <td className={`px-4 py-2 text-right font-mono ${
                      s.difference !== null && s.difference !== undefined
                        ? s.difference < 0
                          ? "text-red-600"
                          : s.difference > 0
                          ? "text-amber-600"
                          : "text-green-600"
                        : ""
                    }`}>
                      {s.difference !== null && s.difference !== undefined
                        ? `${s.difference >= 0 ? "+" : ""}${s.difference.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printShiftHandover(s.id).catch((e) => toast.error(String(e)))}
                        title="Print handover slip"
                        className="h-7 w-7 p-0"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open shift dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Open Shift</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Opening Cash Balance</label>
              <Input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Cash physically present in the till</p>
            </div>
            <Button onClick={handleOpen} className="w-full">Open Shift</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close shift dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Close Shift</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Actual Cash Count</label>
              <Input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Count physical cash and enter total"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Variance will be calculated automatically</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any cash discrepancy reason..." />
            </div>
            <Button onClick={handleClose} className="w-full">Close Shift</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
