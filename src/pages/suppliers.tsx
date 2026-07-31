import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Envelope as Mail,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  Phone,
  Plus,
  Truck,
  Wallet,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { listSuppliers, pageSuppliers, upsertSupplier, deactivateSupplier, type Supplier } from "@/services/erp";
import { recordSupplierPayment } from "@/services/settlement";
import { useAuthStore } from "@/stores/auth";
import { PaymentRecordDialog } from "@/components/payment-record-dialog";
import { PaginationBar } from "@/components/pagination-bar";
import { useListData } from "@/hooks/use-list-data";
import { toast } from "sonner";
import { money } from "@/lib/money";
import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import { hasPermission } from "@/lib/permissions";
import { useCountry } from "@/stores/country";
import { phonePlaceholder } from "@/lib/locale";

export function SuppliersPage() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [totals, setTotals] = useState({ active: 0, all: 0, owed: 0 });
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const canEdit = hasPermission(user, "suppliers.edit");
  const canPay = hasPermission(user, "suppliers.payment");

  const fetcher = useCallback(
    (query: { search?: string; page?: number; pageSize?: number }) =>
      pageSuppliers({ ...query, activeOnly: !showAll }),
    [showAll],
  );
  const list = useListData<Supplier>(fetcher, { pageSize: 50 });

  const loadTotals = useCallback(async () => {
    const all = await listSuppliers(false);
    setTotals({
      active: all.filter((supplier) => supplier.active === 1).length,
      all: all.length,
      owed: all.reduce((sum, supplier) => sum + (supplier.balance_owed || 0), 0),
    });
  }, []);
  useEffect(() => { void loadTotals(); }, [loadTotals]);

  const refreshAll = () => {
    list.refresh();
    void loadTotals();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Operations"
        title="Suppliers"
        description="Vendors, ordering contacts, and balances you owe."
        actions={canEdit ? (
          <Button onClick={() => setCreating(true)} className="min-h-11 w-full lg:min-h-0 lg:w-auto">
            <Plus className="size-4" /> Add supplier
          </Button>
        ) : undefined}
      />
      <MobileRouteContext />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label="Active suppliers" value={String(totals.active)} icon={Truck} />
        <StatCard label="Total suppliers" value={String(totals.all)} icon={Truck} />
        <StatCard label="Outstanding balance" value={money(totals.owed)} icon={Wallet} highlight={totals.owed > 0} />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={list.search}
            onChange={(event) => list.setSearch(event.target.value)}
            placeholder="Search by name, contact, phone, or email..."
            className="h-11 pl-9 lg:h-9"
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm lg:min-h-0 lg:border-0 lg:px-0">
          <Checkbox checked={showAll} onCheckedChange={(value) => setShowAll(Boolean(value))} />
          Show inactive
        </label>
      </div>

      {!list.loading && list.rows.length === 0 ? (
        <div className="rounded-lg border border-border px-6 py-12 text-center text-muted-foreground">
          <Truck className="mx-auto mb-2 size-10 opacity-30" />
          <p className="text-sm">{list.search ? "No suppliers match your search" : "No suppliers found"}</p>
          <p className="mt-1 text-xs">
            {list.search ? "Try another supplier name, contact, phone, or email." : "Add a supplier before receiving stock or raising a purchase order."}
          </p>
          {list.search ? (
            <Button variant="outline" onClick={() => list.setSearch("")} className="mt-4 min-h-11">Clear search</Button>
          ) : canEdit ? (
            <Button onClick={() => setCreating(true)} className="mt-4 min-h-11"><Plus className="size-4" /> Add first supplier</Button>
          ) : null}
        </div>
      ) : (
        <>
          <div data-mobile-list="suppliers" className="space-y-2 lg:hidden">
            {list.rows.map((supplier) => (
              <article key={supplier.id} className="overflow-hidden rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="min-h-11 w-full px-4 py-3 text-left active:bg-muted/40"
                  aria-label={`Open ${supplier.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{supplier.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {supplier.contact_person || supplier.phone || supplier.email || "No contact details"}
                      </p>
                    </div>
                    {supplier.active === 1 ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
                    <div className="min-w-0 text-xs text-muted-foreground">
                      <p className="truncate">{supplier.payment_terms || "No payment terms"}</p>
                      {supplier.phone && <p className="mt-1 truncate">{supplier.phone}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Balance owed</span>
                      <strong className={`font-mono text-sm ${supplier.balance_owed > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {money(supplier.balance_owed)}
                      </strong>
                    </div>
                  </div>
                </button>
                {(canPay || canEdit) && (
                  <div className="flex border-t border-border">
                    {supplier.balance_owed > 0 && canPay && (
                      <Button variant="ghost" onClick={() => setPaying(supplier)} className="min-h-11 min-w-11 flex-1 rounded-none border-r border-border">
                        <Wallet className="size-4" /> Pay supplier
                      </Button>
                    )}
                    {canEdit && (
                      <Button variant="ghost" onClick={() => setEditing(supplier)} className="min-h-11 min-w-11 flex-1 rounded-none">
                        <Edit3 className="size-4" /> Edit
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div data-desktop-table="suppliers" className="hidden overflow-hidden rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-left font-medium">Terms</th>
                  <th className="px-3 py-2 text-right font-medium">Balance owed</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((supplier) => (
                  <tr
                    key={supplier.id}
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium hover:underline hover:underline-offset-4">{supplier.name}</div>
                      {supplier.contact_person && <div className="text-xs text-muted-foreground">{supplier.contact_person}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {supplier.phone && <div className="flex items-center gap-1 text-xs"><Phone className="size-3" />{supplier.phone}</div>}
                      {supplier.email && <div className="flex items-center gap-1 text-xs"><Mail className="size-3" />{supplier.email}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{supplier.payment_terms || "—"}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${supplier.balance_owed > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {money(supplier.balance_owed)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {supplier.active === 1 ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {supplier.balance_owed > 0 && canPay && (
                          <Button variant="ghost" size="sm" onClick={() => setPaying(supplier)} title="Pay supplier" className="text-emerald-700 hover:text-emerald-800">
                            <Wallet className="size-3.5" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(supplier)} title="Edit supplier">
                            <Edit3 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="[&_button]:min-h-11 lg:[&_button]:min-h-0">
        <PaginationBar list={list} />
      </div>

      {canEdit && (
        <SupplierForm
          open={creating || !!editing}
          supplier={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refreshAll(); }}
        />
      )}

      {canPay && (
        <PaymentRecordDialog
          open={!!paying}
          onClose={() => setPaying(null)}
          title="Pay supplier"
          subtitle={paying ? `${paying.name} · owed ${money(paying.balance_owed)}` : ""}
          maxAmount={paying?.balance_owed}
          onSubmit={async ({ amount, method, reference, note }) => {
            if (!paying || !userId) return;
            await recordSupplierPayment(paying.id, amount, method, userId, reference, note);
            toast.success(`Paid ${money(amount)} to ${paying.name}`);
            setPaying(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight }: {
  label: string;
  value: string;
  icon: typeof Truck;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`flex size-6 items-center justify-center rounded-md ${highlight ? "bg-amber-500/20 text-amber-600" : "bg-muted/30 text-muted-foreground"}`}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className={`font-mono text-xl font-semibold ${highlight ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}

function SupplierForm({ open, supplier, onClose, onSaved }: {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [submitting, setSubmitting] = useState(false);
  const countryCode = useCountry((state) => state.code);

  useEffect(() => { setForm(supplier || {}); }, [supplier, open]);

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSubmitting(true);
    try {
      await upsertSupplier({ ...form, name: form.name });
      toast.success(supplier ? "Supplier updated" : "Supplier created");
      onSaved();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!supplier || !(await confirm({ title: `Deactivate ${supplier.name}?` }))) return;
    await deactivateSupplier(supplier.id);
    toast.success("Supplier deactivated");
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full max-w-full overflow-y-auto sm:w-[460px] sm:max-w-[460px]">
        <SheetHeader><SheetTitle>{supplier ? supplier.name : "New supplier"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <Field label="Supplier name *">
            <Input value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11" autoFocus />
          </Field>
          <Field label="Contact person">
            <Input value={form.contact_person || ""} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} className="h-11" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input
                value={form.phone || ""}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder={phonePlaceholder(countryCode)}
                inputMode="tel"
                className="h-11"
              />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-11" />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.address || ""} onChange={(event) => setForm({ ...form, address: event.target.value })} className="h-11" />
          </Field>
          <Field label="Payment terms">
            <Input value={form.payment_terms || ""} onChange={(event) => setForm({ ...form, payment_terms: event.target.value })} placeholder="e.g., Net 30, COD" className="h-11" />
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>

          {supplier && supplier.balance_owed > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-xs">
              <strong>Outstanding balance:</strong> {money(supplier.balance_owed)}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="min-h-11 flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} className="min-h-11 flex-1" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </div>
          {supplier && supplier.active === 1 && (
            <Button variant="ghost" onClick={handleDeactivate} className="min-h-11 w-full text-red-600">Deactivate supplier</Button>
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
