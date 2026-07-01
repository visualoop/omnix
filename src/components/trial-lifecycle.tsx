/**
 * Trial banner + write-guard hook (v0.28.0).
 *
 * Replaces the previous "trial expired → hard lock the whole app on day 31"
 * cliff with a graceful three-stage transition:
 *
 *   Day 0 (trial elapses)      — amber banner, everything still works
 *   Days 1-7 (grace)           — amber banner, everything still works
 *   Days 8-30 (read_only)      — red banner, writes blocked with a modal
 *   Day 31+ (expired)          — LicenseGuard shows the activation page
 *
 * The banner is rendered once at App root (see App.tsx). The
 * `useTrialWriteGuard()` hook returns a { can, reason, prompt } tuple that
 * callers use to short-circuit critical mutations:
 *
 *   const guard = useTrialWriteGuard();
 *   const onCompleteSale = async () => {
 *     if (!guard.can) return guard.prompt();
 *     await recordSale(...);
 *   };
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { getLicenseStatus } from "@/services/license";

type Stage = 'not_started' | 'active' | 'grace' | 'read_only' | 'expired';

interface TrialSnapshot {
  stage: Stage;
  days_remaining: number;
  moduleName?: string;
}

/** Read the current trial stage. Polls on window focus + every 15 min. */
export function useTrialStage(): TrialSnapshot | null {
  const [snap, setSnap] = useState<TrialSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await getLicenseStatus();
        // If they have an active licence, the trial banner doesn't render —
        // the paid license takes precedence.
        if (s.license) {
          if (!cancelled) setSnap(null);
          return;
        }
        const trial = s.trial;
        if (!trial) {
          if (!cancelled) setSnap(null);
          return;
        }
        if (!cancelled) {
          setSnap({
            stage: trial.stage,
            days_remaining: trial.stage_days_remaining,
            moduleName: (trial.modules ?? [])[0],
          });
        }
      } catch {
        // Silent — banner is optional UI.
      }
    };
    load();
    const onFocus = () => load();
    const interval = setInterval(load, 15 * 60 * 1000);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  return snap;
}

/**
 * Sticky top-of-app banner for grace + read_only stages. Non-dismissible
 * because it's the ONLY signal that the trial is over — dismissing it
 * would leave the shopkeeper wondering why writes fail two days later.
 */
export function TrialLifecycleBanner() {
  const snap = useTrialStage();
  const navigate = useNavigate();

  if (!snap) return null;
  if (snap.stage === 'active' || snap.stage === 'not_started' || snap.stage === 'expired') {
    return null; // active = no banner; expired = LicenseGuard shows full-page CTA
  }

  const isRedZone = snap.stage === 'read_only';
  const days = snap.days_remaining;

  const wrapClass = isRedZone
    ? "bg-destructive text-destructive-foreground"
    : "bg-amber-500 text-amber-950";
  const buttonClass = isRedZone
    ? "bg-white text-destructive hover:bg-white/95"
    : "bg-amber-950 text-amber-100 hover:bg-amber-900";

  const headline = isRedZone
    ? `Trial ended — read-only mode`
    : `Trial ended`;
  const subline = isRedZone
    ? `New sales and stock moves are blocked. You can still view data, close shifts, and print past receipts. ${days} day${days === 1 ? '' : 's'} until the app locks.`
    : `You have ${days} day${days === 1 ? '' : 's'} of full access left. Activate a licence to keep trading without interruption.`;

  return (
    <div className={`${wrapClass} px-4 py-2 flex items-center justify-between gap-3 shrink-0`}>
      <div className="flex items-start gap-2 min-w-0">
        <Warning className="h-4 w-4 shrink-0 mt-0.5" weight="fill" />
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">{headline}</span>
          <span className="text-[11px] opacity-90 truncate sm:whitespace-normal">
            {subline}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate("/settings/licenses")}
        className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${buttonClass}`}
      >
        Activate licence
      </button>
    </div>
  );
}

/**
 * Write-guard hook. Callers wrap critical mutations:
 *
 *   const guard = useTrialWriteGuard();
 *   const onSave = () => {
 *     if (!guard.can) { guard.prompt(); return; }
 *     ...
 *   };
 *
 * Returns:
 *   can    — true unless the trial is in `read_only` mode
 *   stage  — the current stage (for diagnostic labels)
 *   prompt — a callback that shows a toast + routes to /settings/licenses
 */
interface WriteGuard {
  can: boolean;
  stage: Stage | null;
  prompt: () => void;
}

export function useTrialWriteGuard(): WriteGuard {
  const snap = useTrialStage();
  const navigate = useNavigate();

  const can = !snap || snap.stage === 'active' || snap.stage === 'grace' || snap.stage === 'not_started';
  const stage = snap?.stage ?? null;

  const prompt = useCallback(() => {
    if (can) return;
    toast.error("Trial ended — activate a licence to save new work.", {
      description: "Read-only mode. Your existing data is safe.",
      action: {
        label: "Activate",
        onClick: () => navigate("/settings/licenses"),
      },
    });
  }, [can, navigate]);

  return { can, stage, prompt };
}
