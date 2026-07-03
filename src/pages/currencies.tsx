import { useEffect, useState, useCallback } from "react";
import { CurrencyDollar, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listCurrencies, listRates, setRate,
  type Currency, type ExchangeRate,
} from "@/services/currencies";
import { intlLocale } from "@/lib/intl";

export function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("KES");
  const [rate, setRateInput] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([listCurrencies(false), listRates()]);
      setCurrencies(c);
      setRates(r);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const r = Number(rate);
    if (!r || r <= 0) { toast.error("Enter a valid rate"); return; }
    try {
      await setRate(fromCode, toCode, r, asOfDate, "manual");
      toast.success(`Saved ${fromCode} → ${toCode} = ${r} for ${asOfDate}`);
      setRateInput("");
      load();
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Currencies & FX rates"
        description="Base currency is KES. Add rates for other currencies so you can price invoices in USD, EUR, UGX, etc. Reports convert everything back to KES at the rate captured on the transaction date."
        back={{ fallback: "/settings" }}
        actions={<RefreshFxButton onRefreshed={load} />}
      />

      {/* Add rate — its own dedicated section, not fighting with the title */}
      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
          <CurrencyDollar className="h-3.5 w-3.5" /> Add a rate
        </div>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">From</label>
              <Select value={fromCode} onValueChange={(v) => setFromCode(String(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">To</label>
              <Select value={toCode} onValueChange={(v) => setToCode(String(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rate</label>
              <Input
                placeholder="1.00"
                value={rate}
                onChange={(e) => setRateInput(e.target.value)}
                type="number"
                step="0.0001"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">As of</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[12px] text-muted-foreground">
              Type <span className="font-mono">1 {fromCode} = X {toCode}</span> — Omnix stores this as the direct rate and derives inverses automatically.
            </p>
            <Button onClick={handleAdd} disabled={!rate}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Save rate
            </Button>
          </div>
        </div>
      </section>

      {/* Existing rates */}
      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          {loading ? "Loading…" : `${rates.length} rate${rates.length === 1 ? "" : "s"} on file`}
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <CurrencyDollar className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <div className="text-sm text-muted-foreground">
              No rates yet. Add one above to enable multi-currency pricing.
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2">From</th>
                  <th className="text-left px-3 py-2">To</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-left px-3 py-2">As of</th>
                  <th className="text-left px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="px-3 py-2 font-mono">{r.from_code}</td>
                    <td className="px-3 py-2 font-mono">{r.to_code}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.rate}</td>
                    <td className="px-3 py-2">{new Date(r.as_of_date).toLocaleDateString(intlLocale())}</td>
                    <td className="px-3 py-2 text-[11.5px] uppercase tracking-wider text-muted-foreground">
                      {r.source ?? "manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


function RefreshFxButton({ onRefreshed }: { onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        setStatus("");
        try {
          const { refreshFxRates } = await import("@/services/fx-refresh");
          const n = await refreshFxRates({ force: true });
          setStatus(n > 0 ? `Updated ${n / 2} currencies` : "No changes");
          onRefreshed();
        } catch {
          setStatus("Refresh failed");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-accent disabled:opacity-50"
      title="Fetch latest FX rates from open.er-api.com"
    >
      {busy ? "Refreshing…" : status || "Refresh rates"}
    </button>
  );
}
