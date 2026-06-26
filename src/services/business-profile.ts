/**
 * Single source of truth for the business identity that appears on
 * receipts, PDFs, exports, labels, and the customer display.
 *
 * THE BUG THIS FIXES:
 * Business info lived in two disconnected places —
 *   1. The `business` table (name/address/phone/email) — this is what
 *      the user actually edits in Settings → Business Profile and in
 *      the first-run setup wizard.
 *   2. `settings` rows keyed `business.name`, `business.address`, … —
 *      which NOTHING ever wrote, but which every PDF generator read
 *      via loadBrandHeader().
 * Result: every exported PDF (controlled-substances register, VAT
 * report, payslips, invoices, …) showed the literal "Your Business"
 * because the settings keys were always empty.
 *
 * Fix: read from the `business` table (the row the user edits) and
 * fold in the KRA PIN from `etims_config`. Everything funnels through
 * getBusinessProfile() so there's one place to add fields and one
 * place that knows where the data really lives.
 */
import { query } from "@/lib/db";

export interface BusinessProfile {
  /** Registered/trading name. Never the "Your Business" placeholder
   *  unless the business row genuinely has no name yet. */
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** KRA PIN, sourced from etims_config. */
  kraPin: string | null;
  /** Optional logo path (file://, appdata, or http URL). */
  logoPath: string | null;
  /** Optional website. */
  website: string | null;
  /** Module/vertical type, e.g. "pharmacy". */
  type: string | null;
}

const EMPTY: BusinessProfile = {
  name: "",
  address: null,
  phone: null,
  email: null,
  kraPin: null,
  logoPath: null,
  website: null,
  type: null,
};

/**
 * Load the business profile from the canonical `business` table,
 * enriched with the KRA PIN from etims_config and any optional
 * extras (logo path, website) that live in `settings`.
 *
 * Returns an object whose `name` is the real business name. Callers
 * that need a display fallback should apply their own (e.g.
 * `profile.name || "Your Business"`) — but for real installs the
 * name is always populated because setup.tsx requires it.
 */
export async function getBusinessProfile(): Promise<BusinessProfile> {
  try {
    const [bizRows, etimsRows, settingRows] = await Promise.all([
      query<{
        name: string;
        type: string;
        address: string | null;
        phone: string | null;
        email: string | null;
      }>(`SELECT name, type, address, phone, email FROM business LIMIT 1`),
      query<{ kra_pin: string | null }>(
        `SELECT kra_pin FROM etims_config LIMIT 1`,
      ).catch(() => [] as Array<{ kra_pin: string | null }>),
      query<{ key: string; value: string }>(
        `SELECT key, value FROM settings
         WHERE key IN ('business.logo_path','business.website','business.kra_pin')`,
      ).catch(() => [] as Array<{ key: string; value: string }>),
    ]);

    const biz = bizRows[0];
    if (!biz) return { ...EMPTY };
    const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

    return {
      name: biz.name || "",
      address: biz.address,
      phone: biz.phone,
      email: biz.email,
      // Prefer the eTIMS-registered PIN; fall back to a settings override.
      kraPin: etimsRows[0]?.kra_pin || settings["business.kra_pin"] || null,
      logoPath: settings["business.logo_path"] || null,
      website: settings["business.website"] || null,
      type: biz.type || null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * Convenience: business name with a safe display fallback. Use in UI
 * chrome where an empty string would look broken. PDF/export callers
 * should prefer the raw profile + their own fallback so the
 * placeholder never silently ends up in a compliance document.
 */
export async function getBusinessName(fallback = "Your Business"): Promise<string> {
  const p = await getBusinessProfile();
  return p.name || fallback;
}
