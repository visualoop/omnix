import { getCountry } from "@/lib/countries";
import { getBusinessCurrencyCode, useCountry } from "@/stores/country";

export type PaystackCurrency = "KES";

/**
 * Paystack supports KES for the Kenya launch path, but does not natively
 * process UGX, TZS, or RWF. Never convert or relabel those currencies.
 */
export function getPaystackCurrency(): PaystackCurrency {
  const code = useCountry.getState().code;
  const currency = getBusinessCurrencyCode();

  if (code === "KE" && currency === "KES") return "KES";

  if (!code) {
    throw new Error("Paystack payments are unavailable until the business country has loaded.");
  }

  const countryName = getCountry(code)?.name ?? code;
  throw new Error(
    `Paystack does not support ${currency} payments for ${countryName}. ` +
      `No currency conversion was applied; use a payment provider that supports ${currency}.`,
  );
}
