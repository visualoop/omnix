import { useEffect } from "react";

/**
 * Auto-start the LAN server when this machine is configured as the master.
 *
 * Failure modes without this hook:
 *   1. Owner sets up master mode + starts server via /settings/network.
 *   2. Windows shuts down / restarts for updates / power blip.
 *   3. Omnix relaunches (via tauri-plugin-autostart) but the LAN server
 *      is NOT running — every client device now shows "server offline"
 *      and the owner has to click "Start server" manually every boot.
 *
 * With this hook: mode=master + app booted = server starts silently ~5s
 * after cold-launch. Retries on failure. Skipped in standalone / client mode.
 *
 * Best-effort — if the port is already bound (another Omnix instance),
 * or the tauri plugin isn't available (dev/preview), we log and move on.
 */
export function useLanAutostart(): void {
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        // Delay so DB migration + first paint finish before we bind a socket.
        await new Promise((r) => setTimeout(r, 5000));
        if (cancelled) return;

        const network = await import("@/services/network");
        const mode = await network.getMode();
        if (mode !== "master") return;

        // Skip if already running (hot-reload, dual mount).
        const status = await network.getServerStatus().catch(() => null);
        if (status?.running) return;

        const port = await network.getServerPort();
        const { query } = await import("@/lib/db");
        const rows = await query<{ name: string }>("SELECT name FROM business LIMIT 1").catch(() => []);
        const businessName = rows[0]?.name || "Omnix";

        // Try up to 3 times — LAN drivers on Windows sometimes need a
        // few seconds after login before they'll accept a bind.
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await network.startServer(port, businessName);
            console.info(`[lan-autostart] server started on port ${port}`);
            return;
          } catch (e) {
            lastErr = e;
            if (String(e).includes("already running")) return; // idempotent success
            if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
          }
        }
        console.warn("[lan-autostart] failed after retries:", lastErr);
      } catch (e) {
        console.warn("[lan-autostart] skipped:", e);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);
}
