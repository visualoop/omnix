import { useState, useEffect } from "react";
import { Search, CheckCircle2, XCircle, Loader2, UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProviders,
  verifyMember,
  registerMemberManually,
  calculateCopay,
  type InsuranceProvider,
  type InsuranceMember,
} from "@/services/insurance";

interface Props {
  grossAmount: number;
  onMemberSelected: (data: {
    provider: InsuranceProvider;
    member: InsuranceMember;
    copay: number;
    claim: number;
  }) => void;
  onCancel: () => void;
}

export function InsuranceVerifyPanel({ grossAmount, onMemberSelected, onCancel }: Props) {
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [memberNumber, setMemberNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<{
    provider: InsuranceProvider;
    member: InsuranceMember;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    getProviders(true).then((p) => {
      setProviders(p);
      if (p[0]) setProviderId(p[0].id);
    });
  }, []);

  const handleVerify = async () => {
    if (!providerId || !memberNumber) return;
    setError(null);
    setVerifying(true);
    const result = await verifyMember(providerId, memberNumber.trim(), nationalId.trim() || undefined);
    setVerifying(false);

    if (result.ok && result.member) {
      const provider = providers.find((p) => p.id === providerId)!;
      setVerified({ provider, member: result.member });
    } else {
      setError(result.error || "Verification failed");
      // For private insurers, offer manual registration
      const provider = providers.find((p) => p.id === providerId);
      if (provider && provider.type === "private") {
        setShowManual(true);
      }
    }
  };

  const handleConfirm = () => {
    if (!verified) return;
    const { copay, claim } = calculateCopay(verified.member, grossAmount);
    onMemberSelected({
      provider: verified.provider,
      member: verified.member,
      copay,
      claim,
    });
  };

  if (verified) {
    const { copay, claim } = calculateCopay(verified.member, grossAmount);
    return (
      <div className="space-y-4">
        <div className="border border-green-500/50 bg-green-500/5 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{verified.member.full_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {verified.provider.name} • Member: <span className="font-mono">{verified.member.member_number}</span>
              </p>
              {verified.member.scheme_name && (
                <p className="text-xs text-muted-foreground">Scheme: {verified.member.scheme_name}</p>
              )}
              {verified.member.benefit_balance !== null && (
                <p className="text-xs mt-1">
                  Balance: <span className="font-mono font-medium">KES {verified.member.benefit_balance.toFixed(0)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cost split */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Breakdown</p>
          </div>
          <div className="p-4 space-y-2">
            <Row label="Total Bill" value={grossAmount} bold />
            {verified.member.copay_percentage > 0 && (
              <Row
                label={`Member Copay (${verified.member.copay_percentage}%)`}
                value={(grossAmount * verified.member.copay_percentage) / 100}
                indent
              />
            )}
            {verified.member.copay_fixed > 0 && (
              <Row label="Fixed Copay" value={verified.member.copay_fixed} indent />
            )}
            <div className="border-t border-border pt-2" />
            <Row label="Member Pays" value={copay} bold highlight="amber" />
            <Row label="Insurance Pays" value={claim} bold highlight="green" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setVerified(null)} className="flex-1">Change</Button>
          <Button onClick={handleConfirm} className="flex-1">Confirm</Button>
        </div>
      </div>
    );
  }

  if (showManual) {
    return (
      <ManualRegisterForm
        providers={providers}
        defaultProviderId={providerId}
        defaultMemberNumber={memberNumber}
        defaultNationalId={nationalId}
        onCancel={() => { setShowManual(false); setError(null); }}
        onRegistered={(provider, member) => setVerified({ provider, member })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Verify Insurance Member</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Provider</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <optgroup label="National">
              {providers.filter((p) => p.type === "sha").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Private">
              {providers.filter((p) => p.type === "private").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Member Number *</label>
          <Input
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
            placeholder="e.g., 12345678"
            className="font-mono"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">National ID (recommended)</label>
          <Input
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            placeholder="8 digits"
            className="font-mono"
          />
        </div>

        {error && (
          <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={handleVerify} disabled={verifying || !memberNumber} className="flex-1">
            {verifying ? (
              <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Verifying...</>
            ) : (
              <><Search className="h-3.5 w-3.5 mr-2" /> Verify</>
            )}
          </Button>
        </div>

        {error && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowManual(true)}
            className="w-full"
          >
            <UserPlus className="h-3.5 w-3.5 mr-2" /> Register manually instead
          </Button>
        )}
      </div>
    </div>
  );
}

function ManualRegisterForm({
  providers,
  defaultProviderId,
  defaultMemberNumber,
  defaultNationalId,
  onCancel,
  onRegistered,
}: {
  providers: InsuranceProvider[];
  defaultProviderId: string;
  defaultMemberNumber: string;
  defaultNationalId: string;
  onCancel: () => void;
  onRegistered: (provider: InsuranceProvider, member: InsuranceMember) => void;
}) {
  const [form, setForm] = useState({
    provider_id: defaultProviderId,
    member_number: defaultMemberNumber,
    national_id: defaultNationalId,
    full_name: "",
    phone: "",
    scheme_name: "",
    copay_percentage: 20,
    copay_fixed: 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.full_name || !form.member_number) return;
    setSaving(true);
    const member = await registerMemberManually(form);
    setSaving(false);
    const provider = providers.find((p) => p.id === form.provider_id)!;
    onRegistered(provider, member);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Register Member Manually</h3>
      <p className="text-xs text-muted-foreground">
        Use this for insurers without API integration. Verify the card physically.
      </p>

      <div className="space-y-2.5">
        <Field label="Member Number *">
          <Input
            value={form.member_number}
            onChange={(e) => setForm({ ...form, member_number: e.target.value })}
            className="font-mono"
          />
        </Field>
        <Field label="Full Name *">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="National ID">
            <Input
              value={form.national_id}
              onChange={(e) => setForm({ ...form, national_id: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Scheme Name">
          <Input
            value={form.scheme_name}
            onChange={(e) => setForm({ ...form, scheme_name: e.target.value })}
            placeholder="e.g., Premier Outpatient"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Copay %">
            <Input
              type="number"
              value={form.copay_percentage}
              onChange={(e) => setForm({ ...form, copay_percentage: Number(e.target.value) })}
              className="font-mono"
            />
          </Field>
          <Field label="Fixed Copay (KES)">
            <Input
              type="number"
              value={form.copay_fixed}
              onChange={(e) => setForm({ ...form, copay_fixed: Number(e.target.value) })}
              className="font-mono"
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Back</Button>
        <Button onClick={handleSave} disabled={saving || !form.full_name || !form.member_number} className="flex-1">
          {saving ? "Saving..." : "Register & Continue"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Row({
  label, value, bold, indent, highlight,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean; highlight?: "green" | "amber";
}) {
  const colorClass = highlight === "green" ? "text-green-700" : highlight === "amber" ? "text-amber-700" : "";
  return (
    <div className={`flex justify-between items-center text-sm ${indent ? "pl-3" : ""}`}>
      <span className={`${bold ? "font-medium" : ""} ${colorClass}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${colorClass}`}>
        KES {value.toFixed(2)}
      </span>
    </div>
  );
}
