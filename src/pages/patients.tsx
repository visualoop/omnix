/**
 * Pharmacy → Patients tab.
 *
 * Lists customers that have a `patient_profiles` row. Doubles as the
 * surface for "+ Add patient" so prescribers and pharmacists can create
 * a clinical record without leaving the module.
 *
 * Each row → /patients/[id] (the existing patient-profile detail page).
 * Search filters by name OR phone; both columns are case-insensitive.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  MagnifyingGlass as Search,
  User,
  Pill,
  Warning,
  Calendar,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

interface PatientRow {
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  allergy_count: number;
  prescription_count: number;
  last_visit: string | null;
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await query<PatientRow>(
        `SELECT
           c.id AS customer_id,
           c.name,
           c.phone,
           c.email,
           pp.date_of_birth,
           pp.gender,
           (SELECT COUNT(*) FROM patient_allergies WHERE customer_id = c.id) AS allergy_count,
           (SELECT COUNT(*) FROM prescriptions
             WHERE customer_id = c.id
                OR (customer_id IS NULL AND patient_name = c.name)
           ) AS prescription_count,
           (SELECT MAX(created_at) FROM prescriptions
             WHERE customer_id = c.id
                OR (customer_id IS NULL AND patient_name = c.name)
           ) AS last_visit
         FROM customers c
         INNER JOIN patient_profiles pp ON pp.customer_id = c.id
         ORDER BY c.name ASC`,
      );
      setRows(result);
    } catch (e) {
      toast.error("Couldn't load patients", { description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pharmacy"
        title="Patients"
        description="Customers with a clinical record — allergies, chronic conditions, prescription history."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add patient
          </Button>
        }
      />

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient by name, phone, or email…"
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading patients…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-foreground/10 p-12 text-center">
          <User className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-[14px] font-medium">
            {search ? "No patients match." : "No patients yet."}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {search
              ? "Adjust the search above."
              : "Add a patient to start tracking allergies and prescription history."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.customer_id}>
              <button
                type="button"
                onClick={() => navigate(`/patients/${p.customer_id}`)}
                className="flex w-full flex-col gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-4 text-left transition-colors hover:border-foreground/30 hover:bg-foreground/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[14px] truncate">{p.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                      {p.phone ?? p.email ?? "no contact"}
                    </div>
                  </div>
                  {p.allergy_count > 0 ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300"
                      title={`${p.allergy_count} known allergies`}
                    >
                      <Warning className="size-3" />
                      {p.allergy_count}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground border-t border-foreground/5 pt-3">
                  <Stat icon={Pill} label="Rx" value={p.prescription_count} />
                  <Stat icon={Warning} label="Allergies" value={p.allergy_count} />
                  <Stat
                    icon={Calendar}
                    label="Last visit"
                    value={p.last_visit ? new Date(p.last_visit).toLocaleDateString() : "—"}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddPatientDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(id) => {
          setAddOpen(false);
          navigate(`/patients/${id}`);
        }}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Pill;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="size-3 text-muted-foreground/70 shrink-0" />
      <span className="truncate">
        <span className="font-medium text-foreground">{value}</span>{" "}
        <span className="text-muted-foreground/70">{label}</span>
      </span>
    </div>
  );
}

/**
 * Add Patient dialog — creates a customer row + a patient_profiles row
 * atomically so a Dispense / Refill flow can land them straight in the
 * clinical surface.
 */
function AddPatientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setDob("");
      setNotes("");
    }
  }, [open]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      await execute(
        `INSERT INTO customers (id, name, phone) VALUES (?1, ?2, ?3)`,
        [id, name.trim(), phone.trim() || null],
      );
      await execute(
        `INSERT INTO patient_profiles (customer_id, date_of_birth, notes) VALUES (?1, ?2, ?3)`,
        [id, dob || null, notes.trim() || null],
      );
      toast.success("Patient added");
      onCreated(id);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            Add patient
          </DialogTitle>
          <DialogDescription>
            Creates a customer record + a clinical profile in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Full name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Wanjiku"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Phone
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 712 345 678"
                type="tel"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Date of birth
              </label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Clinical notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pre-existing conditions, current meds, anything the next prescriber should know…"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : "Add patient"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
