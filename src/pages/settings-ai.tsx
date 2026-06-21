/**
 * AI integration settings page (/settings/ai). Three tabs:
 *   - Providers: per-provider key + enable + test + master toggles
 *   - Features: per-feature enable + privacy tier override
 *   - Activity:  audit log of every AI call
 */
import { useEffect, useState } from "react";
import {
  Sparkle as Sparkles,
} from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { listProviders, listFeatures, loadSettings, saveSetting, updateFeature } from "@/services/ai";
import type { AiProvider, AiFeature, AiSettings, PrivacyTier } from "@/services/ai/types";
import { AiProviderCard } from "@/components/ai/AiProviderCard";
import { AiActivityLog } from "@/components/ai/AiActivityLog";

type Tab = "providers" | "features" | "activity";

export function AiSettingsPage() {
  const [tab, setTab] = useState<Tab>("providers");
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [features, setFeatures] = useState<AiFeature[]>([]);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    Promise.all([listProviders(), listFeatures(), loadSettings()])
      .then(([p, f, s]) => { setProviders(p); setFeatures(f); setSettings(s); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  if (loading || !settings) {
    return <div className="p-6 text-sm text-muted-foreground">Loading AI settings…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI Integration
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Add a key from any free-tier provider to enable AI features. Bring your own — Omnix takes no fee.
        </p>
      </div>

      <div className="border-b border-border flex gap-4 text-sm">
        {(["providers", "features", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 border-b-2 transition-colors cursor-pointer ${
              tab === t ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "providers" ? "Providers" : t === "features" ? "Features" : "Activity"}
          </button>
        ))}
      </div>

      {tab === "providers" && <ProvidersTab providers={providers} settings={settings} onChange={reload} setSettings={setSettings} />}
      {tab === "features" && <FeaturesTab features={features} onChange={reload} />}
      {tab === "activity" && <AiActivityLog />}
    </div>
  );
}

interface ProvidersTabProps {
  providers: AiProvider[];
  settings: AiSettings;
  onChange: () => void;
  setSettings: (s: AiSettings) => void;
}

function ProvidersTab({ providers, settings, onChange, setSettings }: ProvidersTabProps) {
  const setBool = async (key: keyof AiSettings, v: boolean) => {
    await saveSetting(key, v as never);
    setSettings({ ...settings, [key]: v });
  };
  const setNum = async (key: keyof AiSettings, v: number) => {
    await saveSetting(key, v as never);
    setSettings({ ...settings, [key]: v });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
        <Toggle
          label="Free models only"
          description="Restrict AI calls to free-tier models. Disable to allow paid models when free options fall through."
          checked={settings.free_models_only}
          onChange={(v) => setBool("free_models_only", v)}
        />
        <Toggle
          label="Cache responses"
          description="Reuse identical prompt/model results — cuts cost and latency dramatically for repeated tasks."
          checked={settings.cache_enabled}
          onChange={(v) => setBool("cache_enabled", v)}
        />
        <Toggle
          label="Show preview before each call"
          description="See what gets sent before it leaves your device. Recommended for the first few weeks."
          checked={settings.show_preview}
          onChange={(v) => setBool("show_preview", v)}
        />
        <Toggle
          label="Allow high-sensitivity AI"
          description="Permits features that send customer/patient names, prescriptions, or financial detail. OFF by default."
          checked={settings.high_tier_optin}
          onChange={(v) => setBool("high_tier_optin", v)}
        />
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
          <div>
            <div className="text-sm font-medium">Monthly spend cap (USD)</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Hard stop on AI spend per month. Free-tier calls don't count.</div>
          </div>
          <Input
            type="number"
            value={settings.monthly_spend_cap_usd}
            onChange={(e) => setNum("monthly_spend_cap_usd", parseFloat(e.target.value) || 0)}
            min={0}
            step={0.5}
            className="w-24 text-right"
          />
        </div>
      </div>

      <div className="space-y-3">
        {providers.map((p) => (
          <AiProviderCard key={p.id} provider={p} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FeaturesTab({ features, onChange }: { features: AiFeature[]; onChange: () => void }) {
  const tiers: PrivacyTier[] = ["low", "medium", "high"];
  return (
    <div className="space-y-2 max-w-3xl">
      <div className="text-[11px] text-muted-foreground mb-2">
        Toggle individual AI features. Privacy tier controls what kinds of data the feature is allowed to send.
      </div>
      {features.map((f) => (
        <div key={f.feature_id} className="rounded-lg border border-border p-3 flex items-start gap-3">
          <Switch
            checked={f.enabled}
            onCheckedChange={async (v) => { await updateFeature(f.feature_id, { enabled: v }); onChange(); }}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{f.display_name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{f.description}</div>
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">{f.feature_id} · {f.task_kind}</div>
          </div>
          <select
            value={f.privacy_tier}
            disabled={!f.enabled}
            onChange={async (e) => { await updateFeature(f.feature_id, { privacy_tier: e.target.value as PrivacyTier }); onChange(); }}
            className="text-xs border border-input rounded-md bg-background px-2 py-1"
          >
            {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
