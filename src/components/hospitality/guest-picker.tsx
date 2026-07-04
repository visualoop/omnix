/**
 * GuestPicker — searchable combobox for existing guests + inline
 * create flow. Adopts an existing row when phone or id_number
 * matches, so returning guests don't get duplicated.
 *
 * Used by the BookingDialog + walk-in folio flow.
 */
import { useEffect, useState } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { searchGuests, findGuestByPhoneOrId, type Guest } from "@/services/hospitality";
import { execute } from "@/lib/db";

const uid = () => crypto.randomUUID();

interface Props {
  value: string | null;
  onChange: (guest: Guest | null) => void;
  placeholder?: string;
}

export function GuestPicker({ value, onChange, placeholder = "Pick or add a guest…" }: Props) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("");

  const load = () => {
    searchGuests("").then(setGuests);
  };

  useEffect(() => { load(); }, []);

  const options: ComboboxOption[] = guests.map((g) => ({
    value: g.id,
    label: g.full_name,
    hint: [g.phone, g.id_number].filter(Boolean).join(" · "),
  }));

  return (
    <>
      <Combobox
        value={value ?? ""}
        onChange={(v) => {
          const g = guests.find((gg) => gg.id === v) ?? null;
          onChange(g);
        }}
        options={options}
        placeholder={placeholder}
        emptyText="No matching guest"
        onCreate={async (label) => {
          setPendingLabel(label);
          setNewDialogOpen(true);
          return null;
        }}
      />
      <GuestFormDialog
        open={newDialogOpen}
        initialName={pendingLabel}
        onClose={() => setNewDialogOpen(false)}
        onCreated={(g) => {
          load();
          onChange(g);
          setNewDialogOpen(false);
        }}
      />
    </>
  );
}

interface GuestFormProps {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (guest: Guest) => void;
}

export function GuestFormDialog({ open, initialName, onClose, onCreated }: GuestFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [nationality, setNationality] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName ?? "");
    setPhone("");
    setEmail("");
    setNationalId("");
    setNationality("");
    setNotes("");
  }, [open, initialName]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      // Adopt an existing guest if phone or id_number already matches.
      const existing = await findGuestByPhoneOrId({ phone, nationalId });
      if (existing) {
        toast.info(`Existing guest "${existing.full_name}" adopted`);
        onCreated(existing);
        return;
      }
      const id = uid();
      await execute(
        `INSERT INTO guests (id, full_name, phone, email, id_number, nationality, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        [id, name.trim(), phone.trim() || null, email.trim() || null,
         nationalId.trim() || null, nationality.trim() || null, notes.trim() || null],
      );
      toast.success("Guest added");
      onCreated({
        id,
        full_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        id_number: nationalId.trim() || null,
        nationality: nationality.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New guest</DialogTitle>
          <DialogDescription>
            National ID is required by Kenya AHRA for hotel guests.
            Phone number lets the guest receive SMS receipts + booking
            confirmations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Field label="Full name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Mwangi" autoFocus />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000 000" />
          </Field>
          <Field label="National ID / passport">
            <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="12345678" />
          </Field>
          <Field label="Nationality">
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Kenyan" />
          </Field>
          <Field label="Email" className="col-span-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Preferences, allergies, VIP flags…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add guest"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block space-y-1 ${className ?? ""}`}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
        {required ? <span className="text-rose-600 ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}
