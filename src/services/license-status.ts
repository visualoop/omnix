import { fetch } from "@tauri-apps/plugin-http";
import { VARIANT, type Variant } from "@/lib/variant";

const LICENSING_API_BASE = (
  import.meta.env.VITE_OMNIX_API || "https://omnix.co.ke"
).replace(/\/$/, "");
const STATUS_TIMEOUT_MS = 5_000;

export type OnlineLicenseStatus =
  | {
      kind: "confirmed";
      status: string;
      message: string | null;
    }
  | { kind: "unreachable" }
  | { kind: "no-local-key" };

interface ValidateResponse {
  status?: unknown;
  message?: unknown;
}

/**
 * Ask the same server heartbeat used by background revalidation for its
 * current classification. Transport failure is intentionally distinct from
 * every server response: being offline must never be interpreted as expiry.
 */
export async function checkOnlineLicenseStatus(
  machineId: string,
  licenseKey: string | null,
): Promise<OnlineLicenseStatus> {
  if (!licenseKey) return { kind: "no-local-key" };

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(`${LICENSING_API_BASE}/api/licensing/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey, machineId, variant: VARIANT }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as ValidateResponse | null;
    if (typeof body?.status !== "string") return { kind: "unreachable" };
    return {
      kind: "confirmed",
      status: body.status.toLowerCase(),
      message: typeof body.message === "string" ? body.message : null,
    };
  } catch {
    return { kind: "unreachable" };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export interface TrialStatusSnapshot {
  active: boolean;
  consumed: boolean;
  days_remaining: number;
}

export type ExpirySource = "trial" | "licence";

export type ActivationNotice =
  | { kind: "checking" }
  | { kind: "trial-offer" }
  | { kind: "trial-active"; daysRemaining: number }
  | { kind: "expired"; source: ExpirySource }
  | { kind: "unknown" }
  | { kind: "attention"; message: string };

interface SelectActivationNoticeInput {
  online: OnlineLicenseStatus | null;
  trial: TrialStatusSnapshot | null;
  hasStoredLicense: boolean;
}

const LAPSED_STATUSES = new Set(["cancelled", "expired", "lapsed"]);

/** Convert local cache + server truth into copy-safe activation UI states. */
export function selectActivationNotice({
  online,
  trial,
  hasStoredLicense,
}: SelectActivationNoticeInput): ActivationNotice {
  if (online === null) return { kind: "checking" };

  if (online.kind === "unreachable") {
    return { kind: "unknown" };
  }

  if (online.kind === "confirmed") {
    if (LAPSED_STATUSES.has(online.status)) {
      return {
        kind: "expired",
        source: hasStoredLicense ? "licence" : "trial",
      };
    }
    if (online.status === "trial" && trial?.active) {
      return { kind: "trial-active", daysRemaining: trial.days_remaining };
    }
    if (online.status === "active") {
      return {
        kind: "attention",
        message: "The licensing server reports this licence as active. Enter the key again below to restore access on this computer.",
      };
    }
    return {
      kind: "attention",
      message:
        online.message ||
        "The licensing server could not approve this licence. Check the key below or contact support.",
    };
  }

  if (trial?.active) {
    return { kind: "trial-active", daysRemaining: trial.days_remaining };
  }
  if (trial?.consumed) return { kind: "expired", source: "trial" };
  if (hasStoredLicense) return { kind: "unknown" };
  return { kind: "trial-offer" };
}

export function variantPrice(variant: Variant): string {
  return variant === "pro" ? "KES 150,000" : "KES 30,000";
}

export interface ExpiredPurchaseCopy {
  title: string;
  description: string;
  action: string;
}

export function expiredPurchaseCopy(
  source: ExpirySource,
  price: string,
): ExpiredPurchaseCopy {
  return {
    title: source === "trial" ? "Your trial has expired" : "Your licence has lapsed",
    description: `Purchase a perpetual licence to continue — ${price} once. You can also enter a new licence key below.`,
    action: "Buy perpetual licence",
  };
}
