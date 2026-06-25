import { useState, useEffect } from "react";
import {
  CheckCircle as CheckCircle2,
  Pencil as Edit3,
  Shield,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getProviders, updateProvider, type InsuranceProvider } from "@/services/insurance";
import { toast } from "sonner";

export function InsuranceSettingsPage() {
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [editing, setEditing] = useState<InsuranceProvider | null>(null);

  const load = async () => {
    setProviders(await getProviders(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Insurance Providers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure SHA and private insurers for member verification and claims
        </p>
      </div>

      {/* SHA section */}
      <Section title="National Insurance" providers={providers.filter(p => p.type === "sha")} onEdit={setEditing} />

      {/* Private section */}
      <Section title="Private Insurers" providers={providers.filter(p => p.type === "private")} onEdit={setEditing} />

      {/* Edit panel */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{editing?.name}</SheetTitle>
          </SheetHeader>
          {editing && <EditForm provider={editing} onSaved={() => { load(); setEditing(null); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, providers, onEdit }: {
  title: string;
  providers: InsuranceProvider[];
  onEdit: (p: InsuranceProvider) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map((p) => (
          <div key={p.id} className="border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium">{p.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.code}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {p.active === 1 ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
              {p.test_mode === 1 && <Badge variant="outline">Test Mode</Badge>}
              {p.facility_code && (
                <span className="text-xs text-muted-foreground font-mono">{p.facility_code}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditForm({ provider, onSaved }: { provider: InsuranceProvider; onSaved: () => void }) {
  const [form, setForm] = useState({
    api_endpoint: provider.api_endpoint || "",
    api_key: provider.api_key || "",
    api_secret: provider.api_secret || "",
    facility_code: provider.facility_code || "",
    contact_phone: provider.contact_phone || "",
    contact_email: provider.contact_email || "",
    active: provider.active === 1,
    test_mode: provider.test_mode === 1,
    requires_preauth: provider.requires_preauth === 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateProvider(provider.id, form);
    setSaving(false);
    toast.success("Updated " + provider.name);
    onSaved();
  };

  return (
    <div className="space-y-4 mt-4">
      <Field label="Facility Code (your code with this insurer)">
        <Input
          value={form.facility_code}
          onChange={(e) => setForm({ ...form, facility_code: e.target.value })}
          placeholder="e.g., FAC-12345"
          className="font-mono"
        />
      </Field>

      {provider.type === "sha" && (
        <>
          <Field label="API Endpoint">
            <Input
              value={form.api_endpoint}
              onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })}
              placeholder="https://api.sha.go.ke/v1"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="API Key">
            <Input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="Bearer token"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="API Secret">
            <Input
              type="password"
              value={form.api_secret}
              onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
              placeholder="Secret"
              className="font-mono text-xs"
            />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact Phone">
          <Input
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            placeholder="0700 000 000"
          />
        </Field>
        <Field label="Contact Email">
          <Input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="claims@insurer.co.ke"
          />
        </Field>
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <Toggle label="Active (accept this insurer)" value={form.active} onChange={(v) => setForm({ ...form, active: v })} />
        <Toggle label="Test mode (sandbox API)" value={form.test_mode} onChange={(v) => setForm({ ...form, test_mode: v })} />
        <Toggle label="Requires pre-authorization" value={form.requires_preauth} onChange={(v) => setForm({ ...form, requires_preauth: v })} />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Changes"}
      </Button>
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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm py-1 cursor-pointer">
      <span>{label}</span>
      <Checkbox checked={value} onCheckedChange={(v) => onChange(Boolean(v))} />
    </label>
  );
}
