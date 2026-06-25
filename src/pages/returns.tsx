import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise as RotateCcw,
  ArrowLeft,
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Minus as Minus,
  Plus,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { query } from "@/lib/db";
import { listReturns, createSaleReturn, type SaleReturn } from "@/services/erp";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";
import { money } from "@/lib/money";

interface SaleSummary {
  id: string;
  sale_number: number;
  created_at: string;
  total: number;
  customer_id: string | null;
  customer_name: string | null;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  already_returned?: number;
}

export function ReturnsPage() {
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const navigate = useNavigate();

  const load = async () => setReturns(await listReturns());
  useEffect(() => { load(); }, []);

  const totalRefunded = returns.reduce((s, r) => s + r.refund_amount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Commerce"
        title="Returns"
        description="Process customer returns and issue refunds."
        actions={
          <Button onClick={() => navigate("/returns/new")}>
            <Plus className="h-4 w-4 mr-2" /> New return
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Returns" value={String(returns.length)} icon={RotateCcw} />
        <StatCard label="Refunded This Period" value={money(totalRefunded)} icon={RotateCcw} />
        <StatCard label="Recent Returns" value={String(returns.filter((r) => {
          const d = new Date(r.return_date);
          const days = (Date.now() - d.getTime()) / 86400000;
          return days <= 7;
        }).length)} icon={RotateCcw} />
      </div>

      {returns.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
          <RotateCcw className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No returns yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Return #</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Original Sale</th>
                <th className="text-left px-3 py-2 font-medium">Customer</th>
                <th className="text-left px-3 py-2 font-medium">Reason</th>
                <th className="text-right px-3 py-2 font-medium">Refund</th>
                <th className="text-center px-3 py-2 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">{r.return_number}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{r.return_date}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.sale_number ? `#${r.sale_number}` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">{r.customer_name || <span className="text-muted-foreground">Walk-in</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{r.reason}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">{r.refund_amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="outline" className="capitalize">{r.refund_method}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof RotateCcw }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-6 w-6 rounded-md flex items-center justify-center bg-muted/30 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-xl font-semibold font-mono">{value}</p>
    </div>
  );
}

export function NewReturnPage() {
  const [saleSearch, setSaleSearch] = useState("");
  const [foundSales, setFoundSales] = useState<SaleSummary[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleSummary | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [restockToInventory, setRestockToInventory] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  const searchSales = async () => {
    if (!saleSearch.trim()) return;
    const rows = await query<SaleSummary>(
      `SELECT s.id, s.sale_number, s.created_at, s.total, s.customer_id, c.name as customer_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.status = 'completed'
         AND (CAST(s.sale_number AS TEXT) LIKE ?1 OR c.name LIKE ?1 OR c.phone LIKE ?1)
       ORDER BY s.created_at DESC LIMIT 20`,
      [`%${saleSearch.trim()}%`]
    );
    setFoundSales(rows);
  };

  const selectSale = async (sale: SaleSummary) => {
    setSelectedSale(sale);
    const saleItems = await query<SaleItem>(
      `SELECT id, product_id, product_name, quantity, unit_price, total,
        (SELECT COALESCE(SUM(quantity), 0) FROM sale_return_items WHERE sale_item_id = sale_items.id) as already_returned
       FROM sale_items WHERE sale_id = ?1`,
      [sale.id]
    );
    setItems(saleItems);
    setReturnQtys({});
  };

  const updateQty = (itemId: string, delta: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const max = item.quantity - (item.already_returned || 0);
    const current = returnQtys[itemId] || 0;
    const newQty = Math.max(0, Math.min(max, current + delta));
    setReturnQtys({ ...returnQtys, [itemId]: newQty });
  };

  const totalRefund = items.reduce((s, item) => {
    const qty = returnQtys[item.id] || 0;
    return s + qty * item.unit_price;
  }, 0);

  const itemsToReturn = items.filter((it) => (returnQtys[it.id] || 0) > 0);

  const handleSubmit = async () => {
    if (!userId) return;
    if (itemsToReturn.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }
    if (!reason) {
      toast.error("Provide a reason for the return");
      return;
    }

    setSubmitting(true);
    try {
      await createSaleReturn({
        sale_id: selectedSale?.id,
        customer_id: selectedSale?.customer_id || undefined,
        user_id: userId,
        reason,
        refund_method: refundMethod,
        refund_amount: totalRefund,
        restock_to_inventory: restockToInventory,
        notes: notes || undefined,
        items: itemsToReturn.map((it) => ({
          sale_item_id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: returnQtys[it.id] || 0,
          unit_price: it.unit_price,
        })),
      });
      toast.success(`Return processed. Refund: KES ${totalRefund.toFixed(2)}`);
      navigate("/returns");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/returns")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">New Return</h1>
      </div>

      {!selectedSale ? (
        <div className="border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Find Original Sale</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Search by receipt number, customer name, or phone. You can also process a return without a sale (walk-in).
          </p>
          <div className="flex gap-2">
            <Input
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSales()}
              placeholder="e.g., 1023 or customer name"
              autoFocus
            />
            <Button onClick={searchSales}>Search</Button>
          </div>

          {foundSales.length > 0 && (
            <div className="border border-border rounded-md max-h-80 overflow-auto">
              {foundSales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSale(s)}
                  className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b border-border last:border-0 flex justify-between items-center"
                >
                  <div>
                    <div className="font-mono text-sm">#{s.sale_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString(intlLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {s.customer_name && ` · ${s.customer_name}`}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm">KES {s.total.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sale #{selectedSale.sale_number}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedSale.created_at).toLocaleString(intlLocale())}
                {selectedSale.customer_name && ` · ${selectedSale.customer_name}`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedSale(null); setItems([]); }}>
              Change Sale
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Select Items to Return
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-right px-3 py-2 font-medium">Sold</th>
                  <th className="text-right px-3 py-2 font-medium">Already Returned</th>
                  <th className="text-center px-3 py-2 font-medium">Return Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Refund</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const max = item.quantity - (item.already_returned || 0);
                  const qty = returnQtys[item.id] || 0;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <div>{item.product_name}</div>
                        <div className="text-xs text-muted-foreground">@ {item.unit_price.toFixed(2)}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{item.already_returned || 0}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => updateQty(item.id, -1)} disabled={qty === 0}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-mono text-sm w-8 text-center">{qty}</span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => updateQty(item.id, 1)} disabled={qty >= max}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          {max > 0 && (
                            <Button variant="ghost" size="sm" className="text-xs ml-1 px-2"
                              onClick={() => setReturnQtys({ ...returnQtys, [item.id]: max })}>
                              All
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {(qty * item.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/20 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">Total Refund:</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">{totalRefund.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {itemsToReturn.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Reason *</label>
                  <Select value={reason} onValueChange={(v) => setReason(String(v))}><SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger><SelectContent>
                    
                    <SelectItem value="defective">Defective product</SelectItem>
                    <SelectItem value="wrong_item">Wrong item dispensed</SelectItem>
                    <SelectItem value="customer_changed_mind">Customer changed mind</SelectItem>
                    <SelectItem value="expired">Expired stock</SelectItem>
                    <SelectItem value="prescribed_alternative">Doctor prescribed alternative</SelectItem>
                    <SelectItem value="duplicate">Duplicate purchase</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Refund Method *</label>
                  <Select value={refundMethod} onValueChange={(v) => setRefundMethod(String(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                    <SelectItem value="exchange">Item Exchange (no cash)</SelectItem>
                  </SelectContent></Select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional details..."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={restockToInventory} onCheckedChange={(v) => setRestockToInventory(Boolean(v))} />
                  Restock to inventory
                </label>
                {!restockToInventory && (
                  <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-2 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Items will be written off (e.g., defective/expired). Inventory not affected.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {itemsToReturn.length > 0 && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => navigate("/returns")} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !reason}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Process Return — KES {totalRefund.toFixed(2)}</>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
