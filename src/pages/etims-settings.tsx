import { useState, useEffect } from "react";
import {
  CheckCircle as CheckCircle2,
  ArrowSquareOut as ExternalLink,
  FileText as FileCheck,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getEtimsConfig, saveEtimsConfig, verifyEtimsConnection, disableEtims } from "@/services/etims";
import { toast } from "sonner";

export function EtimsSettingsPage() {
  const [form, setForm] = useState({
    kra_pin: "",
    vscu_serial: "",
    branch_id: "00",
    business_name: "",
    test_mode: true,
  });
  const [active, setActive] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    const cfg = await getEtimsConfig();
    if (cfg) {
      setForm({
        kra_pin: cfg.kra_pin || "",
        vscu_serial: cfg.vscu_serial || "",
        branch_id: cfg.branch_id || "00",
        business_name: cfg.business_name || "",
        test_mode: cfg.test_mode === 1,
      });
      setActive(cfg.active === 1);
      setLastSync(cfg.last_sync_at);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.kra_pin.match(/^[A-Z]\d{9}[A-Z]$/)) {
      toast.error("Invalid KRA PIN format (e.g., P051234567X)");
      return;
    }
    if (!form.vscu_serial) {
      toast.error("VSCU serial number required");
      return;
    }
    setSaving(true);
    await saveEtimsConfig(form);
    setSaving(false);
    toast.success("eTIMS configured");
    load();
  };

  const handleVerify = async () => {
    setVerifying(true);
    const result = await verifyEtimsConnection();
    setVerifying(false);
    if (result.ok) {
      toast.success("KRA connection verified");
    } else {
      toast.error("Connection failed: " + (result.error || "unknown"));
    }
  };

  const handleDisable = async () => {
    await disableEtims();
    setActive(false);
    toast.success("eTIMS disabled");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">KRA eTIMS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure tax invoice signing via KRA's Virtual Sales Control Unit (VSCU).
        </p>
      </div>

      {/* Status banner */}
      <div className={`border rounded-lg p-4 ${
        active ? "border-green-500/50 bg-green-500/5" : "border-amber-500/50 bg-amber-500/5"
      }`}>
        <div className="flex items-start gap-3">
          {active ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">
              {active ? "eTIMS Active" : "eTIMS Not Configured"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {active
                ? "Every sale is automatically signed and submitted to KRA."
                : "Sales can still be processed but won't be tax-compliant. Configure below."}
            </p>
            {lastSync && (
              <p className="text-xs text-muted-foreground mt-1">Last sync: {lastSync}</p>
            )}
          </div>
        </div>
      </div>

      {/* Configuration form */}
      <div className="border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">VSCU Configuration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get these credentials from your KRA eTIMS portal.
            </p>
          </div>
        </div>

        <Field label="Business Name (as registered with KRA)">
          <Input
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            placeholder="e.g., Afya Pharmacy Ltd"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="KRA PIN *">
            <Input
              value={form.kra_pin}
              onChange={(e) => setForm({ ...form, kra_pin: e.target.value.toUpperCase() })}
              placeholder="P051234567X"
              className="font-mono"
              maxLength={11}
            />
          </Field>
          <Field label="Branch ID">
            <Input
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              placeholder="00"
            />
          </Field>
        </div>

        <Field label="VSCU Serial Number *">
          <Input
            value={form.vscu_serial}
            onChange={(e) => setForm({ ...form, vscu_serial: e.target.value })}
            placeholder="VSCU-XXXX-XXXX-XXXX"
            className="font-mono"
          />
        </Field>

        <div className="flex items-center gap-2">
          <Checkbox checked={form.test_mode} onCheckedChange={(v) => setForm({ ...form, test_mode: Boolean(v) })} id="test-mode" />
          <label htmlFor="test-mode" className="text-sm">Use sandbox (test) mode</label>
          <span className="text-xs text-muted-foreground">
            (recommended until verified)
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : active ? "Update" : "Connect"}
          </Button>
          {active && (
            <>
              <Button variant="outline" onClick={handleVerify} disabled={verifying}>
                {verifying ? "Verifying..." : "Test Connection"}
              </Button>
              <Button variant="outline" onClick={handleDisable}>Disable</Button>
            </>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-semibold">Getting Started with eTIMS</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            Sign in to{" "}
            <a
              href="https://etims.kra.go.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              etims.kra.go.ke <ExternalLink className="h-3 w-3" />
            </a>{" "}
            with your KRA credentials
          </li>
          <li>Register your business if not already registered</li>
          <li>Choose VSCU (Virtual Sales Control Unit) as your invoicing method</li>
          <li>Note your VSCU serial number from the portal</li>
          <li>Enter your KRA PIN and VSCU serial above</li>
          <li>Test in sandbox mode first, then switch to live</li>
        </ol>
        <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded p-2">
          <strong>Important:</strong> eTIMS compliance is legally required for all VAT-registered
          businesses in Kenya. Failure to comply may result in penalties.
        </p>
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
