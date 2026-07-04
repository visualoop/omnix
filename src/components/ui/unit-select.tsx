/**
 * UnitSelect — combobox for picking a unit of measure. Groups options
 * by dimension (Mass / Volume / Count / Length) with subtle dividers.
 *
 * Used everywhere a unit is picked: product create/edit, recipe
 * ingredient rows, purchase-order lines, stock adjustments, etc.
 *
 * When the operator types a unit that doesn't exist, they can adopt it
 * inline via `onCreate` — a small dialog appears asking for label +
 * dimension + base + factor. New unit lands in the units table and the
 * combobox auto-selects it.
 */
import { useEffect, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listUnits, createUnit, type Unit, type UnitDimension } from "@/services/units";

interface Props {
  value: string;
  onChange: (unitId: string) => void;
  placeholder?: string;
  /** Filter to a single dimension (recipe ingredient row = "mass"|"volume"|
   *  "count", product default unit = all). */
  dimension?: UnitDimension;
  className?: string;
}

export function UnitSelect({ value, onChange, placeholder = "Pick a unit…", dimension, className }: Props) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");

  const load = () => {
    listUnits().then((rows) => {
      setUnits(dimension ? rows.filter((u) => u.dimension === dimension) : rows);
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dimension]);

  const options: ComboboxOption[] = units.map((u) => ({
    value: u.id,
    label: u.id,
    hint: u.label + (u.factor_to_base !== 1 ? ` · 1 ${u.id} = ${u.factor_to_base} ${u.base_unit_id}` : ""),
  }));

  return (
    <>
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        emptyText="No matching unit"
        onCreate={async (label) => {
          setPendingLabel(label);
          setNewDialogOpen(true);
          return null; // dialog handles the actual create; combobox stays as-is until save
        }}
        className={className}
      />
      <NewUnitDialog
        open={newDialogOpen}
        initialLabel={pendingLabel}
        onClose={() => setNewDialogOpen(false)}
        onCreated={(id) => {
          load();
          onChange(id);
          setNewDialogOpen(false);
        }}
      />
    </>
  );
}

function NewUnitDialog({
  open,
  initialLabel,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialLabel: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [plural, setPlural] = useState("");
  const [dimension, setDimension] = useState<UnitDimension>("count");
  const [baseUnitId, setBaseUnitId] = useState<string>("");
  const [factor, setFactor] = useState("1");
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setId(initialLabel.toLowerCase().replace(/\s+/g, "").slice(0, 12));
    setLabel(initialLabel);
    setPlural(initialLabel.endsWith("s") ? initialLabel : `${initialLabel}s`);
    setDimension("count");
    setFactor("1");
    listUnits().then((rows) => {
      setUnits(rows);
      // Default base = self (standalone). If mass/volume/length are
      // picked we'll pre-select the natural base.
    });
  }, [open, initialLabel]);

  useEffect(() => {
    // When dimension changes, pick a sensible base default.
    if (dimension === "mass") setBaseUnitId("kg");
    else if (dimension === "volume") setBaseUnitId("l");
    else if (dimension === "length") setBaseUnitId("m");
    else setBaseUnitId(""); // count → self as base
  }, [dimension]);

  const basesForDim = units.filter((u) => u.dimension === dimension);

  const save = async () => {
    if (!id.trim() || !label.trim()) {
      toast.error("Both id and label are required");
      return;
    }
    setSaving(true);
    try {
      await createUnit({
        id: id.trim(),
        label: label.trim(),
        plural: plural.trim() || undefined,
        dimension,
        baseUnitId: dimension === "count" ? id.trim() : baseUnitId,
        factorToBase: dimension === "count" ? 1 : Number(factor) || 1,
      });
      toast.success(`${label} added`);
      onCreated(id.trim());
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
          <DialogTitle>New unit</DialogTitle>
          <DialogDescription>
            Pick the dimension so conversions work correctly. Standalone
            packaging (bag, crate, bunch) stays as its own base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Short id" hint="Used everywhere. Lowercase, no spaces.">
              <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="kg" />
            </Field>
            <Field label="Label">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="kilogram" />
            </Field>
          </div>
          <Field label="Plural (optional)">
            <Input value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="kilograms" />
          </Field>
          <Field label="Dimension" hint="Only same-dimension units can be converted.">
            <Select value={dimension} onValueChange={(v) => setDimension(v as UnitDimension)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mass">Mass (weight)</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="length">Length</SelectItem>
                <SelectItem value="count">Count / packaging</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {dimension !== "count" ? (
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <Field label="Base unit" hint="Every unit converts through this base.">
                <Select value={baseUnitId} onValueChange={(v) => setBaseUnitId(String(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {basesForDim.filter((u) => u.id === u.base_unit_id).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.id} — {u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`1 ${id || "?"} in ${baseUnitId || "?"}`}>
                <Input
                  type="number"
                  step="any"
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add unit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium block">{label}</span>
      {children}
      {hint ? <span className="text-[10px] text-muted-foreground/80 block">{hint}</span> : null}
    </label>
  );
}
