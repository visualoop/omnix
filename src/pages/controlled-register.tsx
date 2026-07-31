import { useEffect, useState, useRef, useMemo } from "react";
import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Download,
  MagnifyingGlass as Search,
  Printer as Printer,
  ShieldWarning as ShieldAlert,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { query } from "@/lib/db";
import { renderControlledRegisterPdf } from "@/services/reports-pdf";
import { loadBrandHeader, downloadBytes } from "@/services/pdf-brand";
import { intlLocale } from "@/lib/intl";
import { listControlledDisposals, type ControlledDisposal } from "@/services/controlled-disposal";
import { useFeatureEnabled } from "@/lib/features";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/lib/permissions";
import { OperationalContext } from "@/components/shared/operational-context";
import { Badge } from "@/components/ui/badge";

import { BackButton } from "@/components/ui/back-button";
interface ControlledEntry {
  id: string;
  product_id: string;
  product_name: string;
  action: string;
  quantity: number;
  patient_name: string | null;
  patient_id_number: string | null;
  prescribed_by: string | null;
  prescription_number: string | null;
  balance_after: number;
  notes: string | null;
  pharmacist_id: string | null;
  pharmacist_name: string | null;
  pharmacist_license: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
}

export function ControlledRegisterPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<ControlledEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [disposals, setDisposals] = useState<ControlledDisposal[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const showPpbRegister = useFeatureEnabled("ppb_register");
  const user = useAuthStore((s) => s.user);
  const canViewControlled = hasPermission(user, "pharmacy.controlled");
  const printRef = useRef<HTMLDivElement>(null);
  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => [entry.product_name, entry.patient_name, entry.prescribed_by, entry.prescription_number, entry.pharmacist_name]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [entries, search]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const visibleEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, date]);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await query<ControlledEntry>(
        `SELECT cl.*,
           u.full_name AS user_name,
           p.full_name AS pharmacist_name,
           p.pharmacist_license_number AS pharmacist_license
         FROM controlled_log cl
         LEFT JOIN users u ON u.id = cl.user_id
         LEFT JOIN employees p ON p.id = cl.pharmacist_id
         WHERE date(cl.created_at) = ?1
         ORDER BY cl.created_at`,
        [date],
      );
      setEntries(rows);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (showPpbRegister && canViewControlled) load(); }, [date, showPpbRegister, canViewControlled]);
  useEffect(() => {
    if (!showPpbRegister || !canViewControlled) return;
    listControlledDisposals(50).then(setDisposals).catch(() => setDisposals([]));
  }, [showPpbRegister, canViewControlled]);

  const totalDispensed = entries
    .filter((e) => e.action === "dispense")
    .reduce((s, e) => s + e.quantity, 0);
  const totalReceived = entries
    .filter((e) => e.action === "receive")
    .reduce((s, e) => s + e.quantity, 0);

  if (!showPpbRegister) {
    return (
      <div className="rounded-md border border-border p-6">
        <BackButton fallback="/pharmacy" />
        <h1 className="mt-3 text-lg font-semibold">Controlled register unavailable</h1>
        <p className="mt-1 text-sm text-muted-foreground">This country uses a different medicines-control framework. Regulated register records are not available here.</p>
      </div>
    );
  }

  if (!canViewControlled) {
    return (
      <div className="rounded-md border border-border p-6">
        <BackButton fallback="/pharmacy" />
        <h1 className="mt-3 text-lg font-semibold">Controlled register restricted</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your role does not have permission to view regulated medicine records.</p>
      </div>
    );
  }

  const exportPdf = async () => {
    const brand = await loadBrandHeader();
    const bytes = renderControlledRegisterPdf({
      brand,
      date,
      rows: entries.map((e) => ({
        drugName: e.product_name,
        batchNumber: null,
        stockBefore: e.action === "dispense" ? e.balance_after + e.quantity : e.balance_after - e.quantity,
        dispensed: e.action === "dispense" ? e.quantity : 0,
        received: e.action === "receive" ? e.quantity : 0,
        stockAfter: e.balance_after,
        prescriber: e.prescribed_by ?? null,
        patient: e.patient_name ?? null,
      })),
    });
    downloadBytes(bytes, `controlled-register-${date}`);
  };

  const exportCsv = () => {
    // PPB e-Portal quarterly submission format — columns match the
    // Pharmacy and Poisons Board CSV template. Aggregation per drug is
    // done at the page level (one row per drug per day); a downstream
    // consolidation script per quarter is out of scope here.
    const headers = [
      "date",
      "drug_name",
      "action",
      "quantity",
      "stock_before",
      "stock_after",
      "patient_name",
      "patient_id_number",
      "prescriber",
      "prescription_number",
      "pharmacist_name",
      "pharmacist_license",
      "recorded_at",
    ];
    const rows = entries.map((e) => [
      date,
      quoteCsv(e.product_name),
      e.action,
      String(e.quantity),
      String(e.action === "dispense" ? e.balance_after + e.quantity : e.balance_after - e.quantity),
      String(e.balance_after),
      quoteCsv(e.patient_name ?? ""),
      quoteCsv(e.patient_id_number ?? ""),
      quoteCsv(e.prescribed_by ?? ""),
      quoteCsv(e.prescription_number ?? ""),
      quoteCsv(e.pharmacist_name ?? ""),
      quoteCsv(e.pharmacist_license ?? ""),
      e.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ppb-controlled-register-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" ref={printRef}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" /> Controlled Substances Register
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Statutory daily log per Pharmacy and Poisons Act (Cap 244). Print or export end of day for the dispensary file.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-11 lg:[&_button]:min-h-0">
          <div className="flex items-center gap-1 border border-border rounded-md">
            <Button variant="ghost" size="icon-xs" onClick={() => setDate(addDays(date, -1))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-36 border-0 bg-transparent lg:h-7 lg:w-32" />
            <Button variant="ghost" size="icon-xs" onClick={() => setDate(addDays(date, 1))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="outline" onClick={exportPdf}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
          </Button>
          <Button variant="outline" onClick={exportCsv} title="PPB e-Portal quarterly CSV">
            <Download className="h-3.5 w-3.5 mr-1.5" /> PPB CSV
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      <OperationalContext compact />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <Stat label="Entries" value={String(entries.length)} />
        <Stat label="Dispensed (units)" value={String(totalDispensed)} color="text-red-600" />
        <Stat label="Received (units)" value={String(totalReceived)} color="text-emerald-600" />
      </div>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground lg:top-2.5" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search drug, patient, prescriber, or pharmacist…" className="h-11 pl-9 lg:h-9" />
      </div>

      <div className="space-y-2 lg:hidden" aria-label="Controlled register records">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading register…</div>
        ) : visibleEntries.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No matching entries" description="Dispensing of controlled medicines appears here as it happens." />
        ) : visibleEntries.map((entry) => (
          <article key={entry.id} className="rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{entry.product_name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" })} · balance {entry.balance_after}</p>
              </div>
              <Badge variant={entry.action === "dispense" ? "destructive" : "secondary"} className="capitalize">{entry.action} {entry.quantity}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
              <div><dt className="text-muted-foreground">Patient</dt><dd className="mt-1">{entry.patient_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Prescriber</dt><dd className="mt-1">{entry.prescribed_by || "—"}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">Pharmacist</dt><dd className="mt-1">{entry.pharmacist_name || "—"}{entry.pharmacist_license ? ` · ${entry.pharmacist_license}` : ""}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden border border-border rounded-md overflow-hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Drug</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
              <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Prescriber</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Pharmacist</th>
              <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">License</th>
              <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={9} rows={4} />
            ) : visibleEntries.length === 0 ? (
              <tr><td colSpan={9} className="p-0">
                <EmptyState
                  icon={ShieldAlert}
                  title="No entries on this date"
                  description="Dispensing of controlled drugs will appear here as it happens."
                />
              </td></tr>
            ) : (
              visibleEntries.map((e) => (
                <tr key={e.id} className="border-b border-border/60">
                  <td className="px-2 py-1.5 text-xs font-mono">
                    {new Date(e.created_at).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-1.5 text-xs font-medium">{e.product_name}</td>
                  <td className="px-2 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      e.action === "dispense" ? "bg-red-100 text-red-700" :
                      e.action === "receive" ? "bg-emerald-100 text-emerald-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-mono tabular-nums">{e.quantity}</td>
                  <td className="px-2 py-1.5 text-xs">
                    {e.patient_name || "—"}
                    {e.patient_id_number && (
                      <div className="text-[10px] text-muted-foreground font-mono">{e.patient_id_number}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{e.prescribed_by || "—"}</td>
                  <td className="px-2 py-1.5 text-xs">{e.pharmacist_name || "—"}</td>
                  <td className="px-2 py-1.5 text-xs font-mono text-muted-foreground">{e.pharmacist_license || "—"}</td>
                  <td className="px-2 py-1.5 text-right text-xs font-mono tabular-nums">{e.balance_after}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredEntries.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredEntries.length)} of {filteredEntries.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-11 lg:h-8">Previous</Button>
            <span className="font-mono">{page} / {pageCount}</span>
            <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="h-11 lg:h-8">Next</Button>
          </div>
        </div>
      )}

      {disposals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-600" /> Witnessed destruction records
            </h2>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Drug</th>
                    <th className="text-right px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                    <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                    <th className="text-left px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Witnesses</th>
                    <th className="text-center px-2 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">PPB</th>
                  </tr>
                </thead>
                <tbody>
                  {disposals.map((d) => (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(d.disposed_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-medium">{d.product_name}{d.batch_number ? <span className="text-muted-foreground font-mono"> · {d.batch_number}</span> : null}</td>
                      <td className="px-2 py-1.5 text-right text-xs font-mono tabular-nums">{d.quantity}</td>
                      <td className="px-2 py-1.5 text-xs">{d.method}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{d.witness_1_name} + {d.witness_2_name}</td>
                      <td className="px-2 py-1.5 text-center">
                        {d.ppb_notified ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700" title={d.ppb_notification_ref ?? undefined}>Notified</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-xs leading-relaxed">
          <p className="font-semibold mb-1">Statutory requirements</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Each dispensing of a controlled substance must record patient ID, prescriber, pharmacist, and running balance.</li>
            <li>The register must be available for inspection by Pharmacy and Poisons Board (PPB) at any time.</li>
            <li>Daily totals must be signed by the pharmacist on duty.</li>
            <li>Discrepancies must be reported within 24 hours.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold font-mono mt-1 ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Minimal RFC-4180 quoter for CSV cells (double-quotes wrap, embedded
 *  quotes are doubled). Used by the PPB e-Portal export. */
function quoteCsv(s: string): string {
  if (s === "" || s === null || s === undefined) return "";
  const needs = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}
