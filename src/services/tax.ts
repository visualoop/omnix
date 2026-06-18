/**
 * Tax mode resolver — single source of truth for how tax is computed
 * across POS, receipts, reports, and eTIMS export.
 *
 * Three modes:
 *   - 'off'        Tax disabled globally. Per-product tax_rate ignored.
 *                  No tax line on receipts, no tax row on reports.
 *   - 'inclusive'  Selling price already contains tax. Backed-out for
 *                  reporting + KRA eTIMS submission. POS displays
 *                  "Total (tax incl.)".
 *   - 'exclusive'  Tax added on top of selling price at checkout.
 *                  Default for KE / classic VAT.
 *
 * Settings keys read:
 *   tax.mode         off | inclusive | exclusive (default 'exclusive')
 *   tax.default_rate Numeric — fallback when product.tax_rate is null
 *   tax.label        Display label — VAT, GST, Sales Tax (default 'VAT')
 */
import { query } from "@/lib/db";

export type TaxMode = "off" | "inclusive" | "exclusive";

export interface TaxSettings {
  mode: TaxMode;
  defaultRate: number;
  label: string;
}

let cache: { value: TaxSettings; expiresAt: number } | null = null;
const TTL_MS = 30_000; // 30s — tax mode rarely changes mid-shift

export async function getTaxSettings(): Promise<TaxSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('tax.mode', 'tax.default_rate', 'tax.label')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const modeRaw = map.get("tax.mode");
  const mode: TaxMode = modeRaw === "off" || modeRaw === "inclusive" || modeRaw === "exclusive" ? modeRaw : "exclusive";
  const defaultRate = Number(map.get("tax.default_rate") ?? "16");
  const label = map.get("tax.label") || "VAT";
  const value: TaxSettings = { mode, defaultRate: Number.isFinite(defaultRate) ? defaultRate : 16, label };
  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

/** Force-invalidate after a settings update. */
export function invalidateTaxCache(): void {
  cache = null;
}

interface CartLine {
  unit_price: number;
  quantity: number;
  discount: number;
  tax_rate: number; // per-product override; 0 effectively disables on a single line
}

export interface TaxBreakdown {
  /** Sum of (unit_price * quantity - discount). */
  subtotal: number;
  /** Tax portion. 0 in 'off' mode. */
  taxAmount: number;
  /** What the customer pays. */
  total: number;
  mode: TaxMode;
  label: string;
}

/**
 * Compute tax + total for a list of cart lines respecting the mode.
 *
 * Pass `extras` (tip + service charge + cart-level discount) if you want
 * them rolled into the total. They never have tax.
 */
export function computeTax(
  lines: CartLine[],
  settings: TaxSettings,
  extras: { tip?: number; serviceCharge?: number; cartDiscount?: number } = {},
): TaxBreakdown {
  const tip = extras.tip ?? 0;
  const serviceCharge = extras.serviceCharge ?? 0;
  const cartDiscount = extras.cartDiscount ?? 0;

  // Line-level (unit_price * qty - line discount)
  const lineGross = lines.reduce((s, l) => s + Math.max(0, l.unit_price * l.quantity - l.discount), 0);

  if (settings.mode === "off") {
    return {
      subtotal: lineGross,
      taxAmount: 0,
      total: Math.max(0, lineGross - cartDiscount + tip + serviceCharge),
      mode: "off",
      label: settings.label,
    };
  }

  if (settings.mode === "inclusive") {
    // Selling prices already contain tax. Back it out per-line so KRA
    // / reports can see the tax portion.
    const taxAmount = lines.reduce((s, l) => {
      const lineNet = Math.max(0, l.unit_price * l.quantity - l.discount);
      const r = l.tax_rate;
      if (r <= 0) return s;
      return s + lineNet * (r / (100 + r));
    }, 0);
    // Subtotal in inclusive mode = gross - tax (the pre-tax base)
    const subtotal = Math.max(0, lineGross - taxAmount);
    return {
      subtotal,
      taxAmount,
      total: Math.max(0, lineGross - cartDiscount + tip + serviceCharge),
      mode: "inclusive",
      label: settings.label,
    };
  }

  // exclusive (default)
  const taxAmount = lines.reduce((s, l) => {
    const lineNet = Math.max(0, l.unit_price * l.quantity - l.discount);
    return s + lineNet * (l.tax_rate / 100);
  }, 0);
  return {
    subtotal: lineGross,
    taxAmount,
    total: Math.max(0, lineGross - cartDiscount + taxAmount + tip + serviceCharge),
    mode: "exclusive",
    label: settings.label,
  };
}
