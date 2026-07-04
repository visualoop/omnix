/**
 * Goods Receipts (GRN) — receiving inbox for purchase orders.
 *
 * Every partial or full receive on a PO writes a `goods_receipts` row.
 * This page is the read-only log of those events so the finance team
 * can trace what was actually received, when, and against which PO.
 * The full receive workflow still lives on the PO detail page — this
 * is the audit / search view.
 */
import { useEffect, useState } from "react";
import { CalendarBlank, Package, Warning } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface GRN {
  id: string;
  grn_number: string;
  po_id: string | null;
  po_number: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  receipt_date: string;
  total: number;
  reversed_at: string | null;
  item_count: number;
}

export function GoodsReceiptsPage() {
  const [rows, setRows] = useState<GRN[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    query<GRN>(
      `SELECT gr.id, gr.grn_number,
              gr.po_id, po.po_number,
              gr.supplier_id, s.name AS supplier_name,
              gr.invoice_number, gr.receipt_date, gr.total,
              gr.reversed_at,
              (SELECT COUNT(*) FROM goods_receipt_items WHERE grn_id = gr.id) AS item_count
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON po.id = gr.po_id
       LEFT JOIN suppliers s ON s.id = gr.supplier_id
       ORDER BY gr.created_at DESC
       LIMIT 200`,
    )
      .then(setRows)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground p-6">Loading receipts…</div>;

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.grn_number.toLowerCase().includes(q) ||
      (r.po_number?.toLowerCase().includes(q) ?? false) ||
      (r.supplier_name?.toLowerCase().includes(q) ?? false) ||
      (r.invoice_number?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Goods receipts</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Every partial or full receive against a PO. Reversed receipts stay in the log with a strikethrough.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GRN #, PO #, supplier, invoice…"
          className="max-w-[300px]"
        />
        <div className="ml-auto text-[11px] text-muted-foreground font-mono tabular-nums">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-md px-3 py-8 text-center text-sm text-muted-foreground italic">
          {rows.length === 0
            ? "No goods receipts yet. Receive against a PO to generate one."
            : "No receipts match this filter."}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">GRN</th>
                <th className="text-left px-3 py-2">PO</th>
                <th className="text-left px-3 py-2">Supplier</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Received</th>
                <th className="text-right px-3 py-2">Items</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => r.po_id && navigate(`/purchase-orders/${r.po_id}`)}
                  className={cn(
                    "border-t border-border hover:bg-accent/30 transition-colors",
                    r.po_id && "cursor-pointer",
                    r.reversed_at && "opacity-50 line-through",
                  )}
                >
                  <td className="px-3 py-2 font-mono font-medium">{r.grn_number}</td>
                  <td className="px-3 py-2 font-mono">
                    {r.po_number ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">{r.supplier_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.invoice_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs inline-flex items-center gap-1">
                    <CalendarBlank className="h-3 w-3" /> {r.receipt_date}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.item_count}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono tabular-nums font-medium">{KES(r.total)}</span>
                    {r.reversed_at ? (
                      <div className="text-[9px] text-rose-600 inline-flex items-center gap-0.5 mt-0.5">
                        <Warning className="h-2.5 w-2.5" /> reversed
                      </div>
                    ) : null}
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

/** Silence unused import if some icons stay unused after minor edits. */
export const _GoodsReceiptsBadge = Badge;
