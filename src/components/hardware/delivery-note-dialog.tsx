/**
 * DeliveryNoteDialog — create a new delivery note either standalone
 * (ad-hoc lines) or against an existing paid sale.
 *
 * Simple path: pick customer + delivery address + add lines. Sale
 * linkage is optional.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";
import { createDeliveryNote } from "@/services/hardware";
import { listCustomers, type Customer } from "@/services/erp";
import { UnitSelect } from "@/components/ui/unit-select";

interface LineDraft { name: string; quantity: string; unit: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function DeliveryNoteDialog({ open, onClose, onCreated }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ name: "", quantity: "1", unit: "pcs" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    listCustomers().then(setCustomers);
    setCustomerId("");
    setAddress("");
    setLines([{ name: "", quantity: "1", unit: "pcs" }]);
  }, [open]);

  const save = async () => {
    const cleanLines = lines
      .map((l) => ({ name: l.name.trim(), quantity: Number(l.quantity) || 0, unit: l.unit }))
      .filter((l) => l.name && l.quantity > 0);
    if (cleanLines.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    try {
      await createDeliveryNote({
        customerId: customerId || null,
        address: address.trim() || undefined,
        items: cleanLines.map((l) => ({ name: l.name, quantity: l.quantity, uom: l.unit })),
      });
      toast.success("Delivery note created");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const customerOptions: ComboboxOption[] = [
    { value: "", label: "Walk-in (no customer)" },
    ...customers.map((c) => ({ value: c.id, label: c.name, hint: c.phone ?? "" })),
  ];

  const setLine = (i: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New delivery note</DialogTitle>
          <DialogDescription>Track dispatch of goods to a site or customer address.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Customer</span>
            <Combobox value={customerId} onChange={setCustomerId} options={customerOptions} placeholder="Pick a customer or leave walk-in" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Delivery address</span>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Where the goods are going" />
          </label>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Lines</span>
              <Button size="sm" variant="ghost" onClick={() => setLines((prev) => [...prev, { name: "", quantity: "1", unit: "pcs" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="Item description" className="flex-1 h-8 text-sm" />
                  <Input type="number" step="0.01" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-20 h-8 text-sm font-mono text-right" />
                  <div className="w-24"><UnitSelect value={l.unit} onChange={(u) => setLine(i, { unit: u })} /></div>
                  <button onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-600" title="Remove">
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
