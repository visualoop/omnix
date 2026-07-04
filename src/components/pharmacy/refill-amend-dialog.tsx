import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { query } from "@/lib/db";
import { refillPrescriptionWithAmendments } from "@/services/pharmacy-extras";
import { toast } from "sonner";

interface Item {
  id: string;
  product_id: string;
  product_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity_prescribed: number;
  instructions: string | null;
}

interface Amend {
  quantity_prescribed?: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string | null;
}

interface Props {
  open: boolean;
  prescriptionId: string | null;
  patientName: string;
  userId: string | null;
  onClose: () => void;
  onSaved: (newRxId: string) => void;
}

/**
 * Small pre-refill dialog letting the pharmacist tweak per-item quantity /
 * dose / duration before creating the new prescription. Empty fields =
 * copy verbatim (matches the plain refill flow).
 */
export function RefillAmendDialog({ open, prescriptionId, patientName, userId, onClose, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [amendments, setAmendments] = useState<Record<string, Amend>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !prescriptionId) return;
    query<Item>(
      `SELECT id, product_id, product_name, dosage, frequency, duration, quantity_prescribed, instructions
         FROM prescription_items WHERE prescription_id = ?1`,
      [prescriptionId],
    ).then((rows) => {
      setItems(rows);
      setAmendments({});
    });
  }, [open, prescriptionId]);

  const updateAmend = (itemId: string, patch: Partial<Amend>) => {
    setAmendments((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), ...patch } }));
  };

  const handleSubmit = async () => {
    if (!prescriptionId || !userId) return;
    setSubmitting(true);
    try {
      const newRxId = await refillPrescriptionWithAmendments(prescriptionId, userId, amendments);
      toast.success("Refill created");
      onSaved(newRxId);
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refill for {patientName}</DialogTitle>
          <DialogDescription>
            Adjust dose or quantity if the prescriber has changed the plan on this refill. Leave fields blank to copy verbatim.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No items to display.</p>
          ) : (
            items.map((it) => {
              const a = amendments[it.id] || {};
              return (
                <div key={it.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">{it.product_name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Dosage</label>
                      <Input
                        className="h-8 text-xs"
                        placeholder={it.dosage || "1 tab"}
                        value={a.dosage ?? ""}
                        onChange={(e) => updateAmend(it.id, { dosage: e.target.value || undefined })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Frequency</label>
                      <Input
                        className="h-8 text-xs"
                        placeholder={it.frequency || "TDS"}
                        value={a.frequency ?? ""}
                        onChange={(e) => updateAmend(it.id, { frequency: e.target.value || undefined })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</label>
                      <Input
                        className="h-8 text-xs"
                        placeholder={it.duration || "5 days"}
                        value={a.duration ?? ""}
                        onChange={(e) => updateAmend(it.id, { duration: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</label>
                    <Input
                      className="h-8 text-xs w-24"
                      type="number"
                      placeholder={String(it.quantity_prescribed)}
                      value={a.quantity_prescribed ?? ""}
                      onChange={(e) => updateAmend(it.id, {
                        quantity_prescribed: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                    />
                    <Textarea
                      className="text-xs flex-1"
                      placeholder={it.instructions || "Instructions (optional)"}
                      rows={1}
                      value={a.instructions ?? ""}
                      onChange={(e) => updateAmend(it.id, { instructions: e.target.value || undefined })}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create refill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
