import { useEffect, useState, useCallback } from "react";
import { Bank, Link as LinkIcon, X } from "@phosphor-icons/react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  listStatementLines,
  listCandidateTxns,
  matchLine,
  unmatchLine,
  summarise,
  type StatementLine,
  type BookTxn,
  type ReconciliationSummary,
} from "@/services/bank-reconciliation";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function BankReconciliationPage() {
  const { id: bankAccountId } = useParams<{ id: string }>();
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [txns, setTxns] = useState<BookTxn[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bankAccountId) return;
    const [ls, ts, s] = await Promise.all([
      listStatementLines(bankAccountId),
      listCandidateTxns(bankAccountId),
      summarise(bankAccountId),
    ]);
    setLines(ls);
    setTxns(ts);
    setSummary(s);
  }, [bankAccountId]);

  useEffect(() => { load(); }, [load]);

  const handleMatch = async (lineId: string, txnId: string) => {
    await matchLine(lineId, txnId);
    setSelectedLine(null);
    toast.success("Matched");
    load();
  };
  const handleUnmatch = async (lineId: string) => {
    await unmatchLine(lineId);
    toast.success("Un-matched");
    load();
  };

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-6xl space-y-4">
      <header>
        <BackButton fallback="/banking" />
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bank className="h-5 w-5 text-primary" /> Bank reconciliation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Match imported statement lines against our own book transactions. Click a statement line, then a book transaction to match.
        </p>
      </header>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Statement total", value: fmt(summary.statement_total) },
            { label: "Book total", value: fmt(summary.book_total) },
            { label: "Matched", value: summary.matched_count.toString() },
            { label: "Variance", value: fmt(summary.variance), critical: Math.abs(summary.variance) > 0.01 },
          ].map((s) => (
            <div key={s.label} className={`rounded-md border p-3 ${s.critical ? "border-red-500/40 bg-red-500/5" : "border-border"}`}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`text-lg font-mono tabular-nums mt-0.5 ${s.critical ? "text-red-700" : ""}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border text-[12px] font-semibold uppercase tracking-wider">
            Statement lines
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {lines.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">
                No statement imported yet.
              </div>
            ) : (
              lines.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLine(l.id === selectedLine ? null : l.id)}
                  className={`w-full text-left px-3 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent ${selectedLine === l.id ? "bg-primary/10" : ""} ${l.is_matched ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between items-start text-[13px]">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{l.line_description}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {new Date(l.line_date).toLocaleDateString(intlLocale())}
                        {l.line_reference && <> · {l.line_reference}</>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className={`font-mono tabular-nums ${l.credit > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {l.credit > 0 ? "+" : "−"}{fmt(l.credit || l.debit)}
                      </div>
                      {l.is_matched && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnmatch(l.id); }}
                          className="text-[10.5px] text-muted-foreground hover:text-red-600"
                        >
                          <X className="h-3 w-3 inline" /> unmatch
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border text-[12px] font-semibold uppercase tracking-wider">
            Book transactions {selectedLine && "· click one to match"}
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {txns.map((t) => (
              <button
                key={t.id}
                onClick={() => selectedLine && handleMatch(selectedLine, t.id)}
                disabled={!selectedLine || t.matched === 1}
                className={`w-full text-left px-3 py-2 border-b border-border/50 last:border-b-0 hover:bg-accent ${t.matched === 1 ? "opacity-50" : ""} ${!selectedLine ? "cursor-default" : ""}`}
              >
                <div className="flex justify-between items-start text-[13px]">
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{t.description || t.transaction_type}</div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {new Date(t.txn_date).toLocaleDateString(intlLocale())} · {t.transaction_type}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-mono tabular-nums">{fmt(t.amount)}</div>
                    {t.matched === 1 && (
                      <div className="text-[10.5px] text-emerald-600 flex items-center gap-0.5">
                        <LinkIcon className="h-3 w-3" /> matched
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
