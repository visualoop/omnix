/**
 * One card per provider on the AI settings page. Shows status, lets the
 * user paste/edit an API key, and ping-tests the connection.
 */
import { useState } from "react";
import {
  CheckCircle as CheckCircle2,
  CircleNotch as Loader2,
  ArrowSquareOut as ExternalLink,
  Eye,
  EyeSlash as EyeOff,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { AiProvider } from "@/services/ai/types";
import { updateProvider, pingProvider } from "@/services/ai";

const SIGNUP_URL: Record<string, string> = {
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  google: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  custom: "",
};

interface AiProviderCardProps {
  provider: AiProvider;
  onChange: () => void;
}

export function AiProviderCard({ provider, onChange }: AiProviderCardProps) {
  const [key, setKey] = useState(provider.api_key_encrypted ?? "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasKey = !!provider.api_key_encrypted;
  const rateLimited = provider.rate_limited_until && new Date(provider.rate_limited_until) > new Date();

  const save = async () => {
    setSaving(true);
    try {
      await updateProvider(provider.id, {
        api_key_encrypted: key || null,
        enabled: !!key,
      });
      toast.success(`${provider.display_name} updated`);
      onChange();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await pingProvider(provider.id);
      if (result.ok) {
        toast.success(`${provider.display_name} reachable`, { description: `${result.latencyMs}ms` });
      } else {
        toast.error(`${provider.display_name} test failed`, { description: result.error });
      }
      onChange();
    } finally {
      setTesting(false);
    }
  };

  const toggle = async (v: boolean) => {
    if (v && !hasKey) {
      toast.error("Add an API key first");
      return;
    }
    await updateProvider(provider.id, { enabled: v });
    onChange();
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{provider.display_name}</h3>
            {provider.enabled && hasKey && !rateLimited && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 mr-1" /> connected
              </Badge>
            )}
            {rateLimited && (
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
                rate-limited
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{provider.notes}</p>
        </div>
        <Switch checked={provider.enabled} onCheckedChange={toggle} disabled={!hasKey} />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={provider.id === "custom" ? "Bearer token (optional)" : "Paste API key"}
            className="text-xs font-mono pr-9"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button size="sm" onClick={save} disabled={saving || key === (provider.api_key_encrypted ?? "")} className="cursor-pointer">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={test} disabled={!hasKey || testing} className="cursor-pointer">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Test"}
        </Button>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <div className="text-muted-foreground font-mono truncate">{provider.base_url}</div>
        {SIGNUP_URL[provider.id] && (
          <a
            href={SIGNUP_URL[provider.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            Get free key <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {provider.last_error && (
        <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="truncate">{provider.last_error}</span>
        </div>
      )}
    </div>
  );
}
