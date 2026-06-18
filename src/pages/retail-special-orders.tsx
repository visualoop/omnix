import { useEffect, useState } from "react";
import { CalendarPlus, Plus, Loader2, Phone, Check, X, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsPanel } from "@/components/ui/tabs";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listSpecialOrders, createSpecialOrder, updateSpecialOrderStatus, parseSpecialOrderItems,
  prepareSpecialOrderForPosCheckout,
  type SpecialOrder, type SpecialOrderItem,
} from "@/services/retail";
import { listCustomers } from "@/services/erp";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

const STATUS_LABELS: Record<SpecialOrder["status"], string> = {
  pending: "Pending",
  ordered: "Ordered",
  received: "Received",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

export function SpecialOrdersPage() {
  const [tab, setTab] = useState<SpecialOrder["status"]>("pending");
  const [orders, setOrders] = useState<SpecialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { setOrders(await listSpecialOrders({ status: tab })); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const advance = async (id: string, next: SpecialOrder["status"]) => {
    await updateSpecialOrderStatus(id, next);
    toast.success(`Marked ${STATUS_LABELS[next].toLowerCase()}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" /> Special Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-orders and items not in stock. Track from request → ordered from supplier → received → fulfilled to customer.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Special Order
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SpecialOrder["status"])}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="ordered">Ordered</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="fulfilled">Fulfilled</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsPanel value={tab} className="mt-3">
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Items</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Needed By</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Est. Value</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={6} rows={3} />
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="p-0">
                    <EmptyState
                      icon={CalendarPlus}
                      title={`No ${STATUS_LABELS[tab].toLowerCase()} special orders`}
                      description="Customers can request items not in stock and you'll track them here."
                      cta={tab === "pending" ? { label: "New Special Order", onClick: () => setCreating(true), icon: Plus } : undefined}
                    />
                  </td></tr>
                ) : (
                  orders.map((o) => {
                    const items = parseSpecialOrderItems(o.items_json);
                    return (
                      <tr key={o.id} className="border-b border-border/60">
                        <td className="px-3 py-2 text-xs">
                          <div className="font-medium">{o.customer_name || "(Walk-in)"}</div>
                          {o.customer_phone && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-2.5 w-2.5" /> {o.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {items.slice(0, 2).map((it, i) => (
                            <div key={i}>
                              <span className="font-mono">{it.quantity}</span>
                              {" × "}
                              {it.product_name}
                            </div>
                          ))}
                          {items.length > 2 && <div className="text-[10px] text-muted-foreground">+ {items.length - 2} more</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {o.needed_by ? new Date(o.needed_by).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short" }) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-mono tabular-nums">
                          {o.estimated_value ? money(o.estimated_value) : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{o.notes || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            {o.status === "pending" && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => advance(o.id, "ordered")}>Order</Button>
                                <Button variant="ghost" size="sm" onClick={() => advance(o.id, "cancelled")} className="text-red-600">
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            {o.status === "ordered" && (
                              <Button variant="outline" size="sm" onClick={() => advance(o.id, "received")}>Mark Received</Button>
                            )}
                            {o.status === "received" && (
                              <div className="flex gap-1">
                                <Button size="sm" onClick={async () => {
                                  try {
                                    const checkout = await prepareSpecialOrderForPosCheckout(o.id);
                                    if (!checkout) { toast.error("Cannot fulfill this order"); return; }
                                    useCartStore.getState().loadSnapshot(checkout.items, 0, checkout.customerId, {
                                      source: { type: "special_order", id: o.id, label: `SO — ${checkout.customerName || "Special Order"}` },
                                    });
                                    toast.success("Special order loaded into POS cart");
                                    navigate("/pos");
                                  } catch (e) { toast.error(String(e)); }
                                }}>
                                  <ShoppingCart className="h-3 w-3 mr-1" /> Fulfill via POS
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => advance(o.id, "fulfilled")}>
                                  <Check className="h-3 w-3 mr-1" /> Quick fulfill
                                </Button>
                              </div>
                            )}
                          </div>
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

      <NewSpecialOrderSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); load(); }}
      />
    </div>
  );
}

function NewSpecialOrderSheet({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [items, setItems] = useState<SpecialOrderItem[]>([{ product_name: "", quantity: 1 }]);
  const [neededBy, setNeededBy] = useState("");
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCustomerName(""); setCustomerPhone(""); setCustomerId(null);
      setItems([{ product_name: "", quantity: 1 }]);
      setNeededBy(""); setEstimatedValue(0); setNotes("");
    }
  }, [open]);

  const searchCustomer = async (q: string) => {
    setCustomerName(q);
    if (q.trim().length < 2) { setCustomerSuggestions([]); return; }
    const results = await listCustomers(q);
    setCustomerSuggestions(results.slice(0, 5));
  };

  const save = async () => {
    if (!userId) return;
    if (items.filter((i) => i.product_name).length === 0) {
      toast.error("Add at least one item description");
      return;
    }
    setSubmitting(true);
    try {
      await createSpecialOrder({
        customer_id: customerId || undefined,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: items.filter((i) => i.product_name && i.quantity > 0),
        estimated_value: estimatedValue || undefined,
        needed_by: neededBy || undefined,
        notes: notes || undefined,
        user_id: userId,
      });
      toast.success("Special order created");
      onSaved();
    } catch (e) { toast.error(String(e)); }
    finally { setSubmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>New Special Order</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto space-y-3">
          <div className="space-y-1 relative">
            <label className="text-[11px] font-medium text-muted-foreground">Customer Name</label>
            <Input
              value={customerName}
              onChange={(e) => { searchCustomer(e.target.value); setCustomerId(null); }}
              placeholder="e.g., Mama Wanjiru"
            />
            {customerSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-auto bg-popover border border-border rounded-md shadow-md">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone || "");
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

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Phone</label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07XX XXX XXX" />
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-muted-foreground">Items requested</label>
              <Button variant="ghost" size="sm" onClick={() => setItems([...items, { product_name: "", quantity: 1 }])}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <Input
                    type="number"
                    value={it.quantity}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].quantity = parseFloat(e.target.value) || 0;
                      setItems(newItems);
                    }}
                    className="w-16"
                  />
                  <Input
                    value={it.product_name}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[idx].product_name = e.target.value;
                      setItems(newItems);
                    }}
                    placeholder="e.g., 5kg sugar (Mumias)"
                    className="flex-1"
                  />
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon-xs" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Needed By</label>
              <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Estimated Value (KES)</label>
              <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
              placeholder="Any special requirements, source preferences, etc."
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
