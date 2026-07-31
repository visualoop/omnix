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
import { currencyCode, phonePlaceholder } from "@/lib/locale";
import { money } from "@/lib/money";
import { MODULES_ALLOWED } from "@/lib/variant";
import { MobileRouteContext } from "@/components/shared/mobile-route-context";
import { hasPermission } from "@/lib/permissions";
import { useCountry } from "@/stores/country";

// Patient profiles are a Dawa (pharmacy) concept — only surface them when the
// pharmacy module is actually installed, not on Salon/Retail/etc.
const DAWA_ENABLED = MODULES_ALLOWED.includes("dawa");

export function CustomersPage() {
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const canEditCustomers = hasPermission(user, "customers.edit");
  const canRecordPayment = hasPermission(user, "customers.payment");
  const canOpenPatient = DAWA_ENABLED && hasPermission(user, "pharmacy.dispense");

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
        description={`Manage customer accounts, credit${DAWA_ENABLED ? ", and patient profiles" : ""}.`}
        actions={canEditCustomers ? (
          <Button onClick={() => setCreating(true)} className="min-h-11 w-full lg:min-h-0 lg:w-auto">
            <Plus className="mr-2 size-4" /> Add customer
          </Button>
        ) : undefined}
      />
      <MobileRouteContext />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
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
          className="h-11 pl-9 lg:h-9"
        />
      </div>

      {list.rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{list.search ? "No customers match your search" : "No customers found"}</p>
          <p className="mt-1 text-xs">{list.search ? "Try a different name, phone, or email" : "Add your first customer to track sales and credit"}</p>
          {!list.search && canEditCustomers && (
            <Button onClick={() => setCreating(true)} className="mt-4 min-h-11">
              <Plus className="size-4" /> Add first customer
            </Button>
          )}
        </div>
      ) : (
        <>
          <div data-mobile-list="customers" className="space-y-2 lg:hidden">
            {list.rows.map((customer) => {
              const overLimit = customer.credit_limit > 0 && customer.balance > customer.credit_limit;
              return (
                <article key={customer.id} className="overflow-hidden rounded-lg border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                    className="min-h-11 w-full px-4 py-3 text-left active:bg-muted/40"
                    aria-label={`Open ${customer.name}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate font-medium">{customer.name}</p>
                          <p className={`shrink-0 font-mono text-sm ${overLimit ? "font-semibold text-red-700" : ""}`}>
                            {money(customer.balance)}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {customer.phone || customer.email || "No contact details"}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Credit limit {customer.credit_limit > 0 ? money(customer.credit_limit) : "Cash only"}</span>
                          {overLimit && <Badge variant="destructive">Over limit</Badge>}
                        </div>
                      </div>
                    </div>
                  </button>
                  {(canRecordPayment || canOpenPatient || canEditCustomers) && (
                    <div className="flex flex-wrap border-t border-border">
                      {customer.balance > 0 && canRecordPayment && (
                        <Button
                          variant="ghost"
                          onClick={() => setPayingCustomer(customer)}
                          className="min-h-11 min-w-[44px] flex-1 rounded-none border-r border-border"
                        >
                          <Wallet className="size-4" /> Payment
                        </Button>
                      )}
                      {canOpenPatient && (
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/patients/${customer.id}`)}
                          className="min-h-11 min-w-[44px] flex-1 rounded-none border-r border-border"
                        >
                          <Pill className="size-4" /> Patient
                        </Button>
                      )}
                      {canEditCustomers && (
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(customer)}
                          className="min-h-11 min-w-[44px] flex-1 rounded-none"
                        >
                          <Edit3 className="size-4" /> Edit
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div data-desktop-table="customers" className="hidden overflow-hidden rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-right font-medium">Credit Limit</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((customer) => {
                  const overLimit = customer.credit_limit > 0 && customer.balance > customer.credit_limit;
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-medium hover:underline hover:underline-offset-4">{customer.name}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {customer.phone && <div className="flex items-center gap-1 text-xs"><Phone className="size-3" />{customer.phone}</div>}
                        {customer.email && <div className="flex items-center gap-1 text-xs"><Mail className="size-3" />{customer.email}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">
                        {customer.credit_limit > 0 ? money(customer.credit_limit) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {customer.balance > 0 ? (
                          <span className={overLimit ? "font-semibold text-red-700" : "text-amber-700"}>
                            {money(customer.balance)}
                            {overLimit && <Badge variant="destructive" className="ml-1.5 text-[10px]">Over Limit</Badge>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{money(0)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {customer.balance > 0 && canRecordPayment && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPayingCustomer(customer)}
                              title="Record payment"
                              className="text-emerald-700 hover:text-emerald-800"
                            >
                              <Wallet className="size-3.5" />
                            </Button>
                          )}
                          {canOpenPatient && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${customer.id}`)} title="Patient profile">
                              <Pill className="size-3.5" />
                            </Button>
                          )}
                          {canEditCustomers && (
                            <Button variant="ghost" size="sm" onClick={() => setEditing(customer)} title="Edit">
                              <Edit3 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="[&_button]:min-h-11 lg:[&_button]:min-h-0">
        <PaginationBar list={list} />
      </div>

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
        subtitle={payingCustomer ? `${payingCustomer.name} owes ${money(payingCustomer.balance)}` : ""}
        maxAmount={payingCustomer?.balance}
        onSubmit={async ({ amount, method, reference, note }) => {
          if (!payingCustomer || !userId) return;
          await recordCustomerPayment(payingCustomer.id, amount, method, userId, reference, note);
          toast.success(`Payment of ${money(amount)} recorded`);
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
  const countryCode = useCountry((s) => s.code);
  const user = useAuthStore((s) => s.user);
  const canOpenPatient = DAWA_ENABLED && hasPermission(user, "pharmacy.dispense");

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
      <SheetContent side="right" className="w-full max-w-full overflow-y-auto sm:w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>{customer ? customer.name : "New Customer"}</SheetTitle>
        </SheetHeader>

        {stats && customer && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="border border-border rounded-md p-2.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <ShoppingBag className="h-3 w-3" /> Purchases
              </div>
              <div className="text-lg font-semibold font-mono">{stats.total_purchases}</div>
            </div>
            <div className="border border-border rounded-md p-2.5">
              <div className="text-xs text-muted-foreground mb-1">Lifetime Value</div>
              <div className="text-sm font-semibold font-mono">{money(stats.total_amount)}</div>
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
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={phonePlaceholder(countryCode)} inputMode="tel" className="h-11" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" />
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
          <Field label={`Credit Limit (${currencyCode(countryCode)})`}>
            <Input
              type="number"
              value={form.credit_limit ?? 0}
              onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) || 0 })}
              className="h-11 font-mono"
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
              <p className="text-xs font-medium">Outstanding Balance: {money(customer.balance)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customer owes this amount on credit. Record payments to reduce.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="min-h-11 flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} className="min-h-11 flex-1" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>

          {customer && canOpenPatient && (
            <Button
              variant="outline"
              onClick={() => { onClose(); navigate(`/patients/${customer.id}`); }}
              className="min-h-11 w-full"
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
