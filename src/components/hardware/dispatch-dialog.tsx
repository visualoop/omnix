/**
 * DispatchDialog — capture vehicle + driver + expected delivery date
 * when a delivery note transitions from pending → dispatched.
 *
 * Kenya law + real-world audit trail both need this info. Previously
 * the "Dispatch" button called markDispatched(noteId) with nulls —
 * losing every truck number.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { markDispatched } from "@/services/hardware";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  noteId: string;
  noteNumber: string;
}

export function DispatchDialog({ open, onClose, onSaved, noteId, noteNumber }: Props) {
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setVehicle(""); setDriver(""); } }, [open]);

  const save = async () => {
    if (!vehicle.trim() || !driver.trim()) {
      toast.error("Vehicle number and driver name both required");
      return;
    }
    setSaving(true);
    try {
      await markDispatched(noteId, vehicle.trim(), driver.trim());
      toast.success(`${noteNumber} dispatched`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dispatch · {noteNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Vehicle registration</span>
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="KAA 123B" autoFocus />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Driver name</span>
            <Input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="e.g. Peter Kamau" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Dispatching…" : "Confirm dispatch"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
