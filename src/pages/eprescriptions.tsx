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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { BackButton } from "@/components/ui/back-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  listEprescriptions,
  getEprescriptionItems,
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
  const [rows, setRows] = useState<DhaEprescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [detail, setDetail] = useState<DhaEprescription | null>(null);
  const [detailItems, setDetailItems] = useState<DhaEprescriptionItem[]>([]);
  const [importing, setImporting] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listEprescriptions());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!detail) { setDetailItems([]); return; }
    getEprescriptionItems(detail.id).then(setDetailItems);
  }, [detail]);

  const sync = async () => {
    setSyncing(true);
    try {
      // Find the SHA provider (AfyaLink is the SHA HIE gateway).
      const providers = await getProviders(true);
      const sha = providers.find((p) => p.type === "sha");
      if (!sha) {
        toast.error("No SHA provider configured. Set one up in Insurance settings.");
        return;
      }
      const result = await pullEprescriptions(sha.id);
      if (result.ok) {
        toast.success(`Synced ${result.imported} e-prescription${result.imported === 1 ? "" : "s"}`);
        load();
      } else {
        toast.error(result.error || "Sync failed");
      }
    } finally { setSyncing(false); }
  };

  const doImport = async () => {
    if (!detail || !userId) return;
    setImporting(true);
    try {
      const rxId = await importEprescription(detail.id, userId);
      toast.success("Imported to prescriptions");
      setDetail(null);
      load();
      navigate(`/pharmacy/prescriptions/${rxId}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setImporting(false);
    }
  };

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <PrescriptionIcon className="h-5 w-5 text-teal-600" /> DHA e-Prescriptions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            E-scripts issued via the AfyaLink Health Information Exchange. Review and import into the dispensing queue.
          </p>
        </div>
        <Button onClick={sync} disabled={syncing}>
          <Sync className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from AfyaLink"}
        </Button>
      </div>

      {pending > 0 && (
        <Card className="border-teal-500/40 bg-teal-500/5">
          <CardContent className="p-3 text-sm">
            <span className="font-semibold text-teal-700">{pending} pending e-prescription{pending === 1 ? "" : "s"}</span>
            {" "}awaiting review.
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm"><tbody><TableRowSkeleton cells={6} rows={4} /></tbody></table>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={PrescriptionIcon}
          title="No e-prescriptions yet"
          description="Sync from AfyaLink to pull e-scripts issued to this pharmacy's facility code."
          cta={{ label: "Sync from AfyaLink", onClick: sync, icon: Sync }}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Patient</th>
                <th className="text-left px-3 py-2 font-medium">Prescriber</th>
                <th className="text-left px-3 py-2 font-medium">Issued</th>
                <th className="text-left px-3 py-2 font-medium">DHA ref</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setDetail(r)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.patient_name}</div>
                    {r.patient_phone && <div className="text-xs text-muted-foreground">{r.patient_phone}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.prescriber_name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.issued_at).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.dha_id}</td>
                  <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2.5 text-right">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>E-prescription detail</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="border border-border rounded-lg p-3 space-y-1 text-sm">
                <div className="font-medium">{detail.patient_name}</div>
                <div className="text-xs text-muted-foreground">
                  {detail.patient_id_number && <>ID {detail.patient_id_number} · </>}
                  {detail.patient_phone || "no phone"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Prescriber: {detail.prescriber_name || "—"}
                  {detail.prescriber_license && <> ({detail.prescriber_license})</>}
                </div>
                {detail.diagnosis_text && (
                  <div className="text-xs text-muted-foreground">Dx: {detail.diagnosis_text}</div>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Items ({detailItems.length})
                </div>
                <ul className="divide-y divide-border">
                  {detailItems.map((it) => (
                    <li key={it.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{it.drug_name} {it.strength}</span>
                        {it.matched_product_id ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[9px]">Matched</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[9px]">No match</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ")} · Qty {it.quantity}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={doImport} disabled={importing} className="flex-1">
                    <DownloadSimple className="h-3.5 w-3.5 mr-1.5" />
                    {importing ? "Importing…" : "Import to prescriptions"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={async () => {
                      if (!(await confirm({ title: "Reject this e-prescription?" }))) return;
                      await rejectEprescription(detail.id, "Rejected by pharmacist");
                      toast.success("Rejected");
                      setDetail(null);
                      load();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {detail.status === "imported" && detail.imported_prescription_id && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/pharmacy/prescriptions/${detail.imported_prescription_id}`)}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> View imported prescription
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadge({ status }: { status: DhaEprescription["status"] }) {
  if (status === "imported") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Imported</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="text-[10px]">Rejected</Badge>;
  if (status === "expired") return <Badge variant="secondary" className="text-[10px]">Expired</Badge>;
  return <Badge variant="outline" className="text-teal-700 border-teal-500 text-[10px]">Pending</Badge>;
}
