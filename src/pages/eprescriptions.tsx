import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { useNavigate } from "react-router-dom";
import {
  ArrowsClockwise as Sync,
  CheckCircle,
  DownloadSimple,
  FileText,
  Prescription as PrescriptionIcon,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { useListData } from "@/hooks/use-list-data";
import { useFeatureEnabled } from "@/lib/features";
import { pageEprescriptions } from "@/services/paged";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  getEprescriptionItems,
  countPendingEprescriptions,
  pullEprescriptions,
  importEprescription,
  rejectEprescription,
  type DhaEprescription,
  type DhaEprescriptionItem,
} from "@/services/dha-eprescriptions";
import { getProviders } from "@/services/insurance";
import { useAuthStore } from "@/stores/auth";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

export function EprescriptionsPage() {
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<DhaEprescription | null>(null);
  const [detailItems, setDetailItems] = useState<DhaEprescriptionItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const shaEnabled = useFeatureEnabled("sha");
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const list = useListData(pageEprescriptions, { pageSize: 20 });

  const refreshPending = () => { countPendingEprescriptions().then(setPending).catch(() => {}); };
  useEffect(() => { refreshPending(); }, [list.total]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!detail) { setDetailItems([]); return; }
    getEprescriptionItems(detail.id).then(setDetailItems);
  }, [detail]);

  const refreshAll = () => { list.refresh(); refreshPending(); };
  const sync = async () => {
    if (!online) {
      toast.error("Internet is offline. Local prescriptions remain available; sync when connected.");
      return;
    }
    setSyncing(true);
    try {
      const providers = await getProviders(true);
      const sha = providers.find((provider) => provider.type === "sha");
      if (!sha) {
        toast.error("No SHA provider configured. Set one up in Insurance settings.");
        return;
      }
      const result = await pullEprescriptions(sha.id);
      if (result.ok) {
        toast.success(`Synced ${result.imported} e-prescription${result.imported === 1 ? "" : "s"}`);
        refreshAll();
      } else toast.error(result.error || "Sync failed");
    } finally { setSyncing(false); }
  };

  const doImport = async () => {
    if (!detail || !userId) return;
    setImporting(true);
    try {
      const rxId = await importEprescription(detail.id, userId);
      toast.success("Imported to prescriptions");
      setDetail(null);
      refreshAll();
      navigate(`/pharmacy/prescriptions/${rxId}`);
    } catch (error) {
      toast.error(String(error));
    } finally { setImporting(false); }
  };

  if (!shaEnabled) {
    return (
      <div className="space-y-4">
        <BackButton fallback="/pharmacy" />
        <OperationalContext compact />
        <EmptyState
          icon={PrescriptionIcon}
          title="E-prescriptions are not available in this country"
          description="This AfyaLink and SHA workflow is enabled only for Kenya. Local prescription entry remains available from Dispense."
          cta={{ label: "Open dispense", onClick: () => navigate("/pharmacy?tab=dispense"), icon: PrescriptionIcon }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <PrescriptionIcon className="h-5 w-5 text-teal-600" /> DHA e-Prescriptions
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Review AfyaLink e-scripts and import them into the regulated dispensing queue.
          </p>
        </div>
        <Button className="min-h-11 sm:self-start" onClick={sync} disabled={syncing || !online}>
          <Sync className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : online ? "Sync from AfyaLink" : "Sync when online"}
        </Button>
      </div>
      <OperationalContext compact />

      {pending > 0 && (
        <Card className="border-teal-500/40 bg-teal-500/5">
          <CardContent className="p-3 text-sm">
            <span className="font-semibold text-teal-700">{pending} pending e-prescription{pending === 1 ? "" : "s"}</span>{" "}awaiting review.
          </CardContent>
        </Card>
      )}

      <Input
        aria-label="Search e-prescriptions"
        value={list.search}
        onChange={(event) => list.setSearch(event.target.value)}
        placeholder="Search patient, prescriber, DHA ref…"
        className="h-11 max-w-sm"
      />

      {list.loading ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm"><tbody><TableRowSkeleton cells={6} rows={4} /></tbody></table>
        </div>
      ) : list.rows.length === 0 ? (
        <EmptyState
          icon={PrescriptionIcon}
          title={list.search ? "No matching e-prescriptions" : "No e-prescriptions yet"}
          description={list.search ? "Try a different patient, prescriber, or DHA reference." : "Sync from AfyaLink to pull e-scripts issued to this facility."}
          cta={list.search ? undefined : { label: online ? "Sync from AfyaLink" : "Sync unavailable offline", onClick: sync, icon: Sync }}
        />
      ) : (
        <>
          <div className="space-y-2 lg:hidden" aria-label="E-prescription cards">
            {list.rows.map((record) => (
              <button key={record.id} type="button" onClick={() => setDetail(record)} className="min-h-11 w-full rounded-md border border-border p-4 text-left active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-medium">{record.patient_name}</p><p className="mt-1 text-xs text-muted-foreground">{record.prescriber_name || "Prescriber not supplied"}</p></div>
                  <StatusBadge status={record.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>{new Date(record.issued_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <span className="font-mono">{record.dha_id}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-lg border border-border lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30"><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left font-medium">Patient</th><th className="px-3 py-2 text-left font-medium">Prescriber</th><th className="px-3 py-2 text-left font-medium">Issued</th><th className="px-3 py-2 text-left font-medium">DHA ref</th><th className="px-3 py-2 text-center font-medium">Status</th><th className="px-3 py-2" /></tr></thead>
              <tbody>{list.rows.map((record) => <tr key={record.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30" onClick={() => setDetail(record)}><td className="px-3 py-2.5"><div className="font-medium">{record.patient_name}</div>{record.patient_phone && <div className="text-xs text-muted-foreground">{record.patient_phone}</div>}</td><td className="px-3 py-2.5 text-muted-foreground">{record.prescriber_name || "—"}</td><td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(record.issued_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{record.dha_id}</td><td className="px-3 py-2.5 text-center"><StatusBadge status={record.status} /></td><td className="px-3 py-2.5 text-right"><FileText className="inline h-3.5 w-3.5 text-muted-foreground" /></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      <PaginationBar list={list} />

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
          <SheetHeader><SheetTitle>E-prescription detail</SheetTitle></SheetHeader>
          {detail && <div className="mt-4 space-y-4">
            <div className="space-y-1 rounded-lg border border-border p-3 text-sm"><div className="font-medium">{detail.patient_name}</div><div className="text-xs text-muted-foreground">{detail.patient_id_number && <>ID {detail.patient_id_number} · </>}{detail.patient_phone || "no phone"}</div><div className="mt-1 text-xs text-muted-foreground">Prescriber: {detail.prescriber_name || "—"}{detail.prescriber_license && <> ({detail.prescriber_license})</>}</div>{detail.diagnosis_text && <div className="text-xs text-muted-foreground">Dx: {detail.diagnosis_text}</div>}</div>
            <div className="overflow-hidden rounded-lg border border-border"><div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Items ({detailItems.length})</div><ul className="divide-y divide-border">{detailItems.map((item) => <li key={item.id} className="px-3 py-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium">{item.drug_name} {item.strength}</span>{item.matched_product_id ? <Badge className="bg-emerald-600 text-[9px] hover:bg-emerald-600">Matched</Badge> : <Badge variant="destructive" className="text-[9px]">No match</Badge>}</div><div className="mt-1 text-muted-foreground">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(" · ")} · Qty {item.quantity}</div></li>)}</ul></div>
            {detail.status === "pending" && <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={doImport} disabled={importing} className="min-h-11 flex-1"><DownloadSimple className="mr-1.5 h-3.5 w-3.5" />{importing ? "Importing…" : "Import to prescriptions"}</Button><Button variant="outline" className="min-h-11 text-destructive" aria-label="Reject e-prescription" onClick={async () => { if (!(await confirm({ title: "Reject this e-prescription?" }))) return; await rejectEprescription(detail.id, "Rejected by pharmacist"); toast.success("Rejected"); setDetail(null); refreshAll(); }}><X className="h-3.5 w-3.5" /> Reject</Button></div>}
            {detail.status === "imported" && detail.imported_prescription_id && <Button variant="outline" className="min-h-11 w-full" onClick={() => navigate(`/pharmacy/prescriptions/${detail.imported_prescription_id}`)}><CheckCircle className="mr-1.5 h-3.5 w-3.5" /> View imported prescription</Button>}
          </div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadge({ status }: { status: DhaEprescription["status"] }) {
  if (status === "imported") return <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">Imported</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="text-[10px]">Rejected</Badge>;
  if (status === "expired") return <Badge variant="secondary" className="text-[10px]">Expired</Badge>;
  return <Badge variant="outline" className="border-teal-500 text-[10px] text-teal-700">Pending</Badge>;
}
