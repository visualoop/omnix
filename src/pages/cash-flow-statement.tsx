import { useEffect, useState } from "react";
import { CurrencyCircleDollar as Cash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { getCashFlow, type CashFlowStatement, type CashFlowSection } from "@/services/cash-flow-statement";
import { intlLocale } from "@/lib/intl";

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function CashFlowStatementPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [cf, setCf] = useState<CashFlowStatement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCashFlow(from, to).then(setCf).finally(() => setLoading(false));
  }, [from, to]);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Cash className="h-5 w-5 text-primary" /> Cash Flow Statement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where cash came from and where it went. Split into Operating, Investing, and Financing activities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
        </div>
      </header>

      {loading || !cf ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 bg-muted/40 flex justify-between text-[13px] font-semibold">
            <span>Opening cash</span>
            <span className="font-mono tabular-nums">{fmt(cf.opening_cash)}</span>
          </div>

          <Section section={cf.operating} fmt={fmt} />
          <Section section={cf.investing} fmt={fmt} />
          <Section section={cf.financing} fmt={fmt} />

          <div className="px-3 py-2.5 bg-primary/5 border-t-2 border-primary/40 flex justify-between text-[13px] font-semibold">
            <span>Net change in cash</span>
            <span className="font-mono tabular-nums">{fmt(cf.net_change)}</span>
          </div>
          <div className="px-3 py-2.5 bg-muted/40 border-t border-border flex justify-between text-[13px] font-semibold">
            <span>Closing cash</span>
            <span className="font-mono tabular-nums">{fmt(cf.closing_cash)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ section, fmt }: { section: CashFlowSection; fmt: (n: number) => string }) {
  return (
    <div>
      <div className="px-3 py-1.5 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-t border-border">
        {section.label}
      </div>
      {section.lines.length === 0 ? (
        <div className="px-3 py-1.5 text-[13px] text-muted-foreground italic">— No activity —</div>
      ) : (
        section.lines.map((l) => (
          <div key={l.description} className="px-3 py-1 flex justify-between text-[13px] border-b border-border/30 last:border-b-0">
            <span>{l.description}</span>
            <span className="font-mono tabular-nums">{fmt(l.amount)}</span>
          </div>
        ))
      )}
      <div className="px-3 py-1.5 flex justify-between text-[13px] font-medium border-t border-border/50 bg-muted/10">
        <span>Total {section.label.toLowerCase()}</span>
        <span className="font-mono tabular-nums">{fmt(section.total)}</span>
      </div>
    </div>
  );
}
