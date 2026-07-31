import { useEffect, useState } from "react";

export type PosFormFactor = "phone" | "tablet" | "desktop";

export function resolvePosFormFactor(width: number): PosFormFactor {
  if (width < 768) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}

/**
 * Temporary POS-owned adapter. The responsive-foundation integration can pass
 * its formFactor into POSSalePage and bypass this viewport fallback entirely.
 */
export function usePosFormFactor(override?: PosFormFactor): PosFormFactor {
  const [detected, setDetected] = useState<PosFormFactor>(() =>
    typeof window === "undefined" ? "desktop" : resolvePosFormFactor(window.innerWidth),
  );

  useEffect(() => {
    if (override || typeof window === "undefined") return;
    const update = () => setDetected(resolvePosFormFactor(window.innerWidth));
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, [override]);

  return override ?? detected;
}
