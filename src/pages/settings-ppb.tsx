import { useEffect, useState } from "react";
import {
  Buildings,
  CloudArrowUp,
  Warning as AlertTriangle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import {
  getPpbSettings,
  savePpbSettings,
  listSubmissions,
  submitToPpb,
  ensureSubmission,
  priorQuarter,
  type PpbSettings,
  type PpbSubmission,
} from "@/services/ppb-submissions";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

export function SettingsPpbPage() {
  const [settings, setSettings] = useState<PpbSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [submissions, setSubmissions] = useState<PpbSubmission[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [s, subs] = await Promise.all([getPpbSettings(), listSubmissions()]);
    setSettings(s);
    setSubmissions(subs);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await savePpbSettings({
        enabled: !!settings.enabled,
        api_endpoint: settings.api_endpoint,
        api_key: apiKey || undefined,
        facility_code: settings.facility_code,
        superintendent_license_number: settings.superintendent_license_number,
        auto_submit_day: settings.auto_submit_day,
      });
      toast.success("PPB settings saved");
      setApiKey("");
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const generateNow = async () => {
    try {
      const window = priorQuarter(new Date());
      const id = await ensureSubmission(window);
      toast.success(`Draft assembled for Q${window.quarter} ${window.year}`);
      const result = await submitToPpb(id);
      if (result.ok) toast.success(`Submitted — ref ${result.ref}`);
      else toast.warning(`Assembled but not submitted: ${result.error}`);
      load();
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!settings) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallback="/settings" />
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Buildings className="h-5 w-5 text-teal-600" /> PPB e-Portal submissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automatic quarterly returns to the Pharmacy and Poisons Board. Assembled from your controlled-substance register + AMR data.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked ? 1 : 0 })}
            />
            <span className="font-medium">Enable automatic quarterly submission</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="PPB API endpoint">
              <Input
                value={settings.api_endpoint ?? ""}
                onChange={(e) => setSettings({ ...settings, api_endpoint: e.target.value })}
                placeholder="https://eportal.pharmacyboardkenya.org/api"
              />
            </Field>
            <Field label="API key">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.api_key_encrypted ? "•••••• (leave blank to keep)" : "Enter API key"}
              />
            </Field>
            <Field label="Facility code">
              <Input
                value={settings.facility_code ?? ""}
                onChange={(e) => setSettings({ ...settings, facility_code: e.target.value })}
              />
            </Field>
            <Field label="Superintendent license #">
              <Input
                value={settings.superintendent_license_number ?? ""}
                onChange={(e) => setSettings({ ...settings, superintendent_license_number: e.target.value })}
              />
            </Field>
            <Field label="Auto-submit day of month">
              <Input
                type="number"
                min={1}
                max={28}
                value={settings.auto_submit_day}
                onChange={(e) => setSettings({ ...settings, auto_submit_day: parseInt(e.target.value) || 10 })}
              />
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
            <Button variant="outline" onClick={generateNow}>
              <CloudArrowUp className="h-3.5 w-3.5 mr-1.5" /> Generate + submit prior quarter now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold text-sm mb-3">Submission history</h2>
          {submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No submissions yet.</p>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Period</th>
                    <th className="text-left px-3 py-2 font-medium">Ref</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Submitted</th>
                    <th className="text-right px-3 py-2 font-medium">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-xs">{s.period_start} → {s.period_end}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.submission_ref || "—"}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={s.status} /></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString(intlLocale()) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{s.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="p-3 flex items-start gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5" />
          <p className="text-amber-900 dark:text-amber-200">
            Submitted returns are assembled from your local register. Verify the controlled-substance
            log is reconciled before the auto-submit day each quarter. Rejected submissions move to
            manual review — resubmit from here after correcting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: PpbSubmission["status"] }) {
  if (status === "submitted" || status === "acknowledged") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">{status}</Badge>;
  if (status === "rejected") return <Badge variant="destructive" className="text-[10px]">Rejected</Badge>;
  if (status === "manual_review") return <Badge variant="outline" className="text-amber-700 border-amber-500 text-[10px]">Manual review</Badge>;
  if (status === "queued") return <Badge variant="outline" className="text-blue-700 border-blue-500 text-[10px]">Queued</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
