/**
 * CommissionRuleDialog — CRUD a commission rule for a salesperson.
 * Percentage of sale + optional category scope.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { upsertCommissionRule, type CommissionRule } from "@/services/hardware";
import { query } from "@/lib/db";

interface Employee { id: string; full_name: string; }
interface Category { id: string; name: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: CommissionRule | null;
}

export function CommissionRuleDialog({ open, onClose, onSaved, editing }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [percent, setPercent] = useState("5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    query<Employee>(`SELECT id, full_name FROM employees WHERE active = 1 ORDER BY full_name`).then(setEmployees);
    query<Category>(`SELECT id, name FROM categories ORDER BY name`).then(setCategories);
    if (editing) {
      setEmployeeId(editing.employee_id);
      setCategoryId(editing.category_id ?? "");
      setPercent(String(editing.percent));
    } else {
      setEmployeeId("");
      setCategoryId("");
      setPercent("5");
    }
  }, [open, editing]);

  const save = async () => {
    if (!employeeId) {
      toast.error("Pick a salesperson");
      return;
    }
    const n = Number(percent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      toast.error("Percent must be between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      await upsertCommissionRule({
        id: editing?.id,
        employeeId,
        categoryId: categoryId || null,
        percent: n,
      });
      toast.success(editing ? "Rule updated" : "Rule added");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const employeeOptions: ComboboxOption[] = employees.map((e) => ({ value: e.id, label: e.full_name }));
  const categoryOptions: ComboboxOption[] = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit rule" : "New commission rule"}</DialogTitle>
          <DialogDescription>
            Salesperson earns this % on the net (post-discount, pre-tax) sale amount.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Salesperson</span>
            <Combobox value={employeeId} onChange={setEmployeeId} options={employeeOptions} placeholder="Pick employee…" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Category (optional)</span>
            <Combobox value={categoryId} onChange={setCategoryId} options={categoryOptions} placeholder="All categories" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Percent</span>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} className="font-mono w-24" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
