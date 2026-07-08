/**
 * ReceiveUnitsDialog — receive serialized equipment into stock.
 *
 * Equipment products (tracked_by_serial) are received one physical unit at
 * a time: each row is a serial + engine/chassis number, year, condition,
 * cost and meter reading. Submitting creates, atomically, a stock batch +
 * movement + the equipment-unit registry row for every serial.
 */
import { useEffect, useState } from "react";
import {
  CircleNotch as Loader2,
  Plus,
  Trash as Trash2,
  Wrench,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth";
import {
  listEquipmentProducts,
  receiveEquipmentUnits,
  type EquipmentProduct,
  type ReceiveUnitInput,
  type UnitCondition,
} from "@/services/equipment";
import { toast } from "sonner";

interface UnitRow {
  serial_number: string;
  engine_number: string;
  chassis_number: string;
  year_of_manufacture: string;
  condition: UnitCondition;
  acquisition_cost: string;
  meter_value: string;
}

function blankRow(): UnitRow {
  return {
    serial_number: "",
    engine_number: "",
    chassis_number: "",
    year_of_manufacture: "",
    condition: "new",
    acquisition_cost: "",
    meter_value: "",
  };
}

export function ReceiveUnitsDialog({
  open,
  onClose,
  onSaved,
  prefillProductId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  prefillProductId?: string;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [products, setProducts] = useState<EquipmentProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<UnitRow[]>([blankRow()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSupplier("");
      setReference("");
      setRows([blankRow()]);
      setProductId("");
      return;
    }
    listEquipmentProducts().then((ps) => {
      setProducts(ps);
      if (prefillProductId && ps.some((p) => p.id === prefillProductId)) {
        setProductId(prefillProductId);
      }
    });
  }, [open, prefillProductId]);

  const update = (idx: number, patch: Partial<UnitRow>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (idx: number) =>
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, i) => i !== idx)));

  const save = async () => {
    if (!userId) return;
    if (!productId) {
      toast.error("Choose an equipment product first.");
      return;
    }
    const filled = rows.filter((r) => r.serial_number.trim());
    if (filled.length === 0) {
      toast.error("Enter at least one serial number.");
      return;
    }
    const payload: ReceiveUnitInput[] = filled.map((r) => ({
      serial_number: r.serial_number.trim(),
      engine_number: r.engine_number.trim() || undefined,
      chassis_number: r.chassis_number.trim() || undefined,
      year_of_manufacture: r.year_of_manufacture ? parseInt(r.year_of_manufacture) : undefined,
      condition: r.condition,
      acquisition_cost: r.acquisition_cost ? parseFloat(r.acquisition_cost) : undefined,
      meter_value: r.meter_value ? parseFloat(r.meter_value) : undefined,
    }));

    setSubmitting(true);
    try {
      await receiveEquipmentUnits(productId, payload, {
        userId,
        supplier: supplier.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      toast.success(`Received ${payload.length} unit${payload.length === 1 ? "" : "s"}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl w-[calc(100vw-2rem)] gap-0 p-0 overflow-visible max-h-[calc(100vh-3rem)] flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Wrench className="size-4 text-primary" />
            Receive equipment units
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed">
            Each serial becomes a tracked unit with its own warranty and service
            history. One stock item is added per serial.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Equipment product *">
              <Select value={productId} onValueChange={(v) => setProductId(v as string)}>
                <SelectTrigger>
                  <SelectValue placeholder={products.length ? "Choose model…" : "No serial-tracked products"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="From (supplier)">
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Reference / delivery #">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          {products.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
              No products are set to track by serial yet. Open a product, go to the
              <strong> Equipment</strong> tab and turn on “Track by serial number”.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={idx} className="rounded-md border border-border bg-card p-4 space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Unit {idx + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      aria-label="Remove unit"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Serial number *">
                      <Input
                        value={r.serial_number}
                        onChange={(e) => update(idx, { serial_number: e.target.value })}
                        placeholder="Unique serial"
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Engine number">
                      <Input value={r.engine_number} onChange={(e) => update(idx, { engine_number: e.target.value })} placeholder="Optional" className="font-mono" />
                    </Field>
                    <Field label="Chassis number">
                      <Input value={r.chassis_number} onChange={(e) => update(idx, { chassis_number: e.target.value })} placeholder="Optional" className="font-mono" />
                    </Field>
                    <Field label="Year">
                      <Input type="number" value={r.year_of_manufacture} onChange={(e) => update(idx, { year_of_manufacture: e.target.value })} placeholder="e.g. 2023" />
                    </Field>
                    <Field label="Condition">
                      <Select value={r.condition} onValueChange={(v) => update(idx, { condition: v as UnitCondition })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                          <SelectItem value="refurbished">Refurbished</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Acquisition cost (KES)">
                      <Input type="number" value={r.acquisition_cost} onChange={(e) => update(idx, { acquisition_cost: e.target.value })} placeholder="0.00" className="text-right tabular-nums" />
                    </Field>
                    <Field label="Meter (hours/km)">
                      <Input type="number" value={r.meter_value} onChange={(e) => update(idx, { meter_value: e.target.value })} placeholder="0" className="text-right tabular-nums" />
                    </Field>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow} className="w-full">
                <Plus className="size-4" /> Add another unit
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-4 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting || !productId || products.length === 0}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Receive units
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
