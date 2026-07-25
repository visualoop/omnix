import { useState, useEffect } from "react";
import {
  Building as Building2,
  CircleNotch as Loader2,
  FloppyDisk as Save,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { query, execute } from "@/lib/db";
import { toast } from "sonner";

interface Business {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export function SettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);

  const load = async () => {
    const rows = await query<Business>("SELECT * FROM business LIMIT 1");
    if (rows[0]) {
      setBusiness(rows[0]);
      setForm({
        name: rows[0].name,
        address: rows[0].address || "",
        phone: rows[0].phone || "",
        email: rows[0].email || "",
      });
    }
    const lr = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'business.logo_path'");
    setLogo(lr[0]?.value ?? null);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    try {
      await execute(
        `UPDATE business SET name = ?1, address = ?2, phone = ?3, email = ?4 WHERE id = ?5`,
        [form.name, form.address, form.phone, form.email, business.id],
      );
      toast.success("Business profile updated");
      setDirty(false);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const saveLogo = async (dataUrl: string | null) => {
    try {
      await execute(
        `INSERT INTO settings (key, value) VALUES ('business.logo_path', ?1)
         ON CONFLICT(key) DO UPDATE SET value = ?1`,
        [dataUrl ?? ""],
      );
      setLogo(dataUrl);
      toast.success(dataUrl ? "Logo updated" : "Logo removed");
    } catch (e) { toast.error(String(e)); }
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file (PNG/JPG)."); return; }
    if (file.size > 1_000_000) { toast.error("Logo must be under 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => saveLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl space-y-8">
      <section className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Identity & contact</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Details printed on receipts, invoices, and customer documents.
          </p>
        </div>
        <div className="space-y-4">
          <Field label="Business name *">
            <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="0700 000 000"
                inputMode="tel"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="info@business.co.ke"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="e.g. Moi Avenue, Nairobi"
            />
          </Field>
          <Field label="Business module">
            <Input value={business?.type || ""} disabled className="capitalize" />
          </Field>
        </div>
      </section>

      <section className="grid gap-5 border-t border-border pt-7 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2 className="text-sm font-semibold">Business logo</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Used throughout customer-facing documents and displays.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
            {logo ? (
              <img src={logo} alt="Business logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
              {logo ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(event) => onLogoFile(event.target.files?.[0])}
              />
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => saveLogo(null)}
                className="block text-xs text-destructive hover:underline"
              >
                Remove logo
              </button>
            )}
            <p className="max-w-lg text-xs leading-5 text-muted-foreground">
              PNG or JPG, under 1 MB. Shown on receipts, invoices, the customer display, and app chrome.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t border-border pt-5">
        <Button onClick={handleSave} disabled={saving || !dirty || !form.name}>
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save changes</>
          )}
        </Button>
      </div>
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
