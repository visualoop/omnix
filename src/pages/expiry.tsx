import { useState, useEffect } from "react";
import {
  Calendar,
  Warning as AlertTriangle,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { getExpiringItems, type ExpiryItem } from "@/services/pharmacy";
import { writeOffBatch, type WriteOffReason } from "@/services/wastage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function ExpiryPage() {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [window, setWindow] = useState(90);
  const [target, setTarget] = useState<ExpiryItem | null>(null);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const load = () => getExpiringItems(window).then(setItems);
  useEffect(() => { load(); }, [window]);

  const expired = items.filter((i) => i.days_to_expiry < 0);
  const critical = items.filter((i) => i.days_to_expiry >= 0 && i.days_to_expiry <= 30);
  const warning = items.filter((i) => i.days_to_expiry > 30 && i.days_to_expiry <= 90);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton fallback="/inventory" />
          <h1 className="text-xl font-semibold tracking-tight">Expiry Alerts</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Batches with an expiry date within the selected window. Write off expired batches
            to zero the stock and record the loss in the Wastage report.
          </p>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setWindow(d)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                window === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Expired" value={expired.length} variant="destructive" />
        <Stat label="< 30 days" value={critical.length} variant="warning" />
        <Stat label="30-90 days" value={warning.length} variant="default" />
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No items expiring within {window} days</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Product</th>
                <th className="text-left px-4 py-2.5 font-medium">Batch</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                <th className="text-left px-4 py-2.5 font-medium">Expiry Date</th>
                <th className="text-right px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.batch_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.product_name}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{item.batch_number}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.expiry_date}</td>
                  <td className="px-4 py-2.5 text-right">
                    {item.days_to_expiry < 0 ? (
                      <Badge variant="destructive" className="text-xs">Expired {Math.abs(item.days_to_expiry)}d ago</Badge>
                    ) : item.days_to_expiry <= 30 ? (
                      <Badge variant="destructive" className="text-xs">{item.days_to_expiry}d</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{item.days_to_expiry}d</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => setTarget(item)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Write off
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WriteOffDialog
        item={target}
        onClose={() => setTarget(null)}
        onSaved={() => { setTarget(null); load(); }}
        userId={userId}
      />
    </div>
  );
}

function WriteOffDialog({
  item,
  onClose,
  onSaved,
  userId,
}: {
  item: ExpiryItem | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
}) {
  const [reason, setReason] = useState<WriteOffReason>("expired");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setReason(item.days_to_expiry < 0 ? "expired" : "damaged");
      setNotes("");
    }
  }, [item]);

  if (!item) return null;

  const submit = async () => {
    if (!userId) {
      toast.error("Not signed in");
      return;
    }
    setSubmitting(true);
    try {
      await writeOffBatch({ batchId: item.batch_id, reason, notes, userId });
      toast.success(`Wrote off ${item.quantity} of ${item.product_name}`);
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write off batch</DialogTitle>
          <DialogDescription>
            Zeroes {item.quantity} unit{item.quantity === 1 ? "" : "s"} of{" "}
            <strong>{item.product_name}</strong> (batch {item.batch_number}) and records the loss.
            This cannot be reversed from here — restore via a manual stock adjustment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Reason
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["expired", "damaged", "returned_to_supplier", "other"] as WriteOffReason[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-2 rounded-md border text-xs font-medium text-left transition ${
                    reason === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {r === "expired" ? "Expired"
                    : r === "damaged" ? "Damaged"
                    : r === "returned_to_supplier" ? "Return to supplier"
                    : "Other"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notes (optional)
            </label>
            <Input
              className="mt-1"
              placeholder="e.g. Damaged in transit, supplier accepted return"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Writing off…" : "Write off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, variant }: { label: string; value: number; variant: "default" | "warning" | "destructive" }) {
  const styles = {
    default: "border-border",
    warning: "border-amber-500/50 bg-amber-500/5",
    destructive: "border-destructive/50 bg-destructive/5",
  };
  return (
    <div className={`border rounded-lg p-4 ${styles[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {variant !== "default" && <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-semibold mt-2 font-mono">{value}</p>
    </div>
  );
}
