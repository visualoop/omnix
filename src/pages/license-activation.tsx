import { useState, useEffect } from "react";
import {
  Key, Cpu, AlertCircle, Copy, Check, ExternalLink, Loader2,
  Sparkles, Shield, Package, BarChart3, Wifi, FileCheck, Receipt,
  Zap, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMachineInfo, activateLicense, startTrial, getTrialState,
  type MachineInfo, type TrialState,
} from "@/services/license";
import { OmnixLogo } from "@/components/omnix-logo";
import { APP_NAME, BRAND } from "@/lib/brand";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onActivated: () => void;
}

/** Modules a customer can trial (Core is always included, never gated). */
const TRIAL_MODULES = [
  { id: "dawa", label: "Dawa — Pharmacy" },
  { id: "retail", label: "Soko — Retail" },
  { id: "hardware", label: "Hardware & Building" },
  { id: "hospitality", label: "Hospitality — Restaurant & Hotel" },
] as const;

const FEATURES = [
  { icon: Receipt,   label: "Point of Sale",     text: "Fast checkout with M-Pesa, card, and cash",            tint: "from-emerald-500/30 to-emerald-500/5",  glow: "text-emerald-400" },
  { icon: Package,   label: "Inventory & stock", text: "Batches, expiry, stock takes, multi-branch transfers", tint: "from-blue-500/30 to-blue-500/5",        glow: "text-blue-400" },
  { icon: FileCheck, label: "eTIMS compliant",   text: "KRA invoicing built in. No third-party plugin",        tint: "from-amber-500/30 to-amber-500/5",      glow: "text-amber-400" },
  { icon: Shield,    label: "Insurance claims",  text: "NHIF / SHA workflow with payer reconciliation",        tint: "from-rose-500/30 to-rose-500/5",        glow: "text-rose-400" },
  { icon: Wifi,      label: "LAN multi-device",  text: "Pair tablets and second tills offline",                tint: "from-violet-500/30 to-violet-500/5",    glow: "text-violet-400" },
  { icon: BarChart3, label: "Pro reports",       text: "P&L, Z-report, inventory valuation, margins",          tint: "from-cyan-500/30 to-cyan-500/5",        glow: "text-cyan-400" },
];

export function LicenseActivationPage({ onActivated }: Props) {
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialModule, setTrialModule] = useState<string>("dawa");
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
      if (result.pending) {
        toast.success("License activated offline. We'll verify with the server when you're back online.");
      } else {
        toast.success("License activated. Welcome aboard!");
      }
      onActivated();
    } else {
      setError(result.error || "Activation failed");
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      const state = await startTrial(trialModule);
      if (state.active) {
        const modLabel = TRIAL_MODULES.find((m) => m.id === trialModule)?.label ?? trialModule;
        toast.success(`30-day ${modLabel} trial started — ${state.days_remaining} days remaining`);
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
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    setKey(pasted.replace(/\s+/g, ""));
    setError(null);
  };

  const openBuyPage = async () => {
    // Send the customer to the marketing /buy page with the machine fingerprint
    // so the licence can be pre-bound to this device. After payment they'll get
    // a key by email, paste it below, and activate.
    const url = new URL("/buy", BRAND.company.website);
    if (machine?.fingerprint) url.searchParams.set("machine", machine.fingerprint);
    if (trialModule) url.searchParams.set("module", trialModule);
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url.toString());
    } catch {
      // Fallback for non-Tauri context (preview / tests) — open in same window
      window.location.href = url.toString();
    }
  };

  const trialAlreadyUsed = trial?.consumed && !trial?.active;
  const trialActive = trial?.active === true;

  return (
    <div className="glass-canvas min-h-screen w-full">
      {/* Decorative ambient orbs (sit BEHIND glass cards, give the canvas depth) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/10 blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:px-12">
        {/* ─── LEFT: Hero ─────────────────────────────────────── */}
        <div className="flex flex-col gap-8">
          {/* Brand chip */}
          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl p-2.5">
              <OmnixLogo size={32} />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">{APP_NAME}</div>
              <div className="text-[11px] text-muted-foreground">{BRAND.tagline}</div>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 self-start rounded-full glass-thin px-3 py-1 text-[11px] font-medium text-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Pay once. Use forever.
            </div>
            <h1 className="text-[40px] font-semibold tracking-tight leading-[1.05] text-foreground lg:text-[44px]">
              The operating system for<br />
              <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">your business.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
              POS, inventory, accounting, and KRA compliance in one Windows app that
              works offline — built for the realities of running an SME in Kenya.
            </p>
          </div>

          {/* Feature grid in glass */}
          <div className="glass rounded-glass-lg p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${f.tint} ring-1 ring-inset ring-white/5 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)]`}>
                    <f.icon className={`h-[18px] w-[18px] ${f.glow}`} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-tight">{f.label}</div>
                    <div className="text-[11.5px] leading-snug text-muted-foreground mt-0.5">{f.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { dot: "bg-emerald-500", label: "Offline-first SQLite" },
              { dot: "bg-blue-500", label: "Auto-updates" },
              { dot: "bg-amber-500", label: "LAN sync" },
              { dot: "bg-violet-500", label: "Single-key activation" },
            ].map((p) => (
              <span key={p.label} className="inline-flex items-center gap-1.5 rounded-full glass-thin px-2.5 py-1 text-[11px] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: Activation panel ─────────────────────────── */}
        <div className="glass-thick rounded-glass-xl p-6 lg:p-7">
          <div className="space-y-5">
            {/* Trial CTA — primary */}
            {!trialAlreadyUsed && !trialActive && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold leading-tight">Start free for 30 days</div>
                    <div className="text-[11.5px] text-muted-foreground leading-tight mt-0.5">No card. One module. Full features.</div>
                  </div>
                </div>
                <label className="block text-[11px] font-medium text-muted-foreground">
                  Choose a module to trial
                  <select
                    value={trialModule}
                    onChange={(e) => setTrialModule(e.target.value)}
                    className="mt-1.5 w-full h-10 rounded-xl glass-thin px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  >
                    {TRIAL_MODULES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <Button
                  onClick={handleStartTrial}
                  disabled={startingTrial}
                  className="w-full h-11 rounded-xl shadow-native cursor-pointer"
                >
                  {startingTrial ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting trial…</>
                  ) : (
                    <>Start free trial <ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
                <div className="text-[11px] text-muted-foreground text-center">
                  After 30 days, enter a licence to keep using {APP_NAME}.
                </div>
              </div>
            )}

            {/* Trial active */}
            {trialActive && trial && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Trial active — {trial.days_remaining} days remaining</div>
                    <div className="text-[11px] text-muted-foreground">Lock in your licence now — paste the key below when you receive it.</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={onActivated} className="cursor-pointer">Continue</Button>
                </div>
                {/* Buy CTA — opens website in default browser, pre-fills machine ID */}
                <div className="rounded-2xl glass-thin p-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium leading-tight">Ready to keep going?</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      Buy now — KES 100,000 once, no subscription. Your key arrives instantly via email.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={openBuyPage}
                    className="rounded-xl cursor-pointer shadow-native"
                  >
                    Buy now <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Trial expired */}
            {trialAlreadyUsed && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Trial used on this machine</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Enter a licence below to continue, or buy a new one — KES 100,000 once.</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={openBuyPage}
                  className="w-full h-10 rounded-xl shadow-native cursor-pointer"
                >
                  Buy a licence <ExternalLink className="h-3 w-3 ml-1.5" />
                </Button>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-medium">
                {trialActive ? "Or activate now" : trialAlreadyUsed ? "Enter licence" : "Have a licence?"}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* License key input */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-medium">Licence key</span>
              </div>
              <textarea
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(null); }}
                onPaste={handlePaste}
                placeholder="OMNIX-eyJraWQiOiJPTU5JWC0yMD…XYZ.MEUCIQ…"
                className="w-full min-h-[110px] rounded-xl glass-thin p-3 text-[11.5px] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                spellCheck={false}
              />
              {key && cleanedKey.length < 50 && (
                <p className="text-[11px] text-muted-foreground">Key looks short — make sure you copied it all.</p>
              )}
              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/8 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                </div>
              )}
              <Button
                onClick={handleActivate}
                disabled={!canActivate}
                variant={trialAlreadyUsed ? "default" : "outline"}
                className="w-full h-10 rounded-xl cursor-pointer"
              >
                {activating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Activating…</>
                ) : (
                  <>Activate licence</>
                )}
              </Button>
            </div>

            {/* Machine ID — collapsible glass row */}
            {machine && (
              <details className="group rounded-xl glass-thin">
                <summary className="cursor-pointer list-none px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-medium hover:bg-foreground/[0.03] rounded-xl transition-colors">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  Machine ID for support
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-3.5 pb-3 pt-1 space-y-2 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground pt-2">
                    The licence binds to this machine. Share this ID with support to transfer.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-foreground/[0.04] px-2.5 py-1.5 rounded-lg font-mono text-[11px] tracking-wide selectable">
                      {machine.formatted}
                    </code>
                    <Button variant="outline" size="sm" onClick={handleCopyMachineId} className="shrink-0 cursor-pointer">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </details>
            )}

            {/* Buy CTA */}
            <div className="text-center text-[11px] text-muted-foreground space-y-1 pt-1">
              <a
                href={`${BRAND.company.website}/pricing`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline cursor-pointer font-medium"
              >
                Buy {APP_NAME} <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <p className="text-[10.5px]">
                <strong className="font-semibold">KES 100,000</strong> one-time · pay once, use forever · no subscription
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
