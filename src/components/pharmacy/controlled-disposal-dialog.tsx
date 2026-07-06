/**
 * ControlledDisposalDialog — statutory witnessed-destruction record for an
 * expired/unusable controlled substance. Captures method + two witnesses +
 * PPB notification, then writes off the batch and posts the register row.
 */
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordControlledDisposal } from "@/services/controlled-disposal";
import type { ExpiryItem } from "@/services/pharmacy";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface Props {
  item: ExpiryItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ControlledDisposalDialog({ item, onClose, onSaved }: Props) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [method, setMethod] = useState("");
  const [w1, setW1] = useState(""); const [w1lic, setW1lic] = useState("");
  const [w2, setW2] = useState(""); const [w2lic, setW2lic] = useState("");
  const [ppbNotified, setPpbNotified] = useState(false);
  const [ppbRef, setPpbRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setMethod(""); setW1(""); setW1lic(""); setW2(""); setW2lic("");
      setPpbNotified(false); setPpbRef(""); setNotes("");
    }
  }, [item]);

  if (!item) return null;

  const submit = async () => {
    if (!userId) { toast.error("Not signed in"); return; }
    setSubmitting(true);
    try {
      await recordControlledDisposal({
        productId: item.product_id,
        productName: item.product_name,
        batchId: item.batch_id,
        batchNumber: item.batch_number,
        quantity: item.quantity,
        method,
        witness1Name: w1, witness1License: w1lic || undefined,
        witness2Name: w2, witness2License: w2lic || undefined,
        ppbNotified,
        ppbNotificationRef: ppbRef || undefined,
        notes: notes || undefined,
        userId,
      });
      toast.success(`Recorded witnessed destruction of ${item.quantity} × ${item.product_name}`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Witnessed destruction — controlled substance</DialogTitle>
          <DialogDescription>
            Destroying {item.quantity} unit{item.quantity === 1 ? "" : "s"} of{" "}
            <strong>{item.product_name}</strong> (batch {item.batch_number}). Two witnesses are
            required and PPB must be notified per the Narcotic Drugs & Psychotropic Substances Act.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Field label="Destruction method *">
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Incineration via NEMA-licensed contractor" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Witness 1 name *"><Input value={w1} onChange={(e) => setW1(e.target.value)} /></Field>
            <Field label="Witness 1 license"><Input value={w1lic} onChange={(e) => setW1lic(e.target.value)} placeholder="PPB / KMPDC #" /></Field>
            <Field label="Witness 2 name *"><Input value={w2} onChange={(e) => setW2(e.target.value)} /></Field>
            <Field label="Witness 2 license"><Input value={w2lic} onChange={(e) => setW2lic(e.target.value)} placeholder="PPB / KMPDC #" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={ppbNotified} onCheckedChange={(v) => setPpbNotified(v === true)} />
            <span>PPB notified of this destruction</span>
          </label>
          {ppbNotified && (
            <Field label="PPB notification reference">
              <Input value={ppbRef} onChange={(e) => setPpbRef(e.target.value)} placeholder="Notification / letter ref" />
            </Field>
          )}
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional detail for the record" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting || !method.trim() || !w1.trim() || !w2.trim()}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {submitting ? "Recording…" : "Record destruction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}
