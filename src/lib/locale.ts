/**
 * Locale formatters — money, numbers, dates per active country.
 *
 * All currency / number / date display in the desktop app should
 * route through these. Replaces the 851 `KES x.toFixed(0)` ad-hoc
 * formatters that were scattered across the codebase.
 *
 * Usage:
 *   import { useLocale } from "@/stores/locale";
 *   const { formatMoney } = useLocale();
 *   <span>{formatMoney(1234.5)}</span>
 *
 * Or directly with a country code:
 *   import { formatMoney } from "@/lib/locale";
 *   formatMoney(1234.5, "KE")  // "KSh 1,235"
 *   formatMoney(1234.5, "US")  // "$1,234.50"
 */
import { getCountry, type CountryCode } from "./countries";

const FALLBACK_LOCALE = "en";

function profile(code: CountryCode | null | undefined) {
  if (!code) return null;
  return getCountry(code);
}

/** Format an amount with the country's currency symbol and decimals. */
export function formatMoney(amount: number, code: CountryCode | null | undefined): string {
  const p = profile(code);
  if (!p) {
    return `$${amount.toFixed(2)}`; // safe default — never shows raw numbers
  }
  const formatted = amount.toLocaleString(p.intlLocale ?? FALLBACK_LOCALE, {
    minimumFractionDigits: p.decimals,
    maximumFractionDigits: p.decimals,
  });
  return `${p.currencySymbol} ${formatted}`;
}

/** Bare number without symbol — for input fields and cells where symbol is shown elsewhere. */
export function formatNumber(amount: number, code: CountryCode | null | undefined, decimals?: number): string {
  const p = profile(code);
  const locale = p?.intlLocale ?? FALLBACK_LOCALE;
  const d = decimals ?? p?.decimals ?? 2;
  return amount.toLocaleString(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Localized date. Pass a Date or ISO string. */
export function formatDate(d: Date | string | null | undefined, code: CountryCode | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const p = profile(code);
  return date.toLocaleDateString(p?.intlLocale ?? FALLBACK_LOCALE, opts);
}

/** Date + time. */
export function formatDateTime(d: Date | string | null | undefined, code: CountryCode | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const p = profile(code);
  return date.toLocaleString(p?.intlLocale ?? FALLBACK_LOCALE, { dateStyle: "medium", timeStyle: "short" });
}

/** Currency symbol for the active country. Useful for input prefixes. */
export function currencySymbol(code: CountryCode | null | undefined): string {
  return profile(code)?.currencySymbol ?? "$";
}

/** Currency ISO code. */
export function currencyCode(code: CountryCode | null | undefined): string {
  return profile(code)?.currencyCode ?? "USD";
}

/** Tax label (VAT / GST / Sales Tax) for the active country. */
export function taxLabel(code: CountryCode | null | undefined): string {
  return profile(code)?.taxLabel ?? "Tax";
}

/** Pharmacy term — Dawa / Pharmacy / Apotek / Farmácia / Pharmacie / etc. */
export function pharmacyTerm(code: CountryCode | null | undefined): string {
  return profile(code)?.pharmacyTerm ?? "Pharmacy";
}

/** Phone placeholder for input fields. */
export function phonePlaceholder(code: CountryCode | null | undefined): string {
  return profile(code)?.phonePlaceholder ?? "+1 (XXX) XXX-XXXX";
}
