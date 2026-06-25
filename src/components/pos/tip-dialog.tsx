import { useState, useEffect } from "react";
import {
  Heart,
  X,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart";
import { useActiveBranch } from "@/stores/active-branch";
import { listEmployees, type EmployeeWithDetails } from "@/services/employees";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";


export function TipDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cartTip = useCartStore((s) => s.tip);
  const cartTipEmployee = useCartStore((s) => s.tipEmployeeId);
  const setTip = useCartStore((s) => s.setTip);
  const subtotal = useCartStore((s) => s.subtotal());
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount());
  const taxTotal = useCartStore((s) => s.taxTotal());
  const branchId = useActiveBranch((s) => s.active?.id);

  const total = subtotal - cartDiscountAmount + taxTotal;
  const [amount, setAmount] = useState(String(cartTip || 0));
  const [employeeId, setEmployeeId] = useState<string | null>(cartTipEmployee);
  const [percentages, setPercentages] = useState([5, 10, 15, 20]);
  const [employees, setEmployees] = useState<EmployeeWithDetails[]>([]);
  const [assignToStaff, setAssignToStaff] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(String(cartTip || 0));
    setEmployeeId(cartTipEmployee);
    // Load tip settings
    query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('tips.default_percentages', 'tips.assign_to_staff')`,
    ).then((rows) => {
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      if (map["tips.default_percentages"]) {
        setPercentages(map["tips.default_percentages"].split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)));
      }
      setAssignToStaff(map["tips.assign_to_staff"] === "1");
    });
    // Load employees in this branch
    listEmployees({ branchId, active: true }).then(setEmployees);
  }, [open, branchId, cartTip, cartTipEmployee]);

  const tipNum = parseFloat(amount) || 0;

  const apply = () => {
    setTip(tipNum, employeeId);
    onClose();
  };

  const remove = () => {
    setTip(0, null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" /> Add Tip
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs bg-muted/30 rounded p-2 flex justify-between">
            <span>Bill (excluding tip)</span>
            <span className="font-mono font-semibold">{KES(total)}</span>
          </div>

          {/* Quick percentage buttons */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Quick tip</label>
            <div className="grid grid-cols-5 gap-1.5">
              {percentages.map((pct) => {
                const calc = (total * pct) / 100;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAmount(calc.toFixed(0))}
                    className="p-2 rounded border border-border hover:border-rose-500/50 hover:bg-rose-500/10 transition text-center"
                  >
                    <div className="text-sm font-bold text-rose-400">{pct}%</div>
                    <div className="text-[9px] text-muted-foreground tabular-nums font-mono">
                      KES {calc.toFixed(0)}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAmount("0")}
                className="p-2 rounded border border-border hover:border-muted-foreground hover:bg-accent transition text-center"
              >
                <div className="text-sm font-bold text-foreground">No tip</div>
                <div className="text-[9px] text-muted-foreground">—</div>
              </button>
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Or enter custom amount (KES)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-mono h-11"
              placeholder="0"
              autoFocus
            />
          </div>

          {/* Tip total preview */}
          {tipNum > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded p-2 space-y-0.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bill</span>
                <span className="font-mono">{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>+ Tip</span>
                <span className="font-mono font-semibold">{tipNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-rose-500/30 pt-1">
                <span>New total</span>
                <span className="font-mono">{KES(total + tipNum)}</span>
              </div>
            </div>
          )}

          {/* Assign to staff */}
          {assignToStaff && employees.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Tip for (optional)</label>
              <select
                value={employeeId || ""}
                onChange={(e) => setEmployeeId(e.target.value || null)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="">Pool / Direct (no specific staff)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}{e.job_title ? ` — ${e.job_title}` : ""}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          {cartTip > 0 && (
            <Button variant="ghost" size="sm" onClick={remove} className="text-rose-400 mr-auto">
              <X className="h-3.5 w-3.5 mr-1" /> Remove tip
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={apply}>
            <Heart className="h-3.5 w-3.5 mr-1.5" /> Apply Tip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
