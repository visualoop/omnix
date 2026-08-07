import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  CircleNotch as Loader2,
  Clock,
  Copy,
  Cpu,
  ArrowSquareOut as ExternalLink,
  Key as Key,
  Lightning as Zap,
  Sparkle as Sparkles,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import {
  POSIcon, InventoryIcon, ETIMSIcon, InsuranceIcon, LANIcon, ReportsIcon,
} from "@/components/icons/feature-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getMachineInfo, activateLicense, getTrialState, getLicenseKey,
  type MachineInfo, type TrialState,
} from "@/services/license";
import {
  checkOnlineLicenseStatus,
  expiredPurchaseCopy,
  selectActivationNotice,
  variantPrice,
  type OnlineLicenseStatus,
} from "@/services/license-status";
import { OmnixLogo } from "@/components/omnix-logo";
import { APP_NAME, BRAND } from "@/lib/brand";
import { IS_PRO, LOCKED_MODULE, LICENSE_PREFIX, VARIANT } from "@/lib/variant";

// One-time price for this build's variant. Pro = 150k, trade variants = 30k.
export const VARIANT_PRICE = variantPrice(VARIANT);
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onActivated: () => void;
}


const FEATURES = [
  { icon: POSIcon,       label: "Point of Sale",     text: "Fast checkout with M-Pesa, card, and cash" },
  { icon: InventoryIcon, label: "Inventory & stock", text: "Batches, expiry, stock takes, multi-branch transfers" },
  { icon: ETIMSIcon,     label: "eTIMS compliant",   text: "KRA invoicing built in. No third-party plugin" },
  { icon: InsuranceIcon, label: "Insurance claims",  text: "NHIF / SHA workflow with payer reconciliation" },
  { icon: LANIcon,       label: "LAN multi-device",  text: "Pair tablets and second tills offline" },
  { icon: ReportsIcon,   label: "Advanced reports",  text: "P&L, Z-report, inventory valuation, margins" },
];

export function LicenseActivationPage({ onActivated }: Props) {
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineLicenseStatus | null>(null);
  const [hasStoredLicense, setHasStoredLicense] = useState(false);
  const [key, setKey] = useState("");
  const [activating, setActivating] = useState(false);
  // Trade variants: lock the trial to the binary's module. Pro picks dawa as default.
  const [trialModule] = useState<string>(
    !IS_PRO && LOCKED_MODULE ? LOCKED_MODULE : "dawa",
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [nextMachine, nextTrial, storedKey] = await Promise.all([
          getMachineInfo(),
          getTrialState(),
          getLicenseKey(),
        ]);
        if (cancelled) return;

        setMachine(nextMachine);
        setTrial(nextTrial);
        setHasStoredLicense(Boolean(storedKey));

        const status = await checkOnlineLicenseStatus(nextMachine.fingerprint, storedKey);
        if (!cancelled) setOnlineStatus(status);
      } catch (statusError) {
        console.warn("[license] status check unavailable:", statusError);
        if (!cancelled) setOnlineStatus({ kind: "unreachable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const cleanedKey = key.replace(/\s+/g, "");
  const canActivate = cleanedKey.length >= 20 && !activating;

  const handleActivate = async () => {
    if (!cleanedKey) {
      setError("Enter your license key");
      return;
    }
    setActivating(true);
    setError(null);
    try {
      const result = await activateLicense(cleanedKey);
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
    } catch (e) {
      // Defensive: if activateLicense throws (DB write fails, IPC error, …)
      // surface a real message instead of leaving the spinner running forever.
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[license] activate threw:", msg);
      setError(`Activation failed: ${msg}`);
    } finally {
      setActivating(false);
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

  const notice = selectActivationNotice({
    online: onlineStatus,
    trial,
    hasStoredLicense,
  });
  const purchaseCopy = notice.kind === "expired"
    ? expiredPurchaseCopy(notice.source, VARIANT_PRICE)
    : null;

  return (
    <div className="glass-canvas min-h-full w-full">
      <div className="relative z-10 mx-auto grid min-h-full w-full max-w-6xl grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:px-12">
        {/* ─── LEFT: Hero ─────────────────────────────────────── */}
        <div className="flex flex-col gap-8">
          {/* Brand chip */}
          <div className="flex items-center gap-3">
            <div className="glass rounded-md p-2.5">
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
              <span className="text-primary">your business.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
              POS, inventory, accounting, and KRA compliance in one Windows app that
              works offline — built for the realities of running an SME in Kenya.
            </p>
          </div>

          {/* Feature grid in glass */}
          <div className="glass rounded-md p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted/20">
                    <f.icon className="h-5 w-5 text-foreground/80" />
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
              { dot: "bg-primary", label: "Single-key activation" },
            ].map((p) => (
              <span key={p.label} className="inline-flex items-center gap-1.5 rounded-full glass-thin px-2.5 py-1 text-[11px] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: Activation panel ─────────────────────────── */}
        <div className="glass-thick rounded-md p-6 lg:p-7">
          <div className="space-y-5">
            {/* Trial CTA — shown only when neither local nor server state indicates prior use. */}
            {notice.kind === "trial-offer" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold leading-tight">Get your free 30-day trial key</div>
                    <div className="text-[11.5px] text-muted-foreground leading-tight mt-0.5">Sign up at {BRAND.company.domain} → your trial key appears on the dashboard.</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const url = new URL(`https://${BRAND.company.domain}/signup`);
                    if (machine?.fingerprint) url.searchParams.set("machine", machine.fingerprint);
                    if (!IS_PRO && LOCKED_MODULE) url.searchParams.set("variant", LOCKED_MODULE);
                    try {
                      const { openUrl } = await import("@tauri-apps/plugin-opener");
                      await openUrl(url.toString());
                    } catch {
                      // Fallback for non-Tauri contexts (dev / SSR)
                      window.open(url.toString(), "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="w-full h-11 rounded-md cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Get your trial key on {BRAND.company.domain}
                </Button>
                <div className="text-[11px] text-muted-foreground text-center">
                  Already have a key? Paste it below to activate.
                </div>
              </div>
            )}

            {notice.kind === "checking" && (
              <div className="flex items-start gap-3 rounded-md border border-border p-4" role="status">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                <div>
                  <div className="text-[13px] font-medium">Checking licence status</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    You can enter and activate a key below while this check runs.
                  </div>
                </div>
              </div>
            )}

            {notice.kind === "unknown" && (
              <div className="flex items-start gap-3 rounded-md border border-border p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[13px] font-medium">Licence status could not be confirmed</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    The licensing server is unreachable. No expiry has been assumed; manual key activation remains available below.
                  </div>
                </div>
              </div>
            )}

            {notice.kind === "attention" && (
              <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/8 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="text-[13px] font-medium">Licence needs attention</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{notice.message}</div>
                </div>
              </div>
            )}

            {/* Trial active */}
            {notice.kind === "trial-active" && (
              <div className="space-y-3">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">Trial active — {notice.daysRemaining} days remaining</div>
                    <div className="text-[11px] text-muted-foreground">Lock in your licence now — paste the key below when you receive it.</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={onActivated} className="cursor-pointer">Continue</Button>
                </div>
                <div className="rounded-md border border-border p-4 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-inset ring-primary/15">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium leading-tight">Ready to keep going?</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                      Buy now — {VARIANT_PRICE} once, no subscription. Your key arrives via email.
                    </div>
                  </div>
                  <Button size="sm" onClick={openBuyPage} className="rounded-md cursor-pointer">
                    Buy now <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Server-confirmed lapsed licence or locally consumed trial. */}
            {notice.kind === "expired" && purchaseCopy && (
              <div className="space-y-3">
                <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{purchaseCopy.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{purchaseCopy.description}</div>
                  </div>
                </div>
                <Button size="sm" onClick={openBuyPage} className="w-full h-10 rounded-md cursor-pointer">
                  {purchaseCopy.action} <ExternalLink className="h-3 w-3 ml-1.5" />
                </Button>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-medium">
                {notice.kind === "trial-active" ? "Or activate now" : notice.kind === "expired" ? "Enter licence" : "Have a licence?"}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* License key input */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-medium">Licence key</span>
              </div>
              <Textarea
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(null); }}
                onPaste={handlePaste}
                placeholder={`${LICENSE_PREFIX}-XXXX-XXXX-XXXX`}
                className="w-full min-h-[110px] rounded-md glass-thin p-3 text-[11.5px] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                spellCheck={false}
              />
              {key && cleanedKey.length < 20 && (
                <p className="text-[11px] text-muted-foreground">Key looks short — make sure you copied it all.</p>
              )}
              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/8 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
                </div>
              )}
              <Button
                onClick={handleActivate}
                disabled={!canActivate}
                variant={notice.kind === "expired" ? "default" : "outline"}
                className="w-full h-10 rounded-md cursor-pointer"
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
              <details className="group rounded-md glass-thin">
                <summary className="cursor-pointer list-none px-3.5 py-2.5 flex items-center gap-2 text-[12px] font-medium hover:bg-foreground/[0.03] rounded-md transition-colors">
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
                <strong className="font-semibold">{VARIANT_PRICE}</strong> one-time · pay once, use forever · no subscription
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
