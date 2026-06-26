import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import {
  MagnifyingGlass as Search,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { getProducts, type Product } from "@/services/inventory";
import { createPrescription } from "@/services/pharmacy";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

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
    doctor_name: "", doctor_license: "",
    hospital: "", diagnosis: "", notes: "",
  });
  const [items, setItems] = useState<RxItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!open) return;
    setPatient({ customer_id: "", name: "", phone: "", age: "", doctor_name: "", doctor_license: "", hospital: "", diagnosis: "", notes: "" });
    setItems([]);
    setSearch("");
  }, [open]);

  useEffect(() => {
    if (search.length >= 1) {
      getProducts(search).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [search]);

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
  };

  const updateItem = (idx: number, field: keyof RxItem, value: string | number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!patient.name) { toast.error("Patient name required"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      await createPrescription({
        customer_id: patient.customer_id || undefined,
        patient_name: patient.name,
        patient_phone: patient.phone || undefined,
        patient_age: patient.age ? parseInt(patient.age) : undefined,
        doctor_name: patient.doctor_name || undefined,
        doctor_license: patient.doctor_license || undefined,
        hospital: patient.hospital || undefined,
        diagnosis: patient.diagnosis || undefined,
        notes: patient.notes || undefined,
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
      <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto">
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
                // Fetch the picked customer so we can auto-fill name + phone.
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
                // Quick-create from the dispense flow: customer + patient_profiles
                // in one go so the patient also shows up in /pharmacy/patients.
                // Optional fields (DOB, allergies, conditions) get filled later
                // from the patient-profile detail page or the dispense form.
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
          </Section>

          {/* Doctor info */}
          <Section title="Doctor">
            <EntityCombobox
              kind="doctor"
              value={(patient as { doctor_id?: string }).doctor_id ?? ""}
              onChange={async (id) => {
                if (!id) {
                  setPatient({ ...patient, doctor_name: "", doctor_license: "" });
                  return;
                }
                const { listDoctors } = await import("@/services/doctors");
                const rows = await listDoctors();
                const d = rows.find((r) => r.id === id);
                setPatient({
                  ...patient,
                  doctor_name: d?.full_name ?? "",
                  doctor_license: d?.license_number ?? "",
                });
              }}
              onCreate={async (name) => {
                const id = crypto.randomUUID();
                const { execute } = await import("@/lib/db");
                await execute(`INSERT INTO doctors (id, full_name, active) VALUES (?1, ?2, 1)`, [id, name]);
                setPatient({ ...patient, doctor_name: name });
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
                      <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Textarea
              placeholder="Additional notes..."
              value={patient.notes}
              onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
            />
          </Section>

          <div className="pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Create Prescription"}
            </Button>
          </div>
        </div>
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
