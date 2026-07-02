import { useEffect, useState, useCallback } from "react";
import { CurrencyDollar, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CurrencyDollar className="h-5 w-5 text-primary" /> Currencies &amp; FX rates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Base currency is KES. Add rates for other currencies to price invoices in USD, EUR, UGX, etc.
        </p>
      </header>

      <section className="rounded-lg border border-border p-3 space-y-2">
        <div className="text-[12px] font-semibold uppercase tracking-wider mb-1">Add a rate</div>
        <div className="flex items-center gap-2">
          <Select value={fromCode} onValueChange={(v) => setFromCode(String(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">→</span>
          <Select value={toCode} onValueChange={(v) => setToCode(String(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Rate" value={rate} onChange={(e) => setRateInput(e.target.value)} type="number" step="0.0001" className="w-32" />
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-[160px]" />
          <Button onClick={handleAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Save rate</Button>
        </div>
      </section>

      <section>
        <div className="text-[12px] font-semibold uppercase tracking-wider mb-2">
          {loading ? "Loading…" : `${rates.length} rate${rates.length === 1 ? "" : "s"} on file`}
        </div>
        {rates.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No rates yet. Add one above.</div>
        ) : (
          <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
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
                  <td className="px-3 py-2 text-[11.5px] uppercase tracking-wider">{r.source ?? "manual"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
