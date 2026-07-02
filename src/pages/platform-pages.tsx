import { useEffect, useState, useCallback } from "react";
import { Warning, Check, TrendUp, Money, Truck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listDataQualityIssues, runDataQualityScan,
} from "@/services/platform-extensions";
import { listCostCentres, type CostCentre } from "@/services/production";
import { listDeliveries, updateDeliveryStatus, type Delivery } from "@/services/operations";
import { runAnomalyDetection } from "@/services/platform-extensions";
import { query } from "@/lib/db";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function DataQualityPage() {
  const [issues, setIssues] = useState<Array<{ id: string; issue_kind: string; entity_kind: string; entity_id: string; details: string; severity: string; detected_at: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setIssues(await listDataQualityIssues()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const n = await runDataQualityScan();
      toast.success(`Found ${n} issue${n === 1 ? "" : "s"}`);
      load();
    } finally { setScanning(false); }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Warning className="h-5 w-5 text-primary" /> Data quality
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Duplicates, orphans, negative stock, missing customers on credit sales. Run the scan any time.
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? "Scanning…" : "Run scan"}
        </Button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="py-12 text-center">
          <Check className="h-8 w-8 mx-auto mb-3 opacity-30 text-emerald-600" />
          <div className="text-sm text-muted-foreground">
            No open issues. Books look clean.
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Issue</th>
              <th className="text-left px-3 py-2">Entity</th>
              <th className="text-left px-3 py-2">Details</th>
              <th className="text-left px-3 py-2">Severity</th>
              <th className="text-left px-3 py-2">Detected</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id} className="border-t border-border/50">
                <td className="px-3 py-2">{i.issue_kind.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 font-mono text-[11.5px]">{i.entity_kind}:{i.entity_id.slice(0, 8)}</td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground truncate max-w-[280px]">{i.details}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    i.severity === "critical" ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"
                  }`}>
                    {i.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-muted-foreground">
                  {new Date(i.detected_at + "Z").toLocaleDateString(intlLocale())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CostCentresPage() {
  const [items, setItems] = useState<CostCentre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCostCentres().then(setItems).finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => n.toLocaleString(intlLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Money className="h-5 w-5 text-primary" /> Cost centres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Projects / campaigns / branches you tag expenses + revenue to for granular P&amp;L.
        </p>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Money className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No cost centres yet. Add one to tag expenses.
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-right px-3 py-2">Budget</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-[11.5px]">{c.code}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{c.budget ? fmt(c.budget) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DeliveriesPage() {
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Delivery["status"] | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listDeliveries(filter === "all" ? undefined : filter)); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const advance = async (d: Delivery) => {
    const next: Record<Delivery["status"], Delivery["status"] | null> = {
      pending: "assigned",
      assigned: "picked_up",
      picked_up: "en_route",
      en_route: "delivered",
      delivered: null,
      failed: null,
    };
    const n = next[d.status];
    if (!n) return;
    await updateDeliveryStatus(d.id, n);
    toast.success(`${d.delivery_number} → ${n}`);
    load();
  };

  return (
    <div className="max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" /> Deliveries
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Home delivery / rider workflow. Track pickup, en-route, delivered.
        </p>
      </header>

      <div className="flex gap-1 border-b border-border">
        {(["all", "pending", "assigned", "en_route", "delivered"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f as Delivery["status"] | "all")}
            className={`px-3 py-1.5 text-[13px] border-b-2 -mb-px ${
              filter === f ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Truck className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">No deliveries.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-md border border-border p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">
                  <span className="font-mono text-[11.5px]">{d.delivery_number}</span> · {d.customer_name || "—"}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  {d.delivery_address} · Rider: {d.rider_name || "unassigned"}
                </div>
              </div>
              <span className="text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-primary/10 text-primary">
                {d.status}
              </span>
              {d.status !== "delivered" && d.status !== "failed" && (
                <Button size="sm" variant="outline" onClick={() => advance(d)}>
                  Advance
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnomaliesPage() {
  const [items, setItems] = useState<Array<{ id: string; detector: string; severity: string; message: string; observed_value: number | null; baseline_value: number | null; variance_pct: number | null; detected_at: string; status: string }>>([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const rows = await query<{ id: string; detector: string; severity: string; message: string; observed_value: number | null; baseline_value: number | null; variance_pct: number | null; detected_at: string; status: string }>(
      `SELECT id, detector, severity, message, observed_value, baseline_value, variance_pct, detected_at, status
       FROM anomaly_log WHERE status = 'open' ORDER BY detected_at DESC LIMIT 100`,
    ).catch(() => []);
    setItems(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const n = await runAnomalyDetection();
      toast.success(`Detected ${n} anomal${n === 1 ? "y" : "ies"}`);
      load();
    } finally { setRunning(false); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <TrendUp className="h-5 w-5 text-primary" /> Anomaly alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sales drops, expiry spikes, unusual variance. Run detection any time.
          </p>
        </div>
        <Button onClick={handleRun} disabled={running}>
          {running ? "Running…" : "Run detection"}
        </Button>
      </header>

      {items.length === 0 ? (
        <div className="py-12 text-center">
          <Check className="h-8 w-8 mx-auto mb-3 opacity-30 text-emerald-600" />
          <div className="text-sm text-muted-foreground">Nothing unusual detected.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">{a.message}</div>
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    Detector: {a.detector.replace(/_/g, " ")}
                    {a.variance_pct !== null && ` · ${a.variance_pct.toFixed(1)}% variance`}
                  </div>
                </div>
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  a.severity === "critical" ? "bg-red-500/10 text-red-700" : "bg-amber-500/10 text-amber-700"
                }`}>
                  {a.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
