import { useState, useEffect } from "react";
import {
  Key, Cpu, AlertCircle, Copy, Check, ExternalLink, Loader2,
  Sparkles, Shield, Pill, BarChart3, Wifi, FileCheck, Receipt,
  Zap, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMachineInfo, activateLicense, startTrial, getTrialState,
  type MachineInfo, type TrialState,
} from "@/services/license";
import { SokoLogo } from "@/components/soko-logo";
import { APP_NAME, BRAND } from "@/lib/brand";
import { toast } from "sonner";

interface Props {
  onActivated: () => void;
}

const FEATURES = [
  { icon: Receipt, label: "Point of Sale", text: "Lightning-fast checkout with M-Pesa, card, and cash" },
  { icon: Pill, label: "Pharmacy (Dawa)", text: "Prescriptions, labels, refills, drug interactions" },
  { icon: FileCheck, label: "eTIMS Compliant", text: "KRA invoicing built in. No third-party plugin" },
  { icon: Shield, label: "Insurance Claims", text: "NHIF / SHA workflow with payer reconciliation" },
  { icon: Wifi, label: "LAN Multi-Device", text: "Pair tablets and second tills offline" },
  { icon: BarChart3, label: "Pro Reports", text: "P&L, Z-report, inventory valuation, margin analysis" },
];

export function LicenseActivationPage({ onActivated }: Props) {
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([getMachineInfo(), getTrialState()]).then(([m, t]) => {
      setMachine(m);
      setTrial(t);
    });
  }, []);

  const cleanedKey = key.replace(/\s+/g, "");
  const canActivate = cleanedKey.length > 50 && !activating;

  const handleActivate = async () => {
    if (!cleanedKey) {
      setError("Enter your license key");
      return;
    }
    setActivating(true);
    setError(null);
    const result = await activateLicense(cleanedKey);
    setActivating(false);
    if (result.ok) {
      toast.success("License activated. Welcome aboard!");
      onActivated();
    } else {
      setError(result.error || "Activation failed");
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      const state = await startTrial();
      if (state.active) {
        toast.success(`30-day free trial started — ${state.days_remaining} days remaining`);
        onActivated();
      } else if (state.consumed) {
        toast.error("Free trial already used on this machine");
      } else {
        toast.error("Could not start trial. Please activate a license.");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setStartingTrial(false);
    }
  };

  const handleCopyMachineId = async () => {
    if (!machine) return;
    await navigator.clipboard.writeText(machine.formatted);
    setCopied(true);
    toast.success("Machine ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Auto-clean on paste so visible whitespace doesn't break decode
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setKey(pasted.replace(/\s+/g, ""));
    setError(null);
  };

  const trialAlreadyUsed = trial?.consumed && !trial?.active;
  const trialActive = trial?.active === true;

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        {/* ─── LEFT: Hero / value prop ───────────────────────── */}
        <div className="relative bg-gradient-to-br from-primary/5 via-background to-background p-8 lg:p-12 flex flex-col">
          {/* Top bar with logo */}
          <div className="flex items-center gap-3">
            <SokoLogo size={36} />
            <div>
              <div className="font-semibold tracking-tight">{APP_NAME}</div>
              <div className="text-xs text-muted-foreground">{BRAND.tagline}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg mt-12">
            <div className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-4">
              <Sparkles className="h-3 w-3" /> v0.1.2 · Production
            </div>

            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.15]">
              The operating system for your business.
            </h1>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Pharmacy. POS. Inventory. Compliance. All in one Windows app that works offline,
              built for the realities of running an SME in Kenya.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <f.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground leading-snug">{f.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing footer */}
          <div className="mt-12 pt-6 border-t border-border">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Offline-first SQLite
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                Auto-updates
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                LAN sync
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>
                Single key activation
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Activation form ────────────────────────── */}
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Trial CTA — primary */}
            {!trialAlreadyUsed && !trialActive && (
              <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.03] p-5 space-y-3 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-2 relative">
                  <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Try free for 30 days</div>
                    <div className="text-xs text-muted-foreground">No card. No commitment. Full features.</div>
                  </div>
                </div>
                <Button
                  onClick={handleStartTrial}
                  disabled={startingTrial}
                  className="w-full h-10 relative"
                >
                  {startingTrial ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting trial...</>
                  ) : (
                    <>Start Free Trial <ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
                <div className="text-[11px] text-muted-foreground text-center relative">
                  After 30 days, enter a license to keep using {APP_NAME}.
                </div>
              </div>
            )}

            {/* Trial active state */}
            {trialActive && trial && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Trial active — {trial.days_remaining} days remaining</div>
                  <div className="text-xs text-muted-foreground">Activate a license now to lock in pricing.</div>
                </div>
                <Button size="sm" variant="outline" onClick={onActivated}>Continue</Button>
              </div>
            )}

            {/* Trial expired state */}
            {trialAlreadyUsed && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Trial used on this machine</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Enter a license below to continue, or buy at <a href={BRAND.company.website} className="underline">{BRAND.company.domain}</a>.</div>
                </div>
              </div>
            )}

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {trialActive ? "Or activate now" : trialAlreadyUsed ? "Enter license" : "Have a license?"}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* License key input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">License Key</h2>
              </div>

              <textarea
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(null); }}
                onPaste={handlePaste}
                placeholder="SOKO-eyJraWQiOiJTT0tPLTIw...XYZ.MEUCIQ..."
                className="w-full min-h-[110px] rounded-lg border border-input bg-background p-3 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                spellCheck={false}
              />

              {key && cleanedKey.length < 50 && (
                <p className="text-[11px] text-muted-foreground">
                  Key looks short — make sure you copied it all.
                </p>
              )}

              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-relaxed">{error}</p>
                </div>
              )}

              <Button
                onClick={handleActivate}
                disabled={!canActivate}
                variant={trialAlreadyUsed ? "default" : "outline"}
                className="w-full h-10"
              >
                {activating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Activating...</>
                ) : (
                  <>Activate License</>
                )}
              </Button>
            </div>

            {/* Machine ID */}
            {machine && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium flex items-center gap-2 hover:bg-muted/30 rounded-lg">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  Machine ID for support
                </summary>
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  <p className="text-[11px] text-muted-foreground">
                    The license binds to this machine. Share this ID with support to transfer.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-2.5 py-1.5 rounded font-mono text-xs tracking-wide">
                      {machine.formatted}
                    </code>
                    <Button variant="outline" size="sm" onClick={handleCopyMachineId} className="shrink-0">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </details>
            )}

            {/* Buy CTA */}
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                <a
                  href={`${BRAND.company.website}/buy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Buy {APP_NAME} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </p>
              <p className="text-[11px]">
                <strong>KES 30,000</strong> one-time license · <strong>KES 12,000/year</strong> for updates &amp; compliance
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
