import { useEffect, useState } from "react";
import { CalendarClock, Plus, Loader2, X, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  listLaybys, getLayby, createLayby, recordLaybyPayment, cancelLayby,
  type Layby, type LaybyItem, type LaybyPayment,
} from "@/services/retail";
import { listCustomers } from "@/services/erp";
import { getProducts, type Product } from "@/services/inventory";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

const KES = (n: number) => "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function LaybysPage() {
  const [tab, setTab] = useState<"active" | "completed" | "cancelled" | "expired">("active");
  const [laybys, setLaybys] = useState<Layby[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setLaybys(await listLaybys({ status: tab })); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const totalActiveBalance = laybys.filter((l) => l.status === "active")
    .reduce((s, l) => s + l.balance_due, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Laybys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pay-in-installments. Customer pays a deposit, claims items when fully paid up.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Layby
        </Button>
      </div>

      {tab === "active" && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-700">Total balance owed</div>
            <div className="text-2xl font-semibold font-mono mt-0.5 text-amber-900">{KES(totalActiveBalance)}</div>
            <div className="text-xs text-amber-700 mt-0.5">Across {laybys.filter((l) => l.status === "active").length} active layby{laybys.filter((l) => l.status === "active").length !== 1 ? "s" : ""}</div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsPanel value={tab} className="mt-3">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Number</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Expires</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Paid</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={7} rows={3} />
                ) : laybys.length === 0 ? (
                  <tr><td colSpan={7} className="p-0">
                    <EmptyState
                      icon={CalendarClock}
                      title={`No ${tab} laybys`}
                      description={tab === "active" ? "Customers can pay a deposit and pick up later when fully paid." : ""}
                      cta={tab === "active" ? { label: "New Layby", onClick: () => setCreating(true), icon: Plus } : undefined}
                    />
                  </td></tr>
                ) : (
                  laybys.map((l) => {
                    const daysLeft = Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000);
                    return (
                      <tr key={l.id} className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                        onClick={() => setViewing(l.id)}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{l.layby_number}</td>
                        <td className="px-3 py-2 text-xs">
                          <div className="font-medium">{l.customer_name}</div>
                          {l.customer_phone && <div className="text-[10px] text-muted-foreground">{l.customer_phone}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {new Date(l.expires_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
                          {l.status === "active" && (
                            <div className={`text-[10px] ${daysLeft < 7 ? "text-red-600" : "text-muted-foreground"}`}>
                              {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">{KES(l.total_amount)}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums text-emerald-600">{KES(l.paid_amount)}</td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums font-semibold">
                          {l.balance_due > 0 ? <span className="text-amber-700">{KES(l.balance_due)}</span> : <span className="text-emerald-600">PAID</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsPanel>
      </Tabs>

      <NewLaybyDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { setCreating(false); load(); }}
      />
      <LaybyDetailSheet
        laybyId={viewing}
        onClose={() => setViewing(null)}
        onChange={load}
      />
    </div>
  );
}

interface LineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

function NewLaybyDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [customer, setCustomer] = useState({ id: "", name: "", phone: "" });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [deposit, setDeposit] = useState(0);
  const [depositMethod, setDepositMethod] = useState("cash");
  const [depositRef, setDepositRef] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomer({ id: "", name: "", phone: "" });
      setCustomerSearch("");
      setItems([]);
      setDeposit(0);
      setNotes("");
    }
  }, [open]);

  useEffect(() => {
    if (productSearch) getProducts(productSearch).then(setProducts);
    else setProducts([]);
  }, [productSearch]);

  useEffect(() => {
    if (customerSearch.trim()) {
      listCustomers(customerSearch).then((rs) => setCustomerSuggestions(rs.slice(0, 5)));
    } else setCustomerSuggestions([]);
  }, [customerSearch]);

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const create = async () => {
    if (!userId) return;
    if (!customer.id || !customer.name) { toast.error("Select an existing customer"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (deposit < 0 || deposit > total) { toast.error("Invalid deposit amount"); return; }

    setSubmitting(true);
    try {
      await createLayby({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        deposit_amount: deposit,
        deposit_method: depositMethod,
        deposit_reference: depositRef || undefined,
        expires_at: expiresAt,
        notes: notes || undefined,
        user_id: userId,
      });
      toast.success("Layby created");
      onCreated();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Layby</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Customer */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Customer * (must be registered)</label>
            {customer.id ? (
              <div className="flex items-center justify-between p-2 border border-border rounded-md bg-muted/20">
                <div>
                  <div className="text-sm font-medium">{customer.name}</div>
                  {customer.phone && <div className="text-[10px] text-muted-foreground">{customer.phone}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomer({ id: "", name: "", phone: "" })}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer by name or phone..." />
                {customerSuggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-md">
                    {customerSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomer({ id: c.id, name: c.name, phone: c.phone || "" });
                          setCustomerSearch("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                      >
                        {c.name} {c.phone && <span className="text-muted-foreground">— {c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Items</label>
            <div className="relative">
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Add product..." />
              {productSearch && products.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-auto bg-popover border border-border rounded-md shadow-md">
                  {products.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setItems([...items, {
                          product_id: p.id,
                          product_name: p.name,
                          quantity: 1,
                          unit_price: p.selling_price,
                        }]);
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
          </div>

          {items.length > 0 && (
            <div className="border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-16">Qty</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Price</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-border/60">
                      <td className="px-2 py-1">{it.product_name}</td>
                      <td className="px-2 py-1">
                        <Input type="number" value={it.quantity} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].quantity = parseFloat(e.target.value) || 0;
                          setItems(newItems);
                        }} className="h-6 text-right tabular-nums" />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" value={it.unit_price} onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].unit_price = parseFloat(e.target.value) || 0;
                          setItems(newItems);
                        }} className="h-6 text-right tabular-nums" />
                      </td>
                      <td className="px-2 py-1 text-right font-mono">{(it.quantity * it.unit_price).toFixed(2)}</td>
                      <td className="px-2 py-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-2 py-1.5">Total</td>
                    <td colSpan={2}></td>
                    <td className="px-2 py-1.5 text-right font-mono">{total.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Deposit + Expiry */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Deposit (KES)</label>
              <Input type="number" value={deposit} onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)} />
              {total > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  {((deposit / total) * 100).toFixed(0)}% of total · Balance KES {(total - deposit).toFixed(2)}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Method</label>
              <select
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Expires</label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>

          {deposit > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Reference (M-Pesa code, etc.)</label>
              <Input value={depositRef} onChange={(e) => setDepositRef(e.target.value)} placeholder="Optional" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the customer or for follow-up" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create Layby
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LaybyDetailSheet({ laybyId, onClose, onChange }: {
  laybyId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [data, setData] = useState<{ layby: Layby; items: LaybyItem[]; payments: LaybyPayment[] } | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const load = async () => {
    if (!laybyId) return;
    setData(await getLayby(laybyId));
  };
  useEffect(() => { load(); }, [laybyId]);

  if (!laybyId || !data) return null;

  const { layby, items, payments } = data;

  const cancel = async () => {
    if (!userId) return;
    if (!(await confirm({
      title: "Cancel this layby?",
      description: layby.paid_amount > 0
        ? `Customer has paid ${KES(layby.paid_amount)}. You can record a refund after cancellation.`
        : "No deposit was paid. The layby will be marked cancelled.",
      variant: "destructive",
      confirmText: "Cancel Layby",
      cancelText: "Keep",
    }))) return;
    await cancelLayby(layby.id);
    toast.success("Cancelled");
    onChange();
    onClose();
  };

  return (
    <Sheet open={!!laybyId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>{layby.layby_number}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-4">
          {/* Customer + Status */}
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</div>
              <div className="font-medium">{layby.customer_name}</div>
              {layby.customer_phone && <div className="text-xs text-muted-foreground">{layby.customer_phone}</div>}
            </div>
            <StatusBadge status={layby.status} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Total" value={KES(layby.total_amount)} />
            <Stat label="Paid" value={KES(layby.paid_amount)} color="text-emerald-600" />
            <Stat label="Balance" value={KES(layby.balance_due)} color={layby.balance_due > 0 ? "text-amber-700" : "text-emerald-600"} />
          </div>

          <div className="text-xs text-muted-foreground border-t border-b border-border py-2">
            Created {new Date(layby.created_at).toLocaleDateString("en-KE")} · Expires {new Date(layby.expires_at).toLocaleDateString("en-KE")}
            {layby.completed_at && <> · Completed {new Date(layby.completed_at).toLocaleDateString("en-KE")}</>}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Items</h3>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Qty</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-border/60">
                      <td className="px-2 py-1.5">{it.product_name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{it.unit_price.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">{it.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Payments ({payments.length})</h3>
              {layby.status === "active" && layby.balance_due > 0 && (
                <Button size="sm" onClick={() => setShowPayment(true)}>
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Record Payment
                </Button>
              )}
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Method</th>
                    <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Reference</th>
                    <th className="text-right px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60">
                      <td className="px-2 py-1.5">{new Date(p.paid_at).toLocaleDateString("en-KE")}</td>
                      <td className="px-2 py-1.5 capitalize">{p.method}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{p.reference || "—"}</td>
                      <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${p.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {p.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {layby.notes && (
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
              <div>{layby.notes}</div>
            </div>
          )}

          {layby.status === "active" && (
            <Button variant="ghost" className="w-full text-red-600" onClick={cancel}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Cancel Layby
            </Button>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>

      {showPayment && (
        <RecordPaymentDialog
          layby={layby}
          userId={userId}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); load(); onChange(); }}
        />
      )}
    </Sheet>
  );
}

function RecordPaymentDialog({ layby, userId, onClose, onSaved }: {
  layby: Layby;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(layby.balance_due);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!userId) return;
    if (amount <= 0 || amount > layby.balance_due + 0.01) {
      toast.error(`Amount must be between 0.01 and ${layby.balance_due.toFixed(2)}`);
      return;
    }
    setSubmitting(true);
    try {
      await recordLaybyPayment({
        layby_id: layby.id,
        amount,
        method,
        reference: reference || undefined,
        user_id: userId,
      });
      toast.success(amount >= layby.balance_due ? "Layby paid in full!" : "Payment recorded");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Layby Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-xs bg-muted/30 rounded p-2">
            Balance due: <b className="font-mono">{KES(layby.balance_due)}</b>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Amount *</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-2 text-[13px]">
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Reference</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold font-mono mt-1 ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Layby["status"] }) {
  switch (status) {
    case "active": return <Badge className="bg-blue-600 hover:bg-blue-600">Active</Badge>;
    case "completed": return <Badge className="bg-emerald-600 hover:bg-emerald-600">Completed</Badge>;
    case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
    case "expired": return <Badge variant="outline" className="text-amber-700">Expired</Badge>;
  }
}
