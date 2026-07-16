import { useEffect, useState } from "react";
import { Calculator, Calendar } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { getTrialBalance, type TrialBalanceRow, type AccountType } from "@/services/gl";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];
const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};

export function TrialBalancePage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTrialBalance(asOf)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [asOf]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/analytics" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Trial Balance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every account&rsquo;s total debits + credits + running balance. If the two totals at the bottom
            match, every journal entry posted is balanced.
          </p>
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="pl-8 w-[160px]" />
        </div>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <Calculator className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No posted journal entries yet as of {new Date(asOf).toLocaleDateString(intlLocale())}.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {grouped.map((g) => (
            <div key={g.type}>
              <div className="bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {TYPE_LABEL[g.type]}
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-1.5 w-16">Code</th>
                    <th className="text-left px-3 py-1.5">Account</th>
                    <th className="text-right px-3 py-1.5 w-32">Debit</th>
                    <th className="text-right px-3 py-1.5 w-32">Credit</th>
                    <th className="text-right px-3 py-1.5 w-32">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.code} className="border-b border-border/50 last:border-b-0">
                      <td className="px-3 py-1.5 font-mono text-[12px]">{r.code}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {r.total_debit > 0 ? fmt(r.total_debit) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {r.total_credit > 0 ? fmt(r.total_credit) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums font-medium">
                        {fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className={`flex items-center justify-between px-3 py-2 border-t-2 ${balanced ? "border-primary/40 bg-primary/5" : "border-red-500/40 bg-red-500/5"}`}>
            <div className="text-[13px] font-semibold">
              {balanced ? "✓ Books balance" : "✗ Books DO NOT balance — check journal entries"}
            </div>
            <div className="flex gap-8 font-mono text-[13px]">
              <span>Debit: <span className="font-semibold">{fmt(totalDebit)}</span></span>
              <span>Credit: <span className="font-semibold">{fmt(totalCredit)}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
