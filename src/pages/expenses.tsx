import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Receipt,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getExpenses, getExpenseCategories, createExpense, deleteExpense, type Expense, type ExpenseCategory } from "@/services/accounting";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    const startDate = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const [exps, cats] = await Promise.all([
      getExpenses(startDate, endDate),
      getExpenseCategories(),
    ]);
    setExpenses(exps);
    setCategories(cats);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    toast.success("Expense deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Last {period} days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border border-border rounded-md p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  period === d ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4">
        <span className="text-xs text-muted-foreground">Total Expenses</span>
        <p className="text-2xl font-semibold mt-1 font-mono">
          <span className="text-xs text-muted-foreground mr-1">KES</span>
          {total.toFixed(2)}
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="py-12 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No expenses recorded yet</p>
          <Button size="sm" className="mt-4" onClick={() => setPanelOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                <th className="text-left px-4 py-2.5 font-medium">Method</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{e.expense_date}</td>
                  <td className="px-4 py-2">{e.category_name || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.description || "—"}</td>
                  <td className="px-4 py-2 text-xs capitalize">{e.payment_method}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExpensePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        categories={categories}
        onSaved={load}
      />
    </div>
  );
}

function ExpensePanel({ open, onClose, categories, onSaved }: { open: boolean; onClose: () => void; categories: ExpenseCategory[]; onSaved: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    category_id: "",
    amount: "",
    description: "",
    payment_method: "cash",
    reference: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        category_id: "",
        amount: "",
        description: "",
        payment_method: "cash",
        reference: "",
        expense_date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!form.category_id || !form.amount) {
      toast.error("Category and amount required");
      return;
    }
    const cat = categories.find((c) => c.id === form.category_id);
    try {
      await createExpense({
        category_id: form.category_id,
        category_name: cat?.name || "",
        amount: parseFloat(form.amount),
        description: form.description || undefined,
        payment_method: form.payment_method,
        reference: form.reference || undefined,
        expense_date: form.expense_date,
        notes: form.notes || undefined,
      }, user!.id);
      toast.success("Expense recorded");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px]">
        <SheetHeader><SheetTitle>Add Expense</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-6">
          <Field label="Category *">
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Amount *">
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" autoFocus />
          </Field>

          <Field label="Description">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment method">
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </select>
            </Field>

            <Field label="Date">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
          </div>

          <Field label="Reference / Receipt #">
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional" />
          </Field>

          <Field label="Notes">
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="pt-4">
            <Button onClick={handleSave} className="w-full">Record Expense</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
