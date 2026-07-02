import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Pulse as Activity,
  ArrowLeft,
  Calendar,
  CircleNotch as Loader2,
  FloppyDisk as Save,
  Heart,
  Phone,
  Pill,
  Plus,
  Trash as Trash2,
  User,
  Warning as AlertTriangle,
  Scales as Weight,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getCustomer, getPatientProfile, upsertPatientProfile, addAllergy, removeAllergy,
  type Customer, type PatientProfile, type PatientAllergy,
} from "@/services/erp";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/back-button";
export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profile, setProfile] = useState<PatientProfile>({
    customer_id: id || "",
    date_of_birth: null,
    gender: null,
    blood_type: null,
    weight_kg: null,
    height_cm: null,
    pregnant: 0,
    breastfeeding: 0,
    chronic_conditions: null,
    current_medications: null,
    notes: null,
    emergency_contact: null,
    emergency_phone: null,
  });
  const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    if (!id) return;
    const cust = await getCustomer(id);
    if (cust) setCustomer(cust);
    const data = await getPatientProfile(id);
    if (data.profile) setProfile(data.profile);
    setAllergies(data.allergies);
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertPatientProfile(profile);
      toast.success("Patient profile saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const calcAge = (dob: string | null): string => {
    if (!dob) return "—";
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return `${age} years`;
  };

  const calcBMI = (): string => {
    if (!profile.weight_kg || !profile.height_cm) return "—";
    const heightM = profile.height_cm / 100;
    const bmi = profile.weight_kg / (heightM * heightM);
    return bmi.toFixed(1);
  };

  if (!customer) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <BackButton fallback="/patients" />
            <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Pill className="h-3 w-3" /> Patient Profile
              {customer.phone && <><span>·</span><Phone className="h-3 w-3" /> {customer.phone}</>}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save
        </Button>
      </div>

      {/* Critical alerts */}
      {(allergies.some((a) => a.severity === "life-threatening" || a.severity === "severe") || profile.pregnant === 1) && (
        <div className="border border-red-500/50 bg-red-500/5 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-bold text-red-700">CLINICAL ALERTS</p>
          </div>
          {profile.pregnant === 1 && <p className="text-xs">⚠️ Patient is pregnant — review all prescriptions carefully</p>}
          {allergies.filter((a) => a.severity === "life-threatening").map((a) => (
            <p key={a.id} className="text-xs text-red-700">
              ⚠️ <strong>Life-threatening allergy:</strong> {a.allergen}{a.reaction && ` — ${a.reaction}`}
            </p>
          ))}
          {allergies.filter((a) => a.severity === "severe").map((a) => (
            <p key={a.id} className="text-xs text-red-700">
              ⚠️ <strong>Severe allergy:</strong> {a.allergen}
            </p>
          ))}
        </div>
      )}

      {/* Vitals */}
      <div className="grid grid-cols-4 gap-3">
        <VitalCard icon={Calendar} label="Age" value={calcAge(profile.date_of_birth)} />
        <VitalCard icon={Activity} label="Blood Type" value={profile.blood_type || "—"} />
        <VitalCard icon={Weight} label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : "—"} />
        <VitalCard icon={Heart} label="BMI" value={calcBMI()} />
      </div>

      {/* Demographics */}
      <Section title="Demographics">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date of Birth">
            <Input
              type="date"
              value={profile.date_of_birth || ""}
              onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value || null })}
            />
          </Field>
          <Field label="Gender">
            <Select
              value={profile.gender || ""}
              onValueChange={(v) => setProfile({ ...profile, gender: (String(v) || null) as PatientProfile["gender"] })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Blood Type">
            <Select
              value={profile.blood_type || ""}
              onValueChange={(v) => setProfile({ ...profile, blood_type: String(v) || null })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* Body metrics */}
      <Section title="Body Metrics">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight (kg)">
            <Input
              type="number"
              step="0.1"
              value={profile.weight_kg ?? ""}
              onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value ? Number(e.target.value) : null })}
              className="font-mono"
            />
          </Field>
          <Field label="Height (cm)">
            <Input
              type="number"
              value={profile.height_cm ?? ""}
              onChange={(e) => setProfile({ ...profile, height_cm: e.target.value ? Number(e.target.value) : null })}
              className="font-mono"
            />
          </Field>
        </div>
      </Section>

      {/* Special conditions */}
      {profile.gender === "female" && (
        <Section title="Special Conditions">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={profile.pregnant === 1} onCheckedChange={(v) => setProfile({ ...profile, pregnant: Boolean(v) ? 1 : 0 })} />
              Currently pregnant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={profile.breastfeeding === 1} onCheckedChange={(v) => setProfile({ ...profile, breastfeeding: Boolean(v) ? 1 : 0 })} />
              Currently breastfeeding
            </label>
          </div>
        </Section>
      )}

      {/* Allergies */}
      <Section title={`Allergies (${allergies.length})`}>
        <div className="space-y-2">
          {allergies.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No known allergies</p>
          ) : (
            <div className="space-y-1.5">
              {allergies.map((a) => (
                <div key={a.id} className="flex items-center justify-between border border-border rounded-md p-2.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{a.allergen}</span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    {a.reaction && <p className="text-xs text-muted-foreground mt-0.5">{a.reaction}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await removeAllergy(a.id);
                      toast.success("Allergy removed");
                      load();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAddAllergy(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Allergy
          </Button>
        </div>
      </Section>

      {/* Conditions & medications */}
      <Section title="Medical History">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chronic Conditions">
            <Textarea
              value={profile.chronic_conditions || ""}
              onChange={(e) => setProfile({ ...profile, chronic_conditions: e.target.value || null })}
              placeholder="e.g., Hypertension, Diabetes Type 2, Asthma"
            />
          </Field>
          <Field label="Current Medications">
            <Textarea
              value={profile.current_medications || ""}
              onChange={(e) => setProfile({ ...profile, current_medications: e.target.value || null })}
              placeholder="e.g., Metformin 500mg BD, Amlodipine 5mg OD"
            />
          </Field>
        </div>
      </Section>

      {/* Emergency contact */}
      <Section title="Emergency Contact">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Name">
            <Input
              value={profile.emergency_contact || ""}
              onChange={(e) => setProfile({ ...profile, emergency_contact: e.target.value || null })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={profile.emergency_phone || ""}
              onChange={(e) => setProfile({ ...profile, emergency_phone: e.target.value || null })}
            />
          </Field>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <Textarea
          value={profile.notes || ""}
          onChange={(e) => setProfile({ ...profile, notes: e.target.value || null })}
          placeholder="Other relevant medical information..."
        />
      </Section>

      {showAddAllergy && (
        <AllergyDialog
          customerId={profile.customer_id}
          onClose={() => setShowAddAllergy(false)}
          onAdded={() => { setShowAddAllergy(false); load(); }}
        />
      )}
    </div>
  );
}

function VitalCard({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="text-lg font-semibold font-mono">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
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

function SeverityBadge({ severity }: { severity: PatientAllergy["severity"] }) {
  const config = {
    "life-threatening": { className: "bg-red-700 text-white hover:bg-red-700", label: "LIFE-THREATENING" },
    "severe": { className: "bg-red-600 text-white hover:bg-red-600", label: "SEVERE" },
    "moderate": { className: "bg-amber-500 text-white hover:bg-amber-500", label: "MODERATE" },
    "mild": { className: "bg-blue-500 text-white hover:bg-blue-500", label: "MILD" },
  }[severity];
  return <Badge className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
}

function AllergyDialog({
  customerId, onClose, onAdded,
}: {
  customerId: string; onClose: () => void; onAdded: () => void;
}) {
  const [allergen, setAllergen] = useState("");
  const [severity, setSeverity] = useState<PatientAllergy["severity"]>("moderate");
  const [reaction, setReaction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!allergen.trim()) { toast.error("Allergen name required"); return; }
    setSubmitting(true);
    try {
      await addAllergy({
        customer_id: customerId,
        allergen: allergen.trim(),
        severity,
        reaction: reaction.trim() || null,
        notes: null,
      });
      toast.success("Allergy added");
      onAdded();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-md p-5 space-y-4">
        <h3 className="font-semibold">Add Allergy</h3>
        <Field label="Allergen *">
          <Input
            value={allergen}
            onChange={(e) => setAllergen(e.target.value)}
            placeholder="e.g., Penicillin, Aspirin, Peanuts"
            autoFocus
          />
        </Field>
        <Field label="Severity">
          <Select value={severity} onValueChange={(v) => setSeverity(String(v) as PatientAllergy["severity"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="mild">Mild</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="severe">Severe</SelectItem>
            <SelectItem value="life-threatening">Life-threatening (anaphylaxis)</SelectItem>
          </SelectContent></Select>
        </Field>
        <Field label="Reaction">
          <Input
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
            placeholder="e.g., Hives, swelling, anaphylaxis"
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={handleAdd} className="flex-1" disabled={submitting || !allergen}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
