import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard as CreditCard,
  Envelope as Mail,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  Phone,
  Pill,
  Plus,
  ShoppingBag,
  Users,
  Wallet,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  upsertCustomer, getCustomerStats,
  type Customer,
} from "@/services/erp";
import { pageCustomers } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { query } from "@/lib/db";
import { recordCustomerPayment } from "@/services/settlement";
import { useAuthStore } from "@/stores/auth";
import { PaymentRecordDialog } from "@/components/payment-record-dialog";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

export function CustomersPage() {
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const list = useListData(pageCustomers, { pageSize: 50 });
  // Aggregate stats over ALL customers (not just the current page).
  const [stats, setStats] = useState({ owed: 0, overLimit: 0 });
  const [statsTick, setStatsTick] = useState(0);
  useEffect(() => {
    (async () => {
      const [r] = await query<{ owed: number; over: number }>(
        `SELECT COALESCE(SUM(balance), 0) AS owed,
           COALESCE(SUM(CASE WHEN credit_limit > 0 AND balance > credit_limit THEN 1 ELSE 0 END), 0) AS over
         FROM customers WHERE active = 1`
      );
      setStats({ owed: r?.owed ?? 0, overLimit: r?.over ?? 0 });
    })();
  }, [statsTick]);
  const refreshAll = () => { list.refresh(); setStatsTick((t) => t + 1); };

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ fallback: "/" }}
        eyebrow="Directory"
        title="Customers"
        description="Manage customer accounts, credit, and patient profiles."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add customer
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Customers" value={String(list.total)} icon={Users} />
        <StatCard label="Total Receivable" value={money(stats.owed)} icon={CreditCard} highlight={stats.owed > 0} />
        <StatCard label="Over Credit Limit" value={String(stats.overLimit)} icon={CreditCard} highlight={stats.overLimit > 0} danger />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="pl-9"
        />
      </div>

      {list.rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{list.search ? "No customers match your search" : "No customers found"}</p>
          <p className="text-xs mt-1">{list.search ? "Try a different name, phone, or email" : "Add your first customer to track sales and credit"}</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Contact</th>
                <th className="text-right px-3 py-2 font-medium">Credit Limit</th>
                <th className="text-right px-3 py-2 font-medium">Balance</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => {
                const overLim = c.credit_limit > 0 && c.balance > c.credit_limit;
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium hover:underline underline-offset-4">{c.name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.phone && <div className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                      {c.email && <div className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {c.credit_limit > 0 ? c.credit_limit.toFixed(0) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {c.balance > 0 ? (
                        <span className={overLim ? "text-red-700 font-semibold" : "text-amber-700"}>
                          {c.balance.toFixed(2)}
                          {overLim && <Badge variant="destructive" className="ml-1.5 text-[10px]">Over Limit</Badge>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0.00</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {c.balance > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPayingCustomer(c)}
                            title="Record payment"
                            className="text-emerald-700 hover:text-emerald-800"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${c.id}`)} title="Patient profile">
                          <Pill className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)} title="Edit">
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar list={list} />

      <CustomerForm
        open={creating || !!editing}
        customer={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); refreshAll(); }}
      />

      <PaymentRecordDialog
        open={!!payingCustomer}
        onClose={() => setPayingCustomer(null)}
        title="Record Customer Payment"
        subtitle={payingCustomer ? `${payingCustomer.name} owes KES ${payingCustomer.balance.toFixed(2)}` : ""}
        maxAmount={payingCustomer?.balance}
        onSubmit={async ({ amount, method, reference, note }) => {
          if (!payingCustomer || !userId) return;
          await recordCustomerPayment(payingCustomer.id, amount, method, userId, reference, note);
          toast.success(`Payment of KES ${amount.toFixed(2)} recorded`);
          refreshAll();
        }}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight, danger }: {
  label: string; value: string; icon: typeof Users; highlight?: boolean; danger?: boolean;
}) {
  const colorClass = danger ? "border-red-500/50 bg-red-500/5" : highlight ? "border-amber-500/50 bg-amber-500/5" : "border-border";
  const iconColor = danger ? "bg-red-500/20 text-red-600" : highlight ? "bg-amber-500/20 text-amber-600" : "bg-muted/30 text-muted-foreground";
  const textColor = danger ? "text-red-700" : highlight ? "text-amber-700" : "";
  return (
    <div className={`border rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className={`h-6 w-6 rounded-md flex items-center justify-center ${iconColor}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`text-xl font-semibold font-mono ${textColor}`}>{value}</p>
    </div>
  );
}

function CustomerForm({ open, customer, onClose, onSaved }: {
  open: boolean; customer: Customer | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Customer>>({});
  const [stats, setStats] = useState<{
    total_purchases: number;
    total_amount: number;
    last_purchase: string | null;
    outstanding_balance: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (customer) {
      setForm(customer);
      getCustomerStats(customer.id).then(setStats);
    } else {
      setForm({});
      setStats(null);
    }
  }, [customer, open]);

  const handleSave = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    setSubmitting(true);
    try {
      await upsertCustomer({ ...form, name: form.name });
      toast.success(customer ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{customer ? customer.name : "New Customer"}</SheetTitle>
        </SheetHeader>

        {stats && customer && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="border border-border rounded-md p-2.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <ShoppingBag className="h-3 w-3" /> Purchases
              </div>
              <div className="text-lg font-semibold font-mono">{stats.total_purchases}</div>
            </div>
            <div className="border border-border rounded-md p-2.5">
              <div className="text-xs text-muted-foreground mb-1">Lifetime Value</div>
              <div className="text-sm font-semibold font-mono">{stats.total_amount.toFixed(0)}</div>
            </div>
            <div className="border border-border rounded-md p-2.5">
              <div className="text-xs text-muted-foreground mb-1">Last Visit</div>
              <div className="text-xs">
                {stats.last_purchase
                  ? new Date(stats.last_purchase).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" })
                  : "—"}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 mt-4">
          <Field label="Name *">
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
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
            <Textarea
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              placeholder="Physical / delivery address — flows onto quotes and delivery notes"
            />
          </Field>
          <Field label="Credit Limit (KES)">
            <Input
              type="number"
              value={form.credit_limit ?? 0}
              onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) || 0 })}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              0 = no credit (cash only). Customer can owe up to this amount.
            </p>
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {customer && customer.balance > 0 && (
            <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-2.5">
              <p className="text-xs font-medium">Outstanding Balance: KES {customer.balance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customer owes this amount on credit. Record payments to reduce.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} className="flex-1" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>

          {customer && (
            <Button
              variant="outline"
              onClick={() => { onClose(); navigate(`/patients/${customer.id}`); }}
              className="w-full"
            >
              <Pill className="h-3.5 w-3.5 mr-2" /> View Patient Profile
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
