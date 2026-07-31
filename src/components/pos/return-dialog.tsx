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
import { cn } from "@/lib/utils";
import type { PosFormFactor } from "@/components/pos/use-pos-form-factor";

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
  formFactor?: PosFormFactor;
}

export function ReturnDialog({ open, onClose, onCompleted, formFactor = "desktop" }: Props) {
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
      <DialogContent
        showCloseButton={formFactor === "desktop"}
        className={cn(
          "flex flex-col",
          formFactor === "desktop"
            ? "max-h-[85vh] max-w-2xl"
            : "!inset-0 !top-0 !left-0 !h-[100dvh] !max-h-none !w-full !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-background !backdrop-blur-none pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] [&_button]:min-h-11 [&_input]:min-h-11 motion-reduce:!duration-0 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring [&_input]:focus-visible:outline-none [&_input]:focus-visible:ring-2 [&_input]:focus-visible:ring-ring",
        )}
      >
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
              ) : formFactor !== "desktop" ? (
                <div className="divide-y divide-border">
                  {recent.map((sale) => (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => selectSale(sale)}
                      className="flex min-h-20 w-full items-center justify-between gap-3 px-3 py-3 text-left active:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-semibold">Sale #{sale.sale_number}</span>
                        <span className="mt-1 block truncate text-sm">{sale.customer_name || "Walk-in"}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })} · {sale.item_count} item{sale.item_count === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{KES(sale.total)}</span>
                    </button>
                  ))}
                </div>
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
              {formFactor !== "desktop" ? (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 shrink-0 text-muted-foreground" /> {item.product_name}</span>
                          <span className="mt-1 block font-mono text-xs text-muted-foreground">Sold {item.quantity} · {KES(item.unit_price)} each</span>
                        </span>
                        <label className="shrink-0 text-right">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Return qty</span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={item.quantity}
                            value={returnQty[item.id] || 0}
                            onChange={(event) => {
                              const raw = Number.parseInt(event.target.value, 10);
                              const clamped = Math.max(0, Math.min(item.quantity, Number.isNaN(raw) ? 0 : raw));
                              setReturnQty((previous) => ({ ...previous, [item.id]: clamped }));
                            }}
                            className="mt-1 h-11 w-20 text-right font-mono text-base"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
              )}
            </div>

            {/* Options */}
            <div className={cn("grid gap-3 mt-3", formFactor === "desktop" ? "grid-cols-2" : "grid-cols-1")}>
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
              <div className={cn("flex items-center gap-2", formFactor === "desktop" && "col-span-2")}>
                <Switch checked={restock} onCheckedChange={setRestock} />
                <label className="text-[12px]">Return items to stock (uncheck for damaged/expired)</label>
              </div>
              <div className={cn(formFactor === "desktop" && "col-span-2")}>
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
            <div className={cn("border-t border-border mt-3 pt-3", formFactor === "desktop" ? "flex items-center justify-between" : "space-y-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]")}>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Refund amount</div>
                <div className="text-lg font-semibold font-mono tabular-nums">{KES(total)}</div>
              </div>
              <div className={cn("gap-2", formFactor === "desktop" ? "flex" : "grid grid-cols-2")}>
                <Button variant="outline" className={cn(formFactor !== "desktop" && "h-12")} onClick={onClose} disabled={submitting}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
                <Button className={cn(formFactor !== "desktop" && "h-12")} onClick={submit} disabled={submitting || !anySelected}>
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
