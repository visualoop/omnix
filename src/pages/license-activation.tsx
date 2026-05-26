import { useState, useEffect } from "react";
import { Key, Cpu, AlertCircle, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMachineInfo,
  activateLicense,
  type MachineInfo,
} from "@/services/license";
import { SokoLogo } from "@/components/soko-logo";
import { APP_NAME, BRAND } from "@/lib/brand";
import { toast } from "sonner";

interface Props {
  onActivated: () => void;
}

export function LicenseActivationPage({ onActivated }: Props) {
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMachineInfo().then(setMachine);
  }, []);

  const handleCopyMachineId = async () => {
    if (!machine) return;
    await navigator.clipboard.writeText(machine.formatted);
    setCopied(true);
    toast.success("Machine ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async () => {
    if (!key.trim()) {
      setError("Enter your license key");
      return;
    }
    setActivating(true);
    setError(null);
    const result = await activateLicense(key.trim());
    setActivating(false);

    if (result.ok) {
      toast.success("License activated");
      onActivated();
    } else {
      setError(result.error || "Activation failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-3">
            <SokoLogo size={64} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Activate {APP_NAME}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the license key you received after purchase
          </p>
        </div>

        {/* License key input */}
        <div className="border border-border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">License Key</h2>
          </div>

          <textarea
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your license key here&#10;e.g., SOKO-eyJraWQiOiJTT0tPLTIw...XYZ.MEUCIQ..."
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent p-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            spellCheck={false}
            autoFocus
          />

          {error && (
            <div className="border border-red-500/50 bg-red-500/5 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            onClick={handleActivate}
            disabled={activating || !key.trim()}
            className="w-full h-10"
          >
            {activating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Activating...</>
            ) : (
              <>Activate License</>
            )}
          </Button>
        </div>

        {/* Machine ID for support */}
        {machine && (
          <div className="border border-border rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">This Machine's ID</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              The license will be bound to this machine after activation. Provide this ID to support if you need to transfer your license.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm tracking-wide">
                {machine.formatted}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyMachineId}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {/* Don't have a key? */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Don't have a license yet?{" "}
            <a
              href={`${BRAND.company.website}/buy`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              Purchase {APP_NAME} <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p className="mt-1 text-xs">
            KES 30,000 one-time license + KES 12,000/year for compliance updates
          </p>
        </div>
      </div>
    </div>
  );
}
