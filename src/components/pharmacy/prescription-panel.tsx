import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Badge } from "@/components/ui/badge";
import {
  MagnifyingGlass as Search,
  Trash as Trash2,
  Warning as AlertTriangle,
  WarningOctagon as AlertOctagon,
  Info,
  Calculator,
  Swap,
} from "@phosphor-icons/react";
import { getProducts, type Product } from "@/services/inventory";
import { createPrescription } from "@/services/pharmacy";
import { checkInteractions, getSeverityColor, type InteractionWarning } from "@/services/interactions";
import { checkDrugAllergies, listConditions, type AllergyAlert, type PatientCondition } from "@/services/clinical";
import { getPatientProfile, type PatientAllergy } from "@/services/erp";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { DoseCalculatorDialog } from "@/components/pos/dose-calculator";
import { SubstitutionsDialog } from "@/components/pos/substitutions-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface RxItem {
  product_id: string;
  product_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity_prescribed: number;
  substitution_allowed: number;
  instructions: string | null;
}

export function PrescriptionPanel({ open, onClose, onSaved }: Props) {
  const [patient, setPatient] = useState({
    customer_id: "",
    name: "", phone: "", age: "",
    doctor_id: "",
    doctor_name: "", doctor_license: "",
    hospital: "", diagnosis: "", notes: "",
    refills_authorized: 0,
  });
  const [items, setItems] = useState<RxItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [interactions, setInteractions] = useState<InteractionWarning[]>([]);
  const [allergyAlerts, setAllergyAlerts] = useState<AllergyAlert[]>([]);
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergy[]>([]);
  const [patientConditions, setPatientConditions] = useState<PatientCondition[]>([]);
  const [acknowledgeWarn, setAcknowledgeWarn] = useState(false);
  const [doseFor, setDoseFor] = useState<RxItem | null>(null);
  const [subFor, setSubFor] = useState<Product | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!open) return;
    setPatient({ customer_id: "", name: "", phone: "", age: "", doctor_id: "", doctor_name: "", doctor_license: "", hospital: "", diagnosis: "", notes: "", refills_authorized: 0 });
    setItems([]);
    setSearch("");
    setInteractions([]);
    setAllergyAlerts([]);
    setPatientAllergies([]);
    setPatientConditions([]);
    setAcknowledgeWarn(false);
  }, [open]);

  // Load patient context (allergies + conditions) when a returning patient is
  // adopted. Empty when no customer_id or a fresh walk-in.
  useEffect(() => {
    if (!patient.customer_id) {
      setPatientAllergies([]);
      setPatientConditions([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getPatientProfile(patient.customer_id),
      listConditions(patient.customer_id, true),
    ]).then(([prof, c]) => {
      if (cancelled) return;
      setPatientAllergies(prof.allergies);
      setPatientConditions(c);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [patient.customer_id]);

  // Live drug-drug interaction + allergy check on every item change.
  useEffect(() => {
    if (items.length === 0) {
      setInteractions([]);
      setAllergyAlerts([]);
      return;
    }
    const productIds = items.map((it) => it.product_id);
    let cancelled = false;
    checkInteractions(productIds).then((r) => { if (!cancelled) setInteractions(r); });
    if (patient.customer_id) {
      checkDrugAllergies(patient.customer_id, productIds).then((r) => { if (!cancelled) setAllergyAlerts(r); });
    } else {
      setAllergyAlerts([]);
    }
    return () => { cancelled = true; };
  }, [items, patient.customer_id]);

  useEffect(() => {
    if (search.length >= 1) {
      getProducts(search).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const worstInteraction = interactions[0]?.interaction.severity;
  const hasSevereAllergy = allergyAlerts.some(
    (a) => a.severity === "severe" || a.severity === "life_threatening" || a.severity === "life-threatening",
  );
  const isBlocked = worstInteraction === "contraindicated" || worstInteraction === "major" || hasSevereAllergy;
  const needsAcknowledgement = !isBlocked && (interactions.length > 0 || allergyAlerts.length > 0);

  const addItem = (p: Product) => {
    setItems([...items, {
      product_id: p.id,
      product_name: p.name,
      dosage: "1 tab",
      frequency: "TDS",
      duration: "5 days",
      quantity_prescribed: 1,
      substitution_allowed: 1,
      instructions: null,
    }]);
    setSearch("");
    setSearchResults([]);
    setAcknowledgeWarn(false);
  };

  const updateItem = (idx: number, field: keyof RxItem, value: string | number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    setAcknowledgeWarn(false);
  };

  const swapItem = (idx: number, newProductId: string, newProductName: string) => {
    setItems(items.map((it, i) =>
      i === idx ? { ...it, product_id: newProductId, product_name: newProductName } : it,
    ));
  };

  const handleSave = async () => {
    if (!patient.name) { toast.error("Patient name required"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (isBlocked) {
      toast.error("Cannot save: severe interaction or allergy conflict. Adjust the prescription.");
      return;
    }
    if (needsAcknowledgement && !acknowledgeWarn) {
      toast.error("Tick the acknowledgement box to save.");
      return;
    }
    setSaving(true);
    try {
      // If the pharmacist acknowledged a warning, append it to notes for audit.
      let auditNotes = patient.notes || "";
      if (needsAcknowledgement) {
        const lines: string[] = [];
        if (interactions.length > 0) {
          lines.push(`Interactions reviewed: ${interactions.map((i) => `${i.product_a.name}+${i.product_b.name} (${i.interaction.severity})`).join("; ")}`);
        }
        if (allergyAlerts.length > 0) {
          lines.push(`Allergy conflicts reviewed: ${allergyAlerts.map((a) => `${a.product_name} vs ${a.patient_allergen}`).join("; ")}`);
        }
        auditNotes = auditNotes ? `${auditNotes}\n\n[Safety log]\n${lines.join("\n")}` : `[Safety log]\n${lines.join("\n")}`;
      }

      await createPrescription({
        customer_id: patient.customer_id || undefined,
        patient_name: patient.name,
        patient_phone: patient.phone || undefined,
        patient_age: patient.age ? parseInt(patient.age) : undefined,
        doctor_id: patient.doctor_id || undefined,
        doctor_name: patient.doctor_name || undefined,
        doctor_license: patient.doctor_license || undefined,
        hospital: patient.hospital || undefined,
        diagnosis: patient.diagnosis || undefined,
        notes: auditNotes || undefined,
        refills_authorized: patient.refills_authorized,
        items,
      }, user!.id);
      toast.success("Prescription created");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[520px] sm:w-[580px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Prescription</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Patient info */}
          <Section title="Patient">
            <EntityCombobox
              kind="patient"
              value={patient.customer_id}
              onChange={async (id) => {
                if (!id) {
                  setPatient({ ...patient, customer_id: "", name: "", phone: "" });
                  return;
                }
                const { listCustomers } = await import("@/services/erp");
                const rows = await listCustomers();
                const c = rows.find((r) => r.id === id);
                setPatient({
                  ...patient,
                  customer_id: id,
                  name: c?.name ?? patient.name,
                  phone: c?.phone ?? patient.phone,
                });
              }}
              onCreate={async (name) => {
                const id = crypto.randomUUID();
                const { execute } = await import("@/lib/db");
                await execute(`INSERT INTO customers (id, name) VALUES (?1, ?2)`, [id, name]);
                await execute(
                  `INSERT OR IGNORE INTO patient_profiles (customer_id) VALUES (?1)`,
                  [id],
                );
                setPatient({ ...patient, customer_id: id, name });
                return { value: id, label: name };
              }}
              placeholder="Pick or add a patient…"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} />
              <Input placeholder="Age" type="number" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
            </div>

            {/* Patient context banner — allergies + chronic conditions surfaced
                *before* the pharmacist starts adding items so drug selection
                takes context into account. Read-only informational; the
                allergy conflict check runs separately per-item below. */}
            {(patientAllergies.length > 0 || patientConditions.length > 0) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  <Info className="h-3.5 w-3.5" /> Patient context
                </div>
                {patientAllergies.length > 0 && (
                  <div className="mb-1">
                    <span className="text-muted-foreground">Allergies: </span>
                    {patientAllergies.map((a, i) => (
                      <Badge key={i} variant="outline" className="mr-1 text-[10px]">
                        {a.allergen} <span className="ml-1 opacity-60">({a.severity})</span>
                      </Badge>
                    ))}
                  </div>
                )}
                {patientConditions.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Conditions: </span>
                    {patientConditions.map((c) => (
                      <Badge key={c.id} variant="outline" className="mr-1 text-[10px]">
                        {c.condition}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Doctor info */}
          <Section title="Doctor">
            <EntityCombobox
              kind="doctor"
              value={patient.doctor_id}
              onChange={async (id) => {
                if (!id) {
                  setPatient({ ...patient, doctor_id: "", doctor_name: "", doctor_license: "" });
                  return;
                }
                const { listDoctors } = await import("@/services/doctors");
                const rows = await listDoctors();
                const d = rows.find((r) => r.id === id);
                setPatient({
                  ...patient,
                  doctor_id: id,
                  doctor_name: d?.full_name ?? "",
                  doctor_license: d?.license_number ?? "",
                });
              }}
              onCreate={async (name) => {
                const id = crypto.randomUUID();
                const { execute } = await import("@/lib/db");
                await execute(`INSERT INTO doctors (id, full_name, active) VALUES (?1, ?2, 1)`, [id, name]);
                setPatient({ ...patient, doctor_id: id, doctor_name: name });
                return { value: id, label: name };
              }}
              placeholder="Pick or add a doctor…"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="License #" value={patient.doctor_license} onChange={(e) => setPatient({ ...patient, doctor_license: e.target.value })} />
              <Input placeholder="Hospital" value={patient.hospital} onChange={(e) => setPatient({ ...patient, hospital: e.target.value })} />
            </div>
            <Input placeholder="Diagnosis" value={patient.diagnosis} onChange={(e) => setPatient({ ...patient, diagnosis: e.target.value })} />
          </Section>

          {/* Items */}
          <Section title="Prescribed Items">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products to add..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No items added</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-medium text-sm">{item.product_name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSubFor({ id: item.product_id, name: item.product_name } as Product)}
                          className="text-muted-foreground hover:text-primary"
                          title="Find substitute"
                        >
                          <Swap className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDoseFor(item)}
                          className="text-muted-foreground hover:text-primary"
                          title="Dose calculator"
                        >
                          <Calculator className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(i)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input className="h-8 text-xs" placeholder="Dosage" value={item.dosage} onChange={(e) => updateItem(i, "dosage", e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="Frequency" value={item.frequency} onChange={(e) => updateItem(i, "frequency", e.target.value)} />
                      <Input className="h-8 text-xs" placeholder="Duration" value={item.duration} onChange={(e) => updateItem(i, "duration", e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Qty:</label>
                      <Input
                        className="h-8 text-xs w-20"
                        type="number"
                        value={item.quantity_prescribed}
                        onChange={(e) => updateItem(i, "quantity_prescribed", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Safety gates — interaction + allergy warnings below the items
                list. Contraindicated / major interactions and severe / life-
                threatening allergies block save entirely. Moderate / minor
                interactions and mild / moderate allergies show a warning
                with a checkbox that must be ticked to proceed. */}
            {interactions.length > 0 && (
              <SafetyBlock
                title={`${interactions.length} drug interaction${interactions.length > 1 ? "s" : ""} detected`}
                items={interactions.map((w) => ({
                  key: w.interaction.id,
                  severity: w.interaction.severity,
                  headline: `${w.product_a.name} + ${w.product_b.name}`,
                  body: w.interaction.description,
                  action: w.interaction.management ?? undefined,
                }))}
              />
            )}
            {allergyAlerts.length > 0 && (
              <SafetyBlock
                title={`${allergyAlerts.length} allergy conflict${allergyAlerts.length > 1 ? "s" : ""} detected`}
                items={allergyAlerts.map((a, i) => ({
                  key: `${a.product_id}-${i}`,
                  severity: a.severity === "life_threatening" || a.severity === "life-threatening" || a.severity === "severe"
                    ? "contraindicated"
                    : "moderate",
                  headline: a.product_name,
                  body: a.reason,
                }))}
              />
            )}
          </Section>

          {/* Notes + refills */}
          <Section title="Notes & refills">
            <Textarea
              placeholder="Additional notes..."
              value={patient.notes}
              onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground shrink-0">Refills authorized:</label>
              <Input
                type="number"
                min={0}
                max={12}
                value={patient.refills_authorized}
                onChange={(e) => setPatient({ ...patient, refills_authorized: Math.max(0, parseInt(e.target.value) || 0) })}
                className="h-8 w-20 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                0 = one-off. Higher values enable the Refills page.
              </span>
            </div>
          </Section>

          {/* Acknowledgement + save */}
          <div className="pt-4 border-t border-border space-y-2">
            {needsAcknowledgement && (
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgeWarn}
                  onChange={(e) => setAcknowledgeWarn(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I have reviewed the interaction / allergy warnings above and
                  confirm dispensing is appropriate. This will be logged.
                </span>
              </label>
            )}
            {isBlocked && (
              <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                <AlertOctagon className="h-3.5 w-3.5" />
                Save blocked — remove the contraindicated item or resolve the severe allergy.
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || isBlocked || (needsAcknowledgement && !acknowledgeWarn)}
              className="w-full"
            >
              {saving ? "Saving..." : "Create Prescription"}
            </Button>
          </div>
        </div>

        {/* Dose calculator + substitution dialogs */}
        <DoseCalculatorDialog open={!!doseFor} onClose={() => setDoseFor(null)} />
        <SubstitutionsDialog
          open={!!subFor}
          product={subFor}
          onClose={() => setSubFor(null)}
          onSwap={(originalId, sub) => {
            const idx = items.findIndex((it) => it.product_id === originalId);
            if (idx >= 0) swapItem(idx, sub.id, sub.name);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface SafetyItem {
  key: string;
  severity: "contraindicated" | "major" | "moderate" | "minor";
  headline: string;
  body: string;
  action?: string;
}

function SafetyBlock({ title, items }: { title: string; items: SafetyItem[] }) {
  const worst = items[0]?.severity ?? "minor";
  const colors = getSeverityColor(worst);
  const Icon = worst === "contraindicated" || worst === "major"
    ? AlertOctagon
    : worst === "moderate"
    ? AlertTriangle
    : Info;
  return (
    <div className={`border ${colors.border} ${colors.bg} rounded-md p-2.5 space-y-1.5`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
        <span className={`text-xs font-bold ${colors.text}`}>{title}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {items.map((it) => {
          const c = getSeverityColor(it.severity);
          return (
            <li key={it.key} className="flex items-start gap-1.5">
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 mt-0.5 ${c.badge}`}>
                {c.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${c.text}`}>{it.headline}</p>
                <p className="text-muted-foreground">{it.body}</p>
                {it.action && (
                  <p className="italic text-muted-foreground mt-0.5">
                    <strong>Action:</strong> {it.action}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
