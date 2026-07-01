import { useEffect } from "react";
import { getMode, getMasterConfig } from "@/services/network";
import { drainQueue, countPending, pruneSuccess } from "@/services/offline-queue";

const DRAIN_INTERVAL_MS = 15_000; // 15s

/**
 * Runs the drainer only for LAN clients. Standalone / master installs skip.
 * Best-effort — every failure is captured on the queue row for later review.
 */
export function useOfflineQueueDrainer(): void {
  useEffect(() => {
    let cancelled = false;

    const runOnce = async () => {
      if (cancelled) return;
      try {
        const mode = await getMode();
        if (mode !== "client") return;

        const pending = await countPending();
        if (pending === 0) return;

        const config = await getMasterConfig();
        if (!config.url || !config.token) return;

        const masterFetch = async (path: string, init: RequestInit) => {
          const url = path.startsWith("http") ? path : `${config.url}${path}`;
          const headers = new Headers(init.headers);
          headers.set("authorization", `Bearer ${config.token}`);
          return fetch(url, { ...init, headers });
        };

        await drainQueue(masterFetch);
      } catch (e) {
        console.warn("[offline-queue] drain failed:", e);
      }
    };

    // First drain 5s after mount so we don't race DB init.
    const first = setTimeout(runOnce, 5_000);
    const interval = setInterval(runOnce, DRAIN_INTERVAL_MS);

    // Prune succeeded rows once an hour to keep the table small.
    const pruneTimer = setInterval(() => {
      pruneSuccess().catch(() => { /* non-fatal */ });
    }, 60 * 60 * 1000);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      clearInterval(pruneTimer);
    };
  }, []);
}
