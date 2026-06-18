import { useState, useEffect } from "react";
import { Banknote, Loader2, ArrowDownToLine, ArrowUpFromLine, Receipt, Lock, Unlock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  getOpenShift, openShift, closeShift, type CashShift,
} from "@/services/accounting";
import { recordPettyCash, getPettyCashSummary } from "@/services/petty-cash";
import { useAuthStore } from "@/stores/auth";
import { query } from "@/lib/db";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";


// ─── Open Shift Dialog ─────────────────────────────────────────────────
export function OpenShiftDialog({ open, onClose, onOpened }: {
  open: boolean;
  onClose: () => void;
  onOpened: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [openingBalance, setOpeningBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setOpeningBalance("");
  }, [open]);

  const handleOpen = async () => {
    if (!userId) return;
    const balance = parseFloat(openingBalance) || 0;
    if (balance < 0) { toast.error("Opening balance cannot be negative"); return; }
    setSubmitting(true);
    try {
      await openShift(userId, balance);
      toast.success("Shift opened. You can now process sales.");
      onOpened();
    } catch (e) {
      toast.error(String(e));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-4 w-4 text-emerald-400" /> Open Cash Shift
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Count the cash in the till before starting your shift. This becomes your opening balance.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Opening Cash (KES)</label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="text-lg font-mono h-11"
              onKeyDown={(e) => e.key === "Enter" && handleOpen()}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[0, 500, 1000, 2000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setOpeningBalance(String(preset))}
                className="h-8 text-xs rounded border border-border hover:bg-accent transition tabular-nums font-mono"
              >
                {preset === 0 ? "Empty" : preset.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2">
            Once shift is open, all sales until close will be tracked. At end of day, close shift to compare expected vs actual cash.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={handleOpen} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Unlock className="h-3.5 w-3.5 mr-1.5" /> Open Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close Shift Dialog (Z-report-style) ────────────────────────────────
export function CloseShiftDialog({ open, onClose, onClosed }: {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [shift, setShift] = useState<CashShift | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [stats, setStats] = useState<{
    cash_sales: number; mpesa_sales: number; card_sales: number; total_sales: number; sale_count: number;
    petty_in: number; petty_out: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && userId) {
      Promise.all([
        getOpenShift(userId),
        loadStats(userId),
      ]).then(([s, st]) => {
        setShift(s);
        setStats(st);
        setActualCash("");
        setNotes("");
      });
    }
  }, [open, userId]);

  if (!open) return null;

  const expectedCash = shift && stats
    ? shift.opening_balance + stats.cash_sales + stats.petty_in - stats.petty_out
    : 0;
  const actual = parseFloat(actualCash) || 0;
  const variance = actual - expectedCash;
  const hasVariance = Math.abs(variance) > 0.01;

  const handleClose = async () => {
    if (!shift) return;
    if (actualCash === "") { toast.error("Enter the actual cash count"); return; }
    setSubmitting(true);
    try {
      await closeShift(shift.id, actual, notes || undefined);
      toast.success("Shift closed");
      onClosed();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-400" /> Close Cash Shift (End of Day)
          </DialogTitle>
        </DialogHeader>
        {!shift ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No open shift to close</div>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <Card className="bg-muted/30">
                <CardContent className="p-3 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shift Summary</div>
                  <Row label="Opening cash" value={shift.opening_balance} />
                  <Row label="+ Cash sales" value={stats?.cash_sales || 0} color="text-emerald-400" />
                  <Row label="+ Petty cash in" value={stats?.petty_in || 0} color="text-emerald-400" />
                  <Row label="− Petty cash out" value={-(stats?.petty_out || 0)} color="text-rose-400" />
                  <div className="border-t border-border pt-1.5">
                    <Row label="Expected cash in till" value={expectedCash} bold />
                  </div>
                </CardContent>
              </Card>

              {stats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Card><CardContent className="p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Sales</div>
                    <div className="font-mono font-bold">{stats.sale_count}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">M-Pesa</div>
                    <div className="font-mono font-bold">{KES(stats.mpesa_sales)}</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-2 text-center">
                    <div className="text-[9px] uppercase text-muted-foreground">Card</div>
                    <div className="font-mono font-bold">{KES(stats.card_sales)}</div>
                  </CardContent></Card>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Actual cash counted in till *
                </label>
                <Input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder={expectedCash.toFixed(2)}
                  autoFocus
                  className="text-lg font-mono h-11"
                />
                {actualCash !== "" && hasVariance && (
                  <div className={`text-sm font-mono p-2 rounded ${
                    variance < 0 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {variance < 0 ? "Short" : "Over"} by <b>{KES(Math.abs(variance))}</b>
                  </div>
                )}
                {actualCash !== "" && !hasVariance && (
                  <div className="text-sm font-mono p-2 rounded bg-emerald-500/10 text-emerald-400">
                    ✓ Balanced
                  </div>
                )}
              </div>

              {hasVariance && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Variance reason</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
                    placeholder="e.g., Wrong change given in PM, customer paid in cash but rang as M-Pesa..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button size="sm" onClick={handleClose} disabled={submitting || actualCash === ""} className="bg-rose-600 hover:bg-rose-700">
                {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                <Lock className="h-3.5 w-3.5 mr-1.5" /> Close Shift
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function loadStats(userId: string) {
  const [s] = await query<{
    cash_sales: number; mpesa_sales: number; card_sales: number; total_sales: number; sale_count: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN p.method_name LIKE '%ash%' THEN p.amount ELSE 0 END), 0) AS cash_sales,
       COALESCE(SUM(CASE WHEN p.method_name LIKE '%pesa%' OR p.method_name LIKE '%Pesa%' THEN p.amount ELSE 0 END), 0) AS mpesa_sales,
       COALESCE(SUM(CASE WHEN p.method_name LIKE '%ard%' THEN p.amount ELSE 0 END), 0) AS card_sales,
       COALESCE(SUM(p.amount), 0) AS total_sales,
       COUNT(DISTINCT s.id) AS sale_count
     FROM sales s
     LEFT JOIN payments p ON p.sale_id = s.id
     WHERE s.user_id = ?1
       AND s.status != 'voided'
       AND date(s.created_at) = date('now')`,
    [userId],
  );
  const summary = await getPettyCashSummary(new Date().toISOString().slice(0, 10));
  return {
    cash_sales: s?.cash_sales || 0,
    mpesa_sales: s?.mpesa_sales || 0,
    card_sales: s?.card_sales || 0,
    total_sales: s?.total_sales || 0,
    sale_count: s?.sale_count || 0,
    petty_in: summary?.topup_total || 0,
    petty_out: summary?.expense_total || 0,
  };
}

// ─── Petty Cash Quick Dialog ───────────────────────────────────────────
export function PettyCashDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [type, setType] = useState<"topup" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setType("expense"); setAmount(""); setReason(""); }
  }, [open]);

  const save = async () => {
    if (!userId) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter amount"); return; }
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setSubmitting(true);
    try {
      await recordPettyCash({
        type,
        amount: amt,
        description: reason,
        user_id: userId,
      });
      toast.success(type === "expense" ? "Cash withdrawal recorded" : "Top-up recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-amber-400" /> Petty Cash
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`p-3 rounded-md border text-left transition ${
                type === "expense"
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <ArrowUpFromLine className="h-4 w-4 mb-1" />
              <div className="text-sm font-medium">Cash Out</div>
              <div className="text-[10px] text-muted-foreground">Withdraw or expense</div>
            </button>
            <button
              type="button"
              onClick={() => setType("topup")}
              className={`p-3 rounded-md border text-left transition ${
                type === "topup"
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-border hover:bg-accent"
              }`}
            >
              <ArrowDownToLine className="h-4 w-4 mb-1" />
              <div className="text-sm font-medium">Cash In</div>
              <div className="text-[10px] text-muted-foreground">Top up till</div>
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Amount (KES)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="text-lg font-mono h-11"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reason *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === "expense" ? "e.g., Bought tape from shop, paid pikipiki" : "e.g., Owner top-up, deposit from owner"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting} className={
            type === "expense" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
          }>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            <Receipt className="h-3.5 w-3.5 mr-1.5" /> Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, color = "", bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${bold ? "font-semibold" : ""}`}>
      <span className={color || (bold ? "" : "text-muted-foreground")}>{label}</span>
      <span className={`font-mono tabular-nums ${color}`}>{value < 0 ? "-" : ""}{KES(Math.abs(value))}</span>
    </div>
  );
}

