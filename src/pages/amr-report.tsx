import { useEffect, useState } from "react";
import {
  Info,
  Microscope,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { DateRangePicker } from "@/components/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import {
  getAntibioticByClass, getTopAntibiotics, getAmrSummary,
  type AntibioticClassReport, type AntibioticTopProduct, type AmrSummary,
} from "@/services/amr-report";
import { useActiveBranch } from "@/stores/active-branch";
import { money as KES } from "@/lib/money";


import { BackButton } from "@/components/ui/back-button";
const CLASS_COLORS: Record<string, string> = {
  "Penicillins": "bg-blue-500",
  "Cephalosporins": "bg-purple-500",
  "Macrolides": "bg-pink-500",
  "Fluoroquinolones": "bg-rose-500",
  "Tetracyclines": "bg-amber-500",
  "Aminoglycosides": "bg-orange-500",
  "Sulfonamides": "bg-yellow-500",
  "Nitroimidazoles": "bg-teal-500",
  "Carbapenems": "bg-red-600",
  "Glycopeptides": "bg-indigo-500",
  "Antifungals": "bg-emerald-500",
  "Antimalarials": "bg-lime-500",
  "Anti-TB": "bg-cyan-500",
};

export function AmrReportPage() {
  const branchId = useActiveBranch((s) => s.active?.id);
  const [period, setPeriod] = useState({
    start: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [byClass, setByClass] = useState<AntibioticClassReport[]>([]);
  const [topProducts, setTopProducts] = useState<AntibioticTopProduct[]>([]);
  const [summary, setSummary] = useState<AmrSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAntibioticByClass({ ...period, branchId }),
      getTopAntibiotics({ ...period, branchId, limit: 15 }),
      getAmrSummary({ ...period, branchId }),
    ]).then(([c, t, s]) => {
      setByClass(c); setTopProducts(t); setSummary(s);
    }).finally(() => setLoading(false));
  }, [period, branchId]);

  const maxUnits = Math.max(...byClass.map((c) => c.units_dispensed), 1);

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallback="/reports" />
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Microscope className="h-5 w-5 text-purple-600" /> AMR Surveillance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Antibiotic dispensing patterns. Used by PPB to track antimicrobial resistance trends.
        </p>
      </div>

      <DateRangePicker value={period} onChange={setPeriod} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Units Dispensed" value={summary ? String(summary.total_antibiotic_units) : "—"} loading={loading} />
        <Stat label="Dispensing Events" value={summary ? String(summary.total_dispenses) : "—"} loading={loading} />
        <Stat label="Drug Classes Used" value={summary ? String(summary.unique_classes) : "—"} loading={loading} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Microscope className="h-3.5 w-3.5" /> Dispensing by Antibiotic Class
          </h2>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-6 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : byClass.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No antibiotic dispensing in this period</p>
          ) : (
            <div className="space-y-2">
              {byClass.map((c) => (
                <div key={c.class}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium">{c.class}</span>
                    <span className="font-mono text-muted-foreground">
                      {c.units_dispensed} units · {c.unique_patients} patients · {KES(c.total_revenue)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${CLASS_COLORS[c.class] || "bg-stone-400"}`}
                      style={{ width: `${(c.units_dispensed / maxUnits) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-sm mb-3">Top Dispensed Antibiotics</h2>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
                  <th className="text-left px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Class</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Units</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Patients</th>
                  <th className="text-right px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cells={5} rows={4} />
                ) : topProducts.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">No data</td></tr>
                ) : (
                  topProducts.map((p) => (
                    <tr key={p.product_name} className="border-b border-border/60">
                      <td className="px-3 py-1.5 text-xs font-medium">{p.product_name}</td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className={`inline-block h-2 w-2 rounded-full mr-1.5 align-middle ${CLASS_COLORS[p.product_class] || "bg-stone-400"}`} />
                        {p.product_class}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-mono tabular-nums">{p.units_dispensed}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-mono tabular-nums">{p.unique_patients}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-mono tabular-nums">{KES(p.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold mb-1">About AMR Surveillance</p>
            <p>
              Inappropriate or excessive antibiotic dispensing accelerates resistance. The Pharmacy and Poisons Board (PPB)
              and Ministry of Health request that pharmacies monitor dispensing patterns. Watch for:
            </p>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li>Repeat dispensing of broad-spectrum antibiotics without prescription</li>
              <li>Dispensing reserved antibiotics (carbapenems, glycopeptides) outside hospital settings</li>
              <li>Patient demand for antibiotics for viral illnesses</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Info className="h-3 w-3" />
        Classification by drug name pattern. Configure product PPB classes for precise reporting.
      </p>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {loading ? (
          <div className="h-7 bg-muted/30 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-xl font-semibold font-mono mt-1 text-purple-700">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
