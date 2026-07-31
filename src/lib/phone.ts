/**
 * Convert a local or international phone number into the digit-only form
 * required by wa.me and payment APIs. When no explicit dialling code is
 * supplied, the active business country is used.
 */
import { getCountry } from "@/lib/countries";
import { useCountry } from "@/stores/country";

function activeDiallingCode(): string {
  // First-run defaults to Kenya; once hydrated, the selected business country wins.
  const profile = getCountry(useCountry.getState().code ?? "KE");
  return profile?.phoneCountryCode.replace(/\D/g, "") ?? "";
}

export function toIntlDigits(raw: string | null | undefined, defaultCountry?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return digits.length >= 8 ? digits : null;

  const countryDigits = (defaultCountry ?? activeDiallingCode()).replace(/\D/g, "");
  if (countryDigits && digits.startsWith(countryDigits)) {
    // Already international.
  } else if (countryDigits && digits.startsWith("0")) {
    digits = countryDigits + digits.slice(1);
  } else if (countryDigits && digits.length <= 9) {
    digits = countryDigits + digits;
  }
  return digits.length >= 8 ? digits : null;
}
