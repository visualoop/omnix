import { useEffect, useMemo, useState } from "react";
import { Info, Microscope, Warning as AlertTriangle } from "@phosphor-icons/react";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { useClientPagination } from "@/hooks/use-client-pagination";
import { useFeatureEnabled } from "@/lib/features";
import { formatMoney } from "@/lib/locale";
import { getAntibioticByClass, getTopAntibiotics, getAmrSummary, type AntibioticClassReport, type AntibioticTopProduct, type AmrSummary } from "@/services/amr-report";
import { useActiveBranch } from "@/stores/active-branch";
import { useCountry } from "@/stores/country";

const CLASS_COLORS: Record<string, string> = { Penicillins: "bg-blue-500", Cephalosporins: "bg-sky-600", Macrolides: "bg-pink-500", Fluoroquinolones: "bg-rose-500", Tetracyclines: "bg-amber-500", Aminoglycosides: "bg-orange-500", Sulfonamides: "bg-yellow-500", Nitroimidazoles: "bg-teal-500", Carbapenems: "bg-red-600", Glycopeptides: "bg-indigo-500", Antifungals: "bg-emerald-500", Antimalarials: "bg-lime-600", "Anti-TB": "bg-cyan-600" };

export function AmrReportPage() {
  const branchId = useActiveBranch((state) => state.active?.id);
  const country = useCountry((state) => state.code);
  const ppbEnabled = useFeatureEnabled("ppb_register");
  const [period, setPeriod] = useState({ start: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) });
  const [byClass, setByClass] = useState<AntibioticClassReport[]>([]);
  const [topProducts, setTopProducts] = useState<AntibioticTopProduct[]>([]);
  const [summary, setSummary] = useState<AmrSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!ppbEnabled) { setLoading(false); return; }
    setLoading(true);
    Promise.all([getAntibioticByClass({ ...period, branchId }), getTopAntibiotics({ ...period, branchId, limit: 100 }), getAmrSummary({ ...period, branchId })]).then(([classes, products, reportSummary]) => { setByClass(classes); setTopProducts(products); setSummary(reportSummary); }).finally(() => setLoading(false));
  }, [period, branchId, ppbEnabled]);

  const maxUnits = Math.max(...byClass.map((item) => item.units_dispensed), 1);
  const filteredProducts = useMemo(() => topProducts.filter((product) => !search || `${product.product_name} ${product.product_class}`.toLowerCase().includes(search.toLowerCase())), [topProducts, search]);
  const productList = useClientPagination(filteredProducts, 10, search);

  if (!ppbEnabled) return <div className="space-y-4"><BackButton fallback="/pharmacy" /><OperationalContext compact /><EmptyState icon={Microscope} title="AMR surveillance is not available in this country" description="This statutory PPB report is enabled for Kenya. Dispensing and local product reporting remain available." /></div>;

  return <div className="space-y-5">
    <div><BackButton fallback="/pharmacy" /><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Microscope className="h-5 w-5 text-pink-600" /> AMR surveillance</h1><p className="mt-1 max-w-prose text-sm text-muted-foreground">Branch-level antibiotic dispensing patterns for PPB antimicrobial-resistance review.</p></div>
    <OperationalContext compact />
    <DateRangePicker value={period} onChange={setPeriod} />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Stat label="Total units dispensed" value={summary ? String(summary.total_antibiotic_units) : "—"} loading={loading} /><Stat label="Dispensing events" value={summary ? String(summary.total_dispenses) : "—"} loading={loading} /><Stat label="Drug classes used" value={summary ? String(summary.unique_classes) : "—"} loading={loading} /></div>

    <Card><CardContent className="p-4"><h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Microscope className="h-3.5 w-3.5" /> Dispensing by antibiotic class</h2>{loading ? <div className="space-y-2">{[1,2,3,4].map((item) => <div key={item} className="h-6 animate-pulse rounded bg-muted/30" />)}</div> : byClass.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">No antibiotic dispensing in this period.</p> : <div className="space-y-3">{byClass.map((item) => <div key={item.class}><div className="mb-1 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between"><span className="font-medium">{item.class}</span><span className="font-mono text-muted-foreground">{item.units_dispensed} units · {item.unique_patients} patients · {formatMoney(item.total_revenue, country)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${CLASS_COLORS[item.class] || "bg-stone-400"}`} style={{ width: `${(item.units_dispensed / maxUnits) * 100}%` }} /></div></div>)}</div>}</CardContent></Card>

    <Card><CardContent className="space-y-3 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-semibold">Top dispensed antibiotics</h2><p className="mt-1 text-xs text-muted-foreground">Search the bounded result for this branch and period.</p></div><Input aria-label="Search dispensed antibiotics" className="h-11 sm:max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product or class…" /></div>{loading ? <div className="overflow-hidden rounded-md border border-border"><table className="w-full text-sm"><tbody><TableRowSkeleton cells={5} rows={4} /></tbody></table></div> : filteredProducts.length === 0 ? <EmptyState icon={Microscope} title={search ? "No matching antibiotics" : "No dispensing data"} description={search ? "Try another product or drug class." : "Dispensed antimicrobial products appear here for the selected period."} /> : <>
      <div className="space-y-2 lg:hidden" aria-label="Antibiotic dispensing cards">{productList.pageRows.map((product) => <article key={`${product.product_name}-${product.product_class}`} className="rounded-md border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{product.product_name}</p><p className="mt-1 text-xs text-muted-foreground">{product.product_class}</p></div><span className="font-mono text-sm">{formatMoney(product.revenue, country)}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><p className="text-muted-foreground">Units</p><p className="mt-1 font-mono">{product.units_dispensed}</p></div><div><p className="text-muted-foreground">Patients</p><p className="mt-1 font-mono">{product.unique_patients}</p></div></div></article>)}</div>
      <div className="hidden overflow-hidden rounded-md border border-border lg:block"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/30"><tr><th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Product</th><th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Class</th><th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Units</th><th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Patients</th><th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Revenue</th></tr></thead><tbody>{productList.pageRows.map((product) => <tr key={`${product.product_name}-${product.product_class}`} className="border-b border-border/60 last:border-0"><td className="px-3 py-2 text-xs font-medium">{product.product_name}</td><td className="px-3 py-2 text-xs">{product.product_class}</td><td className="px-3 py-2 text-right font-mono text-xs">{product.units_dispensed}</td><td className="px-3 py-2 text-right font-mono text-xs">{product.unique_patients}</td><td className="px-3 py-2 text-right font-mono text-xs">{formatMoney(product.revenue, country)}</td></tr>)}</tbody></table></div>
      <PaginationBar list={productList.pagination} />
    </>}</CardContent></Card>

    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"><CardContent className="flex items-start gap-2 p-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div className="text-xs text-amber-900 dark:text-amber-100"><p className="mb-1 font-semibold">About AMR surveillance</p><p>Review repeat broad-spectrum dispensing, reserved antibiotics outside hospital settings, and antibiotic demand for viral illness.</p></div></CardContent></Card>
    <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Info className="h-3 w-3" /> Classification prefers configured product drug classes and falls back to product-name patterns.</p>
  </div>;
}

function Stat({ label, value, loading }: { label: string; value: string; loading?: boolean }) { return <Card><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>{loading ? <div className="mt-1 h-7 animate-pulse rounded bg-muted/30" /> : <p className="mt-1 font-mono text-xl font-semibold text-pink-700 dark:text-pink-400">{value}</p>}</CardContent></Card>; }
