import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { Plus, Search, Truck, Edit3, Phone, Mail, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { listSuppliers, upsertSupplier, deactivateSupplier, type Supplier } from "@/services/erp";
import { recordSupplierPayment } from "@/services/settlement";
import { useAuthStore } from "@/stores/auth";
import { PaymentRecordDialog } from "@/components/payment-record-dialog";
import { toast } from "sonner";
import { money } from "@/lib/money";

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const load = async () => {
    setSuppliers(await listSuppliers(!showAll));
  };
  useEffect(() => { load(); }, [showAll]);

  const filtered = suppliers.filter((s) =>
    !search.trim() ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalOwed = suppliers.reduce((s, sup) => s + sup.balance_owed, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage vendors and track outstanding balances
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Supplier
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active Suppliers" value={String(suppliers.filter((s) => s.active === 1).length)} icon={Truck} />
        <StatCard label="Total Suppliers" value={String(suppliers.length)} icon={Truck} />
        <StatCard label="Outstanding Balance" value={money(totalOwed)} icon={Truck} highlight={totalOwed > 0} />
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No suppliers found</p>
          <p className="text-xs mt-1">Add your first supplier to start receiving stock</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Contact</th>
                <th className="text-left px-3 py-2 font-medium">Terms</th>
                <th className="text-right px-3 py-2 font-medium">Balance Owed</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{s.name}</div>
                    {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {s.phone && <div className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</div>}
                    {s.email && <div className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.payment_terms || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {s.balance_owed > 0 ? (
                      <span className="text-amber-700">{s.balance_owed.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">0.00</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {s.active === 1 ? (
                      <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {s.balance_owed > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaying(s)}
                          title="Pay supplier"
                          className="text-emerald-700 hover:text-emerald-800"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SupplierForm
        open={creating || !!editing}
        supplier={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />

      <PaymentRecordDialog
        open={!!paying}
        onClose={() => setPaying(null)}
        title="Pay Supplier"
        subtitle={paying ? `${paying.name} — owed KES ${paying.balance_owed.toFixed(2)}` : ""}
        maxAmount={paying?.balance_owed}
        onSubmit={async ({ amount, method, reference, note }) => {
          if (!paying || !userId) return;
          await recordSupplierPayment(paying.id, amount, method, userId, reference, note);
          toast.success(`Paid KES ${amount.toFixed(2)} to ${paying.name}`);
          load();
        }}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: typeof Truck; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${highlight ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${highlight ? "bg-amber-500/20 text-amber-600" : "bg-muted/30 text-muted-foreground"}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`text-xl font-semibold font-mono ${highlight ? "text-amber-700" : ""}`}>{value}</p>
    </div>
  );
}

function SupplierForm({ open, supplier, onClose, onSaved }: {
  open: boolean; supplier: Supplier | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (supplier) {
      setForm(supplier);
    } else {
      setForm({});
    }
  }, [supplier, open]);

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      await upsertSupplier({ ...form, name: form.name });
      toast.success(supplier ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!supplier || !(await confirm({ title: `Deactivate ${supplier.name}?` }))) return;
    await deactivateSupplier(supplier.id);
    toast.success("Deactivated");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>{supplier ? supplier.name : "New Supplier"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <Field label="Supplier Name *">
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Contact Person">
            <Input value={form.contact_person || ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Payment Terms">
            <Input
              value={form.payment_terms || ""}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="e.g., Net 30, COD"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full min-h-[60px] rounded-md border border-input bg-transparent p-2 text-sm"
            />
          </Field>

          {supplier && supplier.balance_owed > 0 && (
            <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-2.5 text-xs">
              <strong>Outstanding balance:</strong> KES {supplier.balance_owed.toFixed(2)}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} className="flex-1" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
          {supplier && supplier.active === 1 && (
            <Button variant="ghost" onClick={handleDeactivate} className="w-full text-red-600">
              Deactivate Supplier
            </Button>
          )}
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
