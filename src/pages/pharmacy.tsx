import { useState, useEffect, useCallback } from "react";
import {
  Calculator as Calculator,
  FileText,
  MagnifyingGlass as Search,
  Plus,
  ShoppingCart,
  Tag,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getPrescriptions, getExpiringItems, preparePrescriptionForPosCheckout, type Prescription, type ExpiryItem } from "@/services/pharmacy";
import { printDrugLabels } from "@/services/drug-labels";
import { PrescriptionPanel } from "@/components/pharmacy/prescription-panel";
import { useCartStore } from "@/stores/cart";
import { DoseCalculatorDialog } from "@/components/pos/dose-calculator";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { moduleAccent, ModuleMasthead, ModuleStat, ModuleTable, ModuleTHead, ModuleEmpty } from "@/components/shared/module-kit";

const ACCENT = moduleAccent("dawa");

export function PharmacyPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [expiring, setExpiring] = useState<ExpiryItem[]>([]);
  const [search, setSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [doseOpen, setDoseOpen] = useState(false);
  const [dispensing, setDispensing] = useState<string | null>(null);
  const navigate = useNavigate();
  const loadSnapshot = useCartStore((s) => s.loadSnapshot);

  const load = useCallback(async () => {
    const [rxs, exps] = await Promise.all([
      getPrescriptions(search || undefined),
      getExpiringItems(90),
    ]);
    setPrescriptions(rxs);
    setExpiring(exps);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDispense = async (rx: Prescription) => {
    setDispensing(rx.id);
    try {
      const checkout = await preparePrescriptionForPosCheckout(rx.id);
      if (!checkout) {
        toast.error("This prescription has already been dispensed or has no items.");
        return;
      }
      loadSnapshot(checkout.items, 0, null, {
        source: { type: "prescription", id: rx.id, label: `Rx #${rx.rx_number} — ${rx.patient_name}` },
      });
      toast.success(`Prescription #${rx.rx_number} loaded into POS cart`);
      navigate("/pos/sale");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDispensing(null);
    }
  };

  const dispensedToday = prescriptions.filter(p => p.created_at.startsWith(new Date().toISOString().slice(0, 10))).length;
  const awaiting = prescriptions.filter(p => p.status !== "dispensed").length;

  return (
    <div>
      <ModuleMasthead
        accent={ACCENT}
        title="Prescriptions"
        subtitle="Dispense, label, and track every script — with controlled-substance and expiry oversight built in."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setDoseOpen(true)}>
              <Calculator className="h-4 w-4 mr-1" /> Dose calc
            </Button>
            <Button size="sm" className={`${ACCENT.solid} ${ACCENT.solidHover}`} onClick={() => setPanelOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New prescription
            </Button>
          </>
        }
      />

      {/* Pharmacy registers — the trade's compliance surfaces, grouped as a
          quiet secondary nav so the primary action stays unambiguous. */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ["Controlled register", "/pharmacy/controlled-register"],
          ["Cold chain", "/pharmacy/cold-chain"],
          ["AMR report", "/pharmacy/amr"],
          ["Doctors", "/pharmacy/doctors"],
          ["Refills", "/pharmacy/refills"],
        ].map(([label, to]) => (
          <Link key={to} to={to}>
            <Button size="sm" variant="outline" className="h-8 text-xs">{label}</Button>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <ModuleStat accent={ACCENT} label="Scripts today" value={dispensedToday} icon={FileText} />
        <ModuleStat accent={ACCENT} label="Awaiting dispense" value={awaiting} tone={awaiting > 0 ? "accent" : "default"} />
        <ModuleStat
          accent={ACCENT}
          label="Expiring (90 days)"
          value={expiring.length}
          tone={expiring.length > 0 ? "danger" : "default"}
          onClick={() => navigate("/pharmacy/expiry")}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Prescriptions list */}
      {prescriptions.length === 0 ? (
        <ModuleEmpty
          icon={FileText}
          title="No prescriptions yet"
          hint="Create your first prescription record to start dispensing."
          action={
            <Button size="sm" className={`${ACCENT.solid} ${ACCENT.solidHover}`} onClick={() => setPanelOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New prescription
            </Button>
          }
        />
      ) : (
        <ModuleTable>
          <ModuleTHead>
            <tr>
              <th className="text-left px-4 py-2.5">Rx #</th>
              <th className="text-left px-4 py-2.5">Patient</th>
              <th className="text-left px-4 py-2.5">Doctor</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </ModuleTHead>
          <tbody>
            {prescriptions.map((rx) => (
              <tr key={rx.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs">#{rx.rx_number}</td>
                <td className="px-4 py-2.5">
                  <div>
                    <div className="font-medium">{rx.patient_name}</div>
                    {rx.patient_phone && <div className="text-xs text-muted-foreground">{rx.patient_phone}</div>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{rx.doctor_name || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{rx.created_at}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={rx.status === "dispensed" ? "default" : "secondary"} className="text-xs">
                    {rx.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {rx.status !== "dispensed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={dispensing === rx.id}
                        onClick={() => handleDispense(rx)}
                        className="h-7 text-xs"
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        {dispensing === rx.id ? "Loading..." : "Dispense"}
                      </Button>
                    )}
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
        </ModuleTable>
      )}

      <PrescriptionPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSaved={load} />
      <DoseCalculatorDialog open={doseOpen} onClose={() => setDoseOpen(false)} />
    </div>
  );
}
