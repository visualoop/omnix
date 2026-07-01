import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

const FIRST_RUN_DELAY_MS = 60_000;      // 60s after boot
const INTERVAL_MS = 5 * 60_000;         // every 5 minutes

/**
 * Runs the alert scanners in the background. Only active when signed in.
 * Producers emit into `notifications` table; the top-bar bell picks them up.
 */
export function useAlertScanner(): void {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const runOnce = async () => {
      if (cancelled) return;
      try {
        const { runAllScanners } = await import("@/services/alert-scanners");
        await runAllScanners();
      } catch (e) {
        console.warn("[alert-scanner] run failed:", e);
      }
    };

    const first = setTimeout(runOnce, FIRST_RUN_DELAY_MS);
    const interval = setInterval(runOnce, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [user?.id]);
}
