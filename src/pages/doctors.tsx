import { useEffect, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Building as Building2,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  Phone,
  Plus,
  Stethoscope,
  UserMinus,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { listDoctors, upsertDoctor, deactivateDoctor, SPECIALTIES, type Doctor, type DoctorWithStats } from "@/services/doctors";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function DoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DoctorWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setDoctors(await listDoctors(search));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [search]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <BackButton fallback="/pharmacy" />
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" /> Prescribers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Doctor and prescriber database for prescription tracking
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Doctor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, license, hospital..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Specialty</th>
              <th className="text-left px-3 py-2 font-medium">Hospital</th>
              <th className="text-left px-3 py-2 font-medium">License</th>
              <th className="text-right px-3 py-2 font-medium">Prescriptions</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowSkeleton cells={6} rows={4} />
            ) : doctors.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState
                  icon={Stethoscope}
                  title="No doctors yet"
                  description="Add prescribers to link them to prescriptions and run compliance reports."
                  cta={{ label: "Add Doctor", onClick: () => setCreating(true), icon: Plus }}
                />
              </td></tr>
            ) : (
              doctors.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{d.full_name}</div>
                    {d.phone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {d.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {d.specialty ? <Badge variant="secondary" className="text-xs">{d.specialty}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {d.hospital ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> {d.hospital}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{d.license_number || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{d.prescription_count}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(d)} title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      {d.active === 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          title="Deactivate"
                          onClick={async () => {
                            if (!(await confirm({
                              title: `Deactivate ${d.full_name}?`,
                              description: "The doctor stays in the database and past prescriptions remain linked, but they won't appear in the prescriber picker.",
                            }))) return;
                            try {
                              await deactivateDoctor(d.id);
                              toast.success("Doctor deactivated");
                              load();
                            } catch (e) {
                              toast.error(String(e));
                            }
                          }}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DoctorForm
        open={creating || !!editing}
        doctor={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function DoctorForm({ open, doctor, onClose, onSaved }: {
  open: boolean; doctor: Doctor | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Doctor>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (doctor) setForm(doctor);
    else setForm({});
  }, [doctor, open]);

  const save = async () => {
    if (!form.full_name) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      await upsertDoctor({ ...form, full_name: form.full_name });
      toast.success(doctor ? "Updated" : "Created");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[460px] sm:max-w-[460px]">
        <SheetHeader>
          <SheetTitle>{doctor ? doctor.full_name : "New Doctor"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <Field label="Full Name *">
            <Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="License Number">
              <Input value={form.license_number || ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="KMPDC..." />
            </Field>
            <Field label="Specialty">
              <Select
                value={form.specialty || ""}
                onValueChange={(v) => setForm({ ...form, specialty: String(v ?? "") })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a specialty…" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Hospital / Clinic">
            <Input value={form.hospital || ""} onChange={(e) => setForm({ ...form, hospital: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone">
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
            <Button onClick={save} className="flex-1" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </div>
          {doctor && doctor.active === 1 && (
            <Button
              variant="ghost"
              className="w-full text-red-600"
              onClick={async () => {
                if (!(await confirm({ title: `Deactivate ${doctor.full_name}?` }))) return;
                await deactivateDoctor(doctor.id);
                onSaved();
              }}
            >
              Deactivate
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
