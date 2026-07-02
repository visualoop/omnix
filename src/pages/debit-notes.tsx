import { useEffect, useState, useCallback } from "react";
import { Receipt, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { listDebitNotes, type DebitNote } from "@/services/debit-notes";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function DebitNotesPage() {
  const [items, setItems] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listDebitNotes()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/suppliers" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Debit notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reduce what you owe suppliers — over-invoicing, defective goods, price adjustments, returns.
          </p>
        </div>
        <Button disabled title="Coming next: New debit note dialog">
          <Plus className="h-4 w-4 mr-1.5" /> New
        </Button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Receipt className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No debit notes yet. Issue one against a purchase order when a supplier over-invoices you.
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Number</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-[12px]">{n.note_number}</td>
                <td className="px-3 py-2">{new Date(n.issue_date).toLocaleDateString(intlLocale())}</td>
                <td className="px-3 py-2">{n.reason.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(n.total_amount)}</td>
                <td className="px-3 py-2 text-[11.5px] uppercase tracking-wider">{n.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
