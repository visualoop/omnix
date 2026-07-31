import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowCounterClockwise as RotateCcw } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { BackButton } from "@/components/ui/back-button";
import { PaginationBar } from "@/components/pagination-bar";
import { OperationalContext } from "@/components/shared/operational-context";
import { RefillAmendDialog } from "@/components/pharmacy/refill-amend-dialog";
import { type RefillablePrescription } from "@/services/pharmacy-extras";
import { pageRefills } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { useAuthStore } from "@/stores/auth";
import { intlLocale } from "@/lib/intl";

export function RefillsPage() {
  const [amending, setAmending] = useState<RefillablePrescription | null>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const navigate = useNavigate();
  const list = useListData(pageRefills, { pageSize: 20 });
  const items = list.rows as unknown as RefillablePrescription[];

  return (
    <div className="space-y-5">
      <div><BackButton fallback="/pharmacy" /><h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><RotateCcw className="h-5 w-5 text-primary" /> Prescription refills</h1><p className="mt-1 max-w-prose text-sm text-muted-foreground">Create the next prescription from prescriber-authorized repeats. Dispensing still completes through the prescription and POS workflow.</p></div>
      <OperationalContext compact />
      <Input aria-label="Search refillable prescriptions" className="h-11 max-w-sm" placeholder="Search patient, phone, or Rx number…" value={list.search} onChange={(event) => list.setSearch(event.target.value)} />

      {list.loading ? <div className="overflow-hidden rounded-lg border border-border"><table className="w-full text-sm"><tbody><TableRowSkeleton cells={7} rows={4} /></tbody></table></div> : items.length === 0 ? (
        <EmptyState icon={RotateCcw} title={list.search ? "No matching refills" : "No refillable prescriptions"} description={list.search ? "Try another patient, phone number, or prescription number." : "Prescriptions with prescriber-authorized repeats appear here after the first dispensing."} />
      ) : <>
        <div className="space-y-2 lg:hidden" aria-label="Refill prescription cards">{items.map((prescription) => <article key={prescription.id} className="rounded-md border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{prescription.patient_name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">Rx #{prescription.rx_number}</p></div><Badge variant="secondary" className="font-mono">{prescription.refills_remaining}/{prescription.refills_authorized} left</Badge></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs"><div><dt className="text-muted-foreground">Prescriber</dt><dd className="mt-1">{prescription.doctor_name || "—"}</dd></div><div><dt className="text-muted-foreground">Last dispensed</dt><dd className="mt-1">{new Date(prescription.last_dispensed).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}</dd></div></dl><Button className="mt-4 min-h-11 w-full" onClick={() => setAmending(prescription)} disabled={!userId}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Prepare refill</Button></article>)}</div>
        <div className="hidden overflow-hidden rounded-lg border border-border lg:block"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/30"><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left font-medium">Rx #</th><th className="px-3 py-2 text-left font-medium">Patient</th><th className="px-3 py-2 text-left font-medium">Doctor</th><th className="px-3 py-2 text-center font-medium">Items</th><th className="px-3 py-2 text-center font-medium">Refills</th><th className="px-3 py-2 text-left font-medium">Last dispensed</th><th className="px-3 py-2" /></tr></thead><tbody>{items.map((prescription) => <tr key={prescription.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="px-3 py-2.5 font-mono text-xs">#{prescription.rx_number}</td><td className="px-3 py-2.5"><div className="font-medium">{prescription.patient_name}</div>{prescription.patient_phone && <div className="text-xs text-muted-foreground">{prescription.patient_phone}</div>}</td><td className="px-3 py-2.5 text-muted-foreground">{prescription.doctor_name || "—"}</td><td className="px-3 py-2.5 text-center font-mono">{prescription.item_count}</td><td className="px-3 py-2.5 text-center"><Badge variant="secondary" className="font-mono">{prescription.refills_remaining}/{prescription.refills_authorized}</Badge></td><td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(prescription.last_dispensed).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}</td><td className="px-3 py-2.5 text-right"><Button size="sm" onClick={() => setAmending(prescription)} disabled={!userId}><RotateCcw className="mr-1 h-3 w-3" /> Refill</Button></td></tr>)}</tbody></table></div>
      </>}
      <PaginationBar list={list} />
      <RefillAmendDialog open={!!amending} prescriptionId={amending?.id ?? null} patientName={amending?.patient_name ?? ""} userId={userId ?? null} onClose={() => setAmending(null)} onSaved={(newRxId) => { setAmending(null); list.refresh(); navigate(`/pharmacy/prescriptions/${newRxId}`); }} />
    </div>
  );
}
