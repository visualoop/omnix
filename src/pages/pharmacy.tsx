import { useState, useEffect, useCallback } from "react";
import { Plus, Search, FileText, AlertTriangle, Tag, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getPrescriptions, getExpiringItems, type Prescription, type ExpiryItem } from "@/services/pharmacy";
import { printDrugLabels } from "@/services/drug-labels";
import { PrescriptionPanel } from "@/components/pharmacy/prescription-panel";
import { DoseCalculatorDialog } from "@/components/pos/dose-calculator";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function PharmacyPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [expiring, setExpiring] = useState<ExpiryItem[]>([]);
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [doseOpen, setDoseOpen] = useState(false);

  const load = useCallback(async () => {
    const [rxs, exps] = await Promise.all([
      getPrescriptions(search || undefined),
      getExpiringItems(90),
    ]);
    setPrescriptions(rxs);
    setExpiring(exps);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Pharmacy (Dawa)</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDoseOpen(true)}>
            <Calculator className="h-4 w-4 mr-1" /> Dose Calc
          </Button>
          <Link to="/pharmacy/controlled-register">
            <Button size="sm" variant="outline">
              Controlled Register
            </Button>
          </Link>
          <Link to="/pharmacy/cold-chain">
            <Button size="sm" variant="outline">
              Cold Chain
            </Button>
          </Link>
          <Link to="/pharmacy/amr">
            <Button size="sm" variant="outline">
              AMR Report
            </Button>
          </Link>
          <Link to="/pharmacy/doctors">
            <Button size="sm" variant="outline">
              Doctors
            </Button>
          </Link>
          <Link to="/pharmacy/refills">
            <Button size="sm" variant="outline">
              Refills
            </Button>
          </Link>
          <Button size="sm" onClick={() => setPanelOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Prescription
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Prescriptions Today" value={prescriptions.filter(p => p.created_at.startsWith(new Date().toISOString().slice(0, 10))).length} />
        <StatCard label="Total Prescriptions" value={prescriptions.length} />
        <Link to="/pharmacy/expiry">
          <StatCard
            label="Expiring (90 days)"
            value={expiring.length}
            highlight={expiring.length > 0}
          />
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Prescriptions list */}
      {prescriptions.length === 0 ? (
        <EmptyState onAdd={() => setPanelOpen(true)} />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Rx #</th>
                <th className="text-left px-4 py-2.5 font-medium">Patient</th>
                <th className="text-left px-4 py-2.5 font-medium">Doctor</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-right px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx) => (
                <tr key={rx.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">#{rx.rx_number}</td>
                  <td className="px-4 py-2.5">
                    <div>
                      <div className="font-medium">{rx.patient_name}</div>
                      {rx.patient_phone && <div className="text-xs text-muted-foreground">{rx.patient_phone}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{rx.doctor_name || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{rx.created_at}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant={rx.status === "dispensed" ? "default" : "secondary"} className="text-xs">
                        {rx.status}
                      </Badge>
                      {rx.status === "dispensed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await printDrugLabels(rx.id);
                            } catch (e) {
                              toast.error(String(e));
                            }
                          }}
                          title="Print drug labels"
                          className="h-7 w-7 p-0"
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrescriptionPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSaved={load} />
      <DoseCalculatorDialog open={doseOpen} onClose={() => setDoseOpen(false)} />
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg p-4 ${highlight ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {highlight && <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </div>
      <p className="text-2xl font-semibold mt-2 font-mono">{value}</p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium">No prescriptions yet</h3>
      <p className="text-xs text-muted-foreground mt-1">Create your first prescription record.</p>
      <Button size="sm" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" /> New Prescription
      </Button>
    </div>
  );
}
