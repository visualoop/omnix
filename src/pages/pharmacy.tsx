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
import { printDrugLabels, DrugLabelPrintError } from "@/services/drug-labels";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "dispensed" | "cancelled">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (statusFilter !== "all" && rx.status !== statusFilter) return false;
    if (dateFrom && rx.created_at < dateFrom) return false;
    if (dateTo && rx.created_at > dateTo + "T23:59:59") return false;
    return true;
  });

  const handleDispense = async (rx: Prescription) => {
    setDispensing(rx.id);
    try {
      const checkout = await preparePrescriptionForPosCheckout(rx.id);
      if (!checkout) {
        toast.error("This prescription has already been dispensed or has no items.");
        return;
      }

      // ── Hard blockers ─────────────────────────────────────────
      // Contraindicated interactions and life-threatening / severe
      // allergies stop dispensing entirely. The pharmacist must edit
      // the prescription (or override upstream) before dispensing.
      const contraindicated = checkout.interactions.find((w) => w.interaction.severity === "contraindicated");
      if (contraindicated) {
        toast.error(
          `Cannot dispense — contraindicated: ${contraindicated.product_a.name} + ${contraindicated.product_b.name}. ${contraindicated.interaction.description}`,
          { duration: 12000 },
        );
        return;
      }
      const severeAllergy = checkout.allergyAlerts.find(
        (a) => a.severity === "severe" || a.severity === "life_threatening" || a.severity === "life-threatening",
      );
      if (severeAllergy) {
        toast.error(
          `Cannot dispense — severe allergy conflict: ${severeAllergy.product_name} (${severeAllergy.patient_allergen}).`,
          { duration: 12000 },
        );
        return;
      }

      // ── Major interaction → warn but continue (pharmacist decides) ──
      const major = checkout.interactions.find((w) => w.interaction.severity === "major");
      if (major) {
        toast.warning(
          `Major interaction: ${major.product_a.name} + ${major.product_b.name}. Review with prescriber.`,
          { duration: 10000 },
        );
      }

      loadSnapshot(checkout.items, 0, checkout.customerId ?? null, {
        source: { type: "prescription", id: rx.id, label: `Rx #${rx.rx_number} — ${rx.patient_name}` },
      });
      toast.success(`Prescription #${rx.rx_number} loaded into POS cart`);

      // Amber non-blocking warning if any dispensed product has an active
      // batch < 30 days from expiry. The pharmacist can override — this
      // is FEFO awareness, not a hard block.
      if (checkout.expiringSoon.length > 0) {
        const soonest = checkout.expiringSoon[0];
        const others = checkout.expiringSoon.length - 1;
        const msg = others > 0
          ? `${soonest.product_name} expires in ${soonest.days_to_expiry}d (+${others} more nearing expiry)`
          : `${soonest.product_name} expires in ${soonest.days_to_expiry}d — pick the oldest batch first`;
        toast.warning(msg, { duration: 8000 });
      }

      // Cold-chain excursion warning — if a cold-chain product was stored
      // in a fridge that had an out-of-range reading in the last 24h,
      // warn the pharmacist to inspect the batch before handing it over.
      if (checkout.coldChainExcursions.length > 0) {
        const ex = checkout.coldChainExcursions[0];
        toast.warning(
          `Cold-chain excursion: ${ex.unit_name} was ${ex.temperature_c.toFixed(1)}°C at ${new Date(ex.reading_at).toLocaleString()}. Inspect ${ex.affected_products.join(", ")} before dispensing.`,
          { duration: 12000 },
        );
      }

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

      {/* Search + filter chips */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by patient name or phone..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-0.5">
          {(["all", "pending", "dispensed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded transition-colors capitalize ${
                statusFilter === s
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-xs"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Prescriptions list */}
      {filteredPrescriptions.length === 0 ? (
        <ModuleEmpty
          icon={FileText}
          title="No prescriptions match"
          hint="Try adjusting the filters, or create a new prescription."
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
            {filteredPrescriptions.map((rx) => (
              <tr
                key={rx.id}
                className="border-t border-border hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/pharmacy/prescriptions/${rx.id}`)}
              >
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
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                            if (e instanceof DrugLabelPrintError && e.code === "NO_PRINTER") {
                              toast.error(e.message, {
                                duration: 8000,
                                action: {
                                  label: "Configure printer",
                                  onClick: () => navigate("/settings/print"),
                                },
                              });
                            } else {
                              toast.error(e instanceof Error ? e.message : String(e));
                            }
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
