import { useEffect, useState } from "react";
import { Scales, Calendar } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { getBalanceSheet, type BalanceSheet } from "@/services/gl";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getBalanceSheet(asOf)
      .then(setBs)
      .finally(() => setLoading(false));
  }, [asOf]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/reports" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Scales className="h-5 w-5 text-primary" /> Balance Sheet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Snapshot of what you own, what you owe, and what&rsquo;s left over. Assets = Liabilities + Equity.
          </p>
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="pl-8 w-[160px]" />
        </div>
      </header>

      {loading || !bs ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {/* Assets column */}
          <section className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Assets
            </h2>
            {bs.assets.length === 0 ? (
              <div className="text-[13px] text-muted-foreground py-4">No asset activity yet.</div>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {bs.assets.map((r) => (
                    <tr key={r.code}>
                      <td className="py-1">{r.name}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 pt-2 border-t border-border flex justify-between font-semibold text-[13px]">
              <span>Total assets</span>
              <span className="font-mono tabular-nums">{fmt(bs.total_assets)}</span>
            </div>
          </section>

          {/* Liabilities + Equity column */}
          <section className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Liabilities
            </h2>
            {bs.liabilities.length === 0 ? (
              <div className="text-[13px] text-muted-foreground py-2">No liabilities.</div>
            ) : (
              <table className="w-full text-[13px]">
                <tbody>
                  {bs.liabilities.map((r) => (
                    <tr key={r.code}>
                      <td className="py-1">{r.name}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{fmt(r.total_credit - r.total_debit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-2 pt-1 border-t border-border/50 flex justify-between text-[13px]">
              <span className="text-muted-foreground">Subtotal liabilities</span>
              <span className="font-mono tabular-nums">{fmt(bs.total_liabilities)}</span>
            </div>

            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">
              Equity
            </h2>
            {bs.equity.length > 0 && (
              <table className="w-full text-[13px]">
                <tbody>
                  {bs.equity.map((r) => (
                    <tr key={r.code}>
                      <td className="py-1">{r.name}</td>
                      <td className="py-1 text-right font-mono tabular-nums">{fmt(r.total_credit - r.total_debit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <table className="w-full text-[13px]">
              <tbody>
                <tr>
                  <td className="py-1">Current year earnings</td>
                  <td className="py-1 text-right font-mono tabular-nums">{fmt(bs.current_year_earnings)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 pt-1 border-t border-border/50 flex justify-between text-[13px]">
              <span className="text-muted-foreground">Subtotal equity</span>
              <span className="font-mono tabular-nums">{fmt(bs.total_equity)}</span>
            </div>

            <div className="mt-3 pt-2 border-t border-border flex justify-between font-semibold text-[13px]">
              <span>Total liabilities + equity</span>
              <span className="font-mono tabular-nums">{fmt(bs.total_liabilities + bs.total_equity)}</span>
            </div>
          </section>
        </div>
      )}

      {bs && (
        <div className={`rounded-md px-3 py-2 text-[13px] ${bs.balanced ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}>
          {bs.balanced
            ? `✓ Balance sheet is balanced as of ${new Date(bs.as_of).toLocaleDateString(intlLocale())}.`
            : `✗ Balance sheet is out of balance by ${fmt(Math.abs(bs.total_assets - (bs.total_liabilities + bs.total_equity)))}. This usually means a journal entry was posted incorrectly.`}
        </div>
      )}
    </div>
  );
}
