import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowCounterClockwise as RotateCcw,
  MagnifyingGlass as Search,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type RefillablePrescription } from "@/services/pharmacy-extras";
import { pageRefills } from "@/services/paged";
import { useListData } from "@/hooks/use-list-data";
import { PaginationBar } from "@/components/pagination-bar";
import { useAuthStore } from "@/stores/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { RefillAmendDialog } from "@/components/pharmacy/refill-amend-dialog";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
export function RefillsPage() {
  const [amending, setAmending] = useState<RefillablePrescription | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();

  const list = useListData(pageRefills, { pageSize: 50 });
  const items = list.rows as unknown as RefillablePrescription[];
  const loading = list.loading;

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallback="/pharmacy" />
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-primary" /> Prescription Refills
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Repeat prescriptions with refills authorized by the prescriber. One-click to create a new dispensing.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patient name, phone, or Rx#..."
          className="pl-9"
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Rx #</th>
              <th className="text-left px-3 py-2 font-medium">Patient</th>
              <th className="text-left px-3 py-2 font-medium">Doctor</th>
              <th className="text-center px-3 py-2 font-medium">Items</th>
              <th className="text-center px-3 py-2 font-medium">Refills</th>
              <th className="text-left px-3 py-2 font-medium">Last dispensed</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={7} rows={4} />
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="p-0">
                <EmptyState
                  icon={RotateCcw}
                  title="No refillable prescriptions"
                  description="Prescriptions with refills authorized by the prescriber appear here. Set 'refills authorized' when entering a new prescription."
                />
              </td></tr>
            ) : (
              items.map((rx) => (
                <tr key={rx.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs">#{rx.rx_number}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{rx.patient_name}</div>
                    {rx.patient_phone && <div className="text-xs text-muted-foreground">{rx.patient_phone}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{rx.doctor_name || "—"}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{rx.item_count}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="secondary" className="font-mono">
                      {rx.refills_remaining}/{rx.refills_authorized}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(rx.last_dispensed).toLocaleDateString(intlLocale(), { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      onClick={() => setAmending(rx)}
                      disabled={!userId}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Refill
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar list={list} />

      <RefillAmendDialog
        open={!!amending}
        prescriptionId={amending?.id ?? null}
        patientName={amending?.patient_name ?? ""}
        userId={userId ?? null}
        onClose={() => setAmending(null)}
        onSaved={(newRxId) => {
          setAmending(null);
          list.refresh();
          navigate(`/pharmacy/prescriptions/${newRxId}`);
        }}
      />
    </div>
  );
}
