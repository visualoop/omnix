/**
 * Units settings — manage every unit of measure used across inventory,
 * recipes, POs, sales. Grouped by dimension so cross-dimension errors
 * (a chef converting "1 bag" to "grams") stay impossible.
 *
 * Seeded on migration 079 with Kenya-oriented defaults (kg/g/ml/l/pcs
 * plus bag, sack, crate, bunch, bale, tin, packet, bottle). Operator
 * can add / edit / disable but can't delete a unit that's referenced
 * by a product.
 */
import { useEffect, useState } from "react";
import { Ruler, Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";
import { listUnits, createUnit, updateUnit, deleteUnit, type Unit, type UnitDimension } from "@/services/units";
import { cn } from "@/lib/utils";

const DIM_LABEL: Record<UnitDimension, string> = {
  mass: "Mass",
  volume: "Volume",
  count: "Count / packaging",
  length: "Length",
};

export function UnitsSettingsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogUnit, setDialogUnit] = useState<Unit | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    listUnits().then(setUnits).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grouped = (Object.keys(DIM_LABEL) as UnitDimension[]).map((d) => ({
    dimension: d,
    label: DIM_LABEL[d],
    items: units.filter((u) => u.dimension === d),
  }));

  if (loading) {
    return <div className="text-sm text-muted-foreground italic p-6">Loading units…</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Ruler className="h-4 w-4" /> Units of measure
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
            The tokens (kg, g, ml, l, pcs, bag, crate) products and recipes
            speak in. Same-dimension units convert automatically —
            200 g of flour deducts 0.2 kg from a bag of unga. Cross-dimension
            (a crate to a kilogram) is refused by design.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add unit
        </Button>
      </div>

      {grouped.map((g) => (
        <section key={g.dimension}>
          <h4 className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium mb-2">
            {g.label}
          </h4>
          {g.items.length === 0 ? (
            <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-md px-3 py-4">
              No units in this dimension yet.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 w-20">Id</th>
                    <th className="text-left px-3 py-2">Label</th>
                    <th className="text-right px-3 py-2">1 {"→"} base</th>
                    <th className="text-right px-3 py-2 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((u) => (
                    <tr key={u.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-2 font-mono font-medium">{u.id}</td>
                      <td className="px-3 py-2">
                        <span className="text-foreground">{u.label}</span>
                        {u.plural && u.plural !== u.label ? (
                          <span className="text-[10px] text-muted-foreground/70 ml-1.5">
                            plural: {u.plural}
                          </span>
                        ) : null}
                        {u.id === u.base_unit_id ? (
                          <Badge variant="outline" className="ml-2 text-[9px] uppercase tracking-wider">Base</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                        {u.id === u.base_unit_id ? "—" : `${u.factor_to_base} ${u.base_unit_id}`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setDialogUnit(u)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Edit"
                        >
                          <PencilSimple className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Delete unit "${u.id}"?`,
                              description: "Any product still using it must be reassigned first.",
                              confirmText: "Delete",
                              cancelText: "Keep",
                            });
                            if (!ok) return;
                            try {
                              await deleteUnit(u.id);
                              toast.success("Unit removed");
                              load();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : String(e));
                            }
                          }}
                          className="text-muted-foreground hover:text-rose-600 p-1"
                          title="Delete"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <UnitDialog
        unit={dialogUnit}
        open={dialogUnit !== null || creating}
        allUnits={units}
        onClose={() => { setDialogUnit(null); setCreating(false); }}
        onSaved={() => { setDialogUnit(null); setCreating(false); load(); }}
      />
    </div>
  );
}

function UnitDialog({
  unit,
  open,
  allUnits,
  onClose,
  onSaved,
}: {
  unit: Unit | null;
  open: boolean;
  allUnits: Unit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = unit !== null;
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [plural, setPlural] = useState("");
  const [dimension, setDimension] = useState<UnitDimension>("count");
  const [baseUnitId, setBaseUnitId] = useState<string>("");
  const [factor, setFactor] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (unit) {
      setId(unit.id);
      setLabel(unit.label);
      setPlural(unit.plural ?? "");
      setDimension(unit.dimension);
      setBaseUnitId(unit.base_unit_id);
      setFactor(String(unit.factor_to_base));
    } else {
      setId("");
      setLabel("");
      setPlural("");
      setDimension("count");
      setBaseUnitId("");
      setFactor("1");
    }
  }, [open, unit]);

  useEffect(() => {
    if (unit || dimension !== "mass" && dimension !== "volume" && dimension !== "length") {
      if (!unit) setBaseUnitId(id || "");
      return;
    }
    if (dimension === "mass") setBaseUnitId("kg");
    else if (dimension === "volume") setBaseUnitId("l");
    else if (dimension === "length") setBaseUnitId("m");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension]);

  const basesForDim = allUnits.filter((u) => u.dimension === dimension && u.id === u.base_unit_id);

  const save = async () => {
    if (!id.trim() || !label.trim()) {
      toast.error("id and label required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateUnit(unit!.id, {
          label,
          plural: plural || null,
          dimension,
          baseUnitId: dimension === "count" && baseUnitId === "" ? unit!.id : baseUnitId,
          factorToBase: dimension === "count" ? 1 : Number(factor) || 1,
        });
        toast.success(`${label} updated`);
      } else {
        await createUnit({
          id: id.trim(),
          label,
          plural: plural || undefined,
          dimension,
          baseUnitId: dimension === "count" ? id.trim() : baseUnitId,
          factorToBase: dimension === "count" ? 1 : Number(factor) || 1,
        });
        toast.success(`${label} added`);
      }
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
          <DialogTitle>{editing ? "Edit unit" : "New unit"}</DialogTitle>
          <DialogDescription>
            Standalone packaging (bag, crate, bunch) stays as its own base.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Short id" hint="Lowercase, no spaces.">
              <Input value={id} onChange={(e) => setId(e.target.value)} disabled={editing} placeholder="kg" />
            </Field>
            <Field label="Label">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="kilogram" />
            </Field>
          </div>
          <Field label="Plural (optional)">
            <Input value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="kilograms" />
          </Field>
          <Field label="Dimension">
            <Select value={dimension} onValueChange={(v) => setDimension(v as UnitDimension)} disabled={editing}>
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
            <div className={cn("grid gap-2 items-end", "grid-cols-[1fr_140px]")}>
              <Field label="Base unit">
                <Select value={baseUnitId} onValueChange={(v) => setBaseUnitId(String(v))}>
                  <SelectTrigger><SelectValue placeholder="Pick base" /></SelectTrigger>
                  <SelectContent>
                    {basesForDim.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.id} — {u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`1 ${id || "?"} = ? ${baseUnitId || "?"}`}>
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
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add unit"}</Button>
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
