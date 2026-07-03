/**
 * ReturnDialog — process a return directly from POS without leaving the till.
 *
 * Flow:
 *   1. Recent sales list (last 20) + a search box (sale number, customer name/phone).
 *   2. Click a sale → list of its items with quantity pickers (how many units to return).
 *   3. Pick reason + refund method + restock toggle.
 *   4. Confirm → createSaleReturn() runs → toast + close.
 *
 * The standalone /returns page stays for manager oversight; this dialog is
 * the fast-path for cashier-initiated returns.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  MagnifyingGlass as Search,
  X,
  Package,
  CheckCircle,
} from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { query } from "@/lib/db";
import { createSaleReturn } from "@/services/erp";
import { useAuthStore } from "@/stores/auth";
import { money as KES } from "@/lib/money";
import { toast } from "sonner";
import { intlLocale } from "@/lib/intl";

interface RecentSale {
  id: string;
  sale_number: number;
  total: number;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
  cashier: string | null;
  item_count: number;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function ReturnDialog({ open, onClose, onCompleted }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<RecentSale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("customer_return");
  const [refundMethod, setRefundMethod] = useState<string>("cash");
  const [restock, setRestock] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch(""); setSelectedSale(null); setItems([]); setReturnQty({});
      setReason("customer_return"); setRefundMethod("cash"); setRestock(true); setNotes("");
    }
  }, [open]);

  // Load recent + search
  useEffect(() => {
    if (!open || selectedSale) return;
    setLoading(true);
    const term = search.trim();
    const like = `%${term}%`;
    const sql = `
      SELECT s.id, s.sale_number, s.total, s.created_at, s.customer_id,
             c.name AS customer_name,
             u.full_name AS cashier,
             (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS item_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status != 'held'
        ${term ? "AND (CAST(s.sale_number AS TEXT) LIKE ?1 OR c.name LIKE ?1 OR c.phone LIKE ?1)" : ""}
      ORDER BY s.created_at DESC LIMIT 20`;
    query<RecentSale>(sql, term ? [like] : [])
      .then(setRecent)
      .finally(() => setLoading(false));
  }, [open, search, selectedSale]);

  const selectSale = async (sale: RecentSale) => {
    setLoading(true);
    try {
      const rows = await query<SaleItem>(
        `SELECT si.id, si.product_id,
                COALESCE(p.name, si.product_name) AS product_name,
                si.quantity, si.unit_price
         FROM sale_items si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?1`,
        [sale.id],
      );
      setItems(rows);
      // Default: 0 for each (user picks the returns explicitly)
      const initial: Record<string, number> = {};
      for (const it of rows) initial[it.id] = 0;
      setReturnQty(initial);
      setSelectedSale(sale);
    } finally {
      setLoading(false);
    }
  };

  const total = useMemo(() => {
    return items.reduce((s, it) => s + (returnQty[it.id] || 0) * it.unit_price, 0);
  }, [items, returnQty]);

  const anySelected = useMemo(
    () => items.some((it) => (returnQty[it.id] || 0) > 0),
    [items, returnQty],
  );

  const submit = async () => {
    if (!selectedSale || !userId) return;
    const returnItems = items
      .filter((it) => (returnQty[it.id] || 0) > 0)
      .map((it) => ({
        sale_item_id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: returnQty[it.id],
        unit_price: it.unit_price,
      }));
    if (returnItems.length === 0) {
      toast.error("Pick at least one item to return");
      return;
    }
    setSubmitting(true);
    try {
      await createSaleReturn({
        sale_id: selectedSale.id,
        customer_id: selectedSale.customer_id ?? undefined,
        user_id: userId,
        reason,
        refund_method: refundMethod,
        refund_amount: total,
        restock_to_inventory: restock,
        notes: notes || undefined,
        items: returnItems,
      });
      toast.success(`Return processed · refund ${KES(total)}`);
      onCompleted?.();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedSale ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedSale(null); setItems([]); }}
                  className="h-7 -ml-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                Return · Sale #{selectedSale.sale_number}
              </>
            ) : (
              <>Return an item</>
            )}
          </DialogTitle>
        </DialogHeader>

        {!selectedSale ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by sale number, customer name or phone…"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto border border-border rounded-md">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
              ) : recent.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No sales found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sale #</th>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">When</th>
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Customer</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Items</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => selectSale(s)}
                        className="border-b border-border/60 hover:bg-accent/30 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-mono">#{s.sale_number}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2 text-xs">{s.customer_name || "Walk-in"}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">{s.item_count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{KES(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Items with qty pickers */}
            <div className="flex-1 overflow-y-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Item</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sold</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit</th>
                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Return qty</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-border/60">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {it.product_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">{it.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{KES(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={it.quantity}
                          value={returnQty[it.id] || 0}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value, 10);
                            const clamped = Math.max(0, Math.min(it.quantity, isNaN(raw) ? 0 : raw));
                            setReturnQty((prev) => ({ ...prev, [it.id]: clamped }));
                          }}
                          className="h-7 w-16 text-right font-mono ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason</label>
                <Select value={reason} onValueChange={(v) => setReason(String(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer_return">Customer return</SelectItem>
                    <SelectItem value="damaged">Damaged in shop</SelectItem>
                    <SelectItem value="wrong_item">Wrong item</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Refund method</label>
                <Select value={refundMethod} onValueChange={(v) => setRefundMethod(String(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="credit_note">Store credit</SelectItem>
                    <SelectItem value="account_credit">Customer account credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={restock} onCheckedChange={setRestock} />
                <label className="text-[12px]">Return items to stock (uncheck for damaged/expired)</label>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details…"
                  rows={2}
                />
              </div>
            </div>

            {/* Total + submit */}
            <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Refund amount</div>
                <div className="text-lg font-semibold font-mono tabular-nums">{KES(total)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
                <Button onClick={submit} disabled={submitting || !anySelected}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {submitting ? "Processing…" : "Process return"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
