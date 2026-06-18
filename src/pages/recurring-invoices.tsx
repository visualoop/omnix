import { useEffect, useState } from "react";
import {
  Repeat, Plus, Loader2, Power, Trash2, Calendar, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  listRecurringTemplates, createRecurringTemplate, setTemplateActive, deleteTemplate, runRecurringSchedule,
  type RecurringTemplate, type RecurringFrequency,
} from "@/services/recurring-invoicing";
import { listCustomers } from "@/services/erp";
import { getProducts, type Product } from "@/services/inventory";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { money as KES } from "@/lib/money";


const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export function RecurringInvoicesPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setTemplates(await listRecurringTemplates(false)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    if (!userId) return;
    setRunning(true);
    try {
      const result = await runRecurringSchedule(userId);
      if (result.generated > 0) {
        toast.success(`Generated ${result.generated} invoice${result.generated !== 1 ? "s" : ""}`);
      } else {
        toast.info("No templates due for invoicing today");
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} template${result.errors.length !== 1 ? "s" : ""} had errors`);
      }
      load();
    } finally { setRunning(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await setTemplateActive(id, !active);
    toast.success(active ? "Paused" : "Resumed");
    load();
  };

  const remove = async (tmpl: RecurringTemplate) => {
    if (!(await confirm({
      title: `Delete "${tmpl.name}"?`,
      description: `${tmpl.invoices_generated} invoices have been generated from this template. They will remain, but the template and its line items will be permanently deleted.`,
      variant: "destructive",
    }))) return;
    await deleteTemplate(tmpl.id);
    toast.success("Deleted");
    load();
  };

  const dueCount = templates.filter((t) =>
    t.is_active === 1 && t.next_run_on <= new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" /> Recurring Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subscription billing — generate invoices on schedule. Auto-runs on each login.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={runNow} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5 mr-1.5" />}
            Run Schedule
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Template
          </Button>
        </div>
      </div>

      {dueCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {dueCount} template{dueCount !== 1 ? "s" : ""} due for invoicing today
              </p>
              <p className="text-xs text-amber-800">Click "Run Schedule" to generate invoices now</p>
            </div>
            <Button onClick={runNow} disabled={running} className="bg-amber-700 hover:bg-amber-800">
              {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Run Now
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Template</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Frequency</th>
              <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Next Run</th>
              <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Generated</th>
              <th className="text-center px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={7} rows={3} />
            ) : templates.length === 0 ? (
              <tr><td colSpan={7} className="p-0">
                <EmptyState
                  icon={Repeat}
                  title="No recurring invoices"
                  description="Set up subscription billing for monthly/quarterly customers."
                  cta={{ label: "New Template", onClick: () => setCreating(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              templates.map((t) => {
                const today = new Date().toISOString().slice(0, 10);
                const isDue = t.is_active === 1 && t.next_run_on <= today;
                return (
                  <tr key={t.id} className="border-b border-border/60 hover:bg-accent/30">
                    <td className="px-3 py-2 text-xs font-medium">{t.name}</td>
                    <td className="px-3 py-2 text-xs">{t.customer_name}</td>
                    <td className="px-3 py-2 text-xs">
                      Every {t.interval_count > 1 ? `${t.interval_count} ` : ""}
                      {FREQ_LABELS[t.frequency].toLowerCase().replace(/ly$/, "")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(t.next_run_on).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })}
                      {isDue && <Badge className="ml-2 bg-amber-600 hover:bg-amber-600 text-[9px]">DUE</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{t.invoices_generated}</td>
                    <td className="px-3 py-2 text-center">
                      {t.is_active === 1 ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                      ) : (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex gap-0.5 justify-end">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => toggle(t.id, t.is_active === 1)}
                          title={t.is_active === 1 ? "Pause" : "Resume"}
                        >
                          <Power className={`h-3 w-3 ${t.is_active === 1 ? "text-emerald-600" : "text-stone-400"}`} />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => remove(t)} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <NewTemplateSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); load(); }}
      />
    </div>
  );
}

function NewTemplateSheet({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState({ id: "", name: "", phone: "", email: "", address: "", tax_pin: "" });
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [intervalCount, setIntervalCount] = useState(1);
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [autoSend, setAutoSend] = useState(false);
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unit_price: number; tax_rate: number }>>([
    { description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(""); setCustomer({ id: "", name: "", phone: "", email: "", address: "", tax_pin: "" });
      setIntervalCount(1); setEndsOn(""); setAutoSend(false);
      setItems([{ description: "", quantity: 1, unit_price: 0, tax_rate: 0 }]);
    }
  }, [open]);

  useEffect(() => {
    if (productSearch) getProducts(productSearch).then(setProducts);
    else setProducts([]);
  }, [productSearch]);

  const total = items.reduce((s, i) => {
    const sub = i.quantity * i.unit_price;
    return s + sub + sub * (i.tax_rate / 100);
  }, 0);

  const save = async () => {
    if (!userId) return;
    if (!name || !customer.name) { toast.error("Template name and customer required"); return; }
    if (items.filter((i) => i.description && i.quantity > 0).length === 0) {
      toast.error("Add at least one valid line item"); return;
    }
    setSubmitting(true);
    try {
      await createRecurringTemplate({
        name, customer_id: customer.id || undefined, customer_name: customer.name,
        customer_phone: customer.phone || undefined, customer_email: customer.email || undefined,
        customer_address: customer.address || undefined, customer_tax_pin: customer.tax_pin || undefined,
        frequency, interval_count: intervalCount,
        starts_on: startsOn, ends_on: endsOn || undefined,
        payment_terms_days: paymentTermsDays, auto_send: autoSend,
        user_id: userId,
        items: items.filter((i) => i.description && i.quantity > 0),
      });
      toast.success("Template created");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>New Recurring Template</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <Field label="Template Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g., "Monthly Subscription - Acme Co"' autoFocus />
          </Field>

          <div className="border-t border-border pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Customer</h3>
            <div className="relative">
              <Input
                value={customer.name}
                onChange={(e) => {
                  setCustomer({ ...customer, name: e.target.value, id: "" });
                  if (e.target.value.trim().length >= 2) listCustomers(e.target.value).then((rs) => setCustomerSuggestions(rs.slice(0, 5)));
                  else setCustomerSuggestions([]);
                }}
                placeholder="Customer name (or search existing)"
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                  {customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomer({
                          id: c.id, name: c.name, phone: c.phone || "",
                          email: c.email || "", address: c.address || "", tax_pin: c.tax_pin || "",
                        });
                        setCustomerSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                    >
                      {c.name} {c.phone && <span className="text-muted-foreground">— {c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" />
              <Input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email" />
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Schedule</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Frequency">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
                >
                  {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Every N">
                <Input type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(parseInt(e.target.value) || 1)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts On *">
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </Field>
              <Field label="Ends On (optional)">
                <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </Field>
            </div>
            <Field label="Payment Terms (days)">
              <Input type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(parseInt(e.target.value) || 30)} />
            </Field>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="rounded" />
              <span>Auto-mark as Sent on generation (skip Draft state)</span>
            </label>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground">Line Items</h3>
              <span className="text-[11px] font-mono">Total: {KES(total)}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Add a product to template..."
                className="pl-8"
              />
              {productSearch && products.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-auto bg-popover border border-border rounded-md shadow-md">
                  {products.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setItems([...items, { description: p.name, quantity: 1, unit_price: p.selling_price, tax_rate: p.tax_rate }]);
                        setProductSearch("");
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-muted-foreground">KES {p.selling_price}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-1 text-[10px] uppercase text-muted-foreground">Description</th>
                  <th className="text-right py-1 text-[10px] uppercase text-muted-foreground w-12">Qty</th>
                  <th className="text-right py-1 text-[10px] uppercase text-muted-foreground w-20">Price</th>
                  <th className="text-right py-1 text-[10px] uppercase text-muted-foreground w-12">Tax%</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b border-border/60">
                    <td className="py-0.5 pr-1">
                      <Input
                        value={it.description}
                        onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="py-0.5 px-0.5">
                      <Input
                        type="number" value={it.quantity}
                        onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))}
                        className="h-7 text-right tabular-nums text-xs"
                      />
                    </td>
                    <td className="py-0.5 px-0.5">
                      <Input
                        type="number" value={it.unit_price}
                        onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))}
                        className="h-7 text-right tabular-nums text-xs"
                      />
                    </td>
                    <td className="py-0.5 px-0.5">
                      <Input
                        type="number" value={it.tax_rate}
                        onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, tax_rate: parseFloat(e.target.value) || 0 } : x))}
                        className="h-7 text-right tabular-nums text-xs"
                      />
                    </td>
                    <td className="py-0.5 pl-0.5">
                      <Button variant="ghost" size="icon-xs" onClick={() => setItems(items.filter((_, i) => i !== idx))} disabled={items.length === 1}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, tax_rate: 0 }])} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Add Line
            </Button>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create Template
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
