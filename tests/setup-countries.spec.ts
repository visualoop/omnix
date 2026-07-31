import { describe, expect, it } from "vitest";
import {
  SETUP_COUNTRY_CODES,
  getCountry,
  listCountries,
  listSetupCountries,
} from "@/lib/countries";
import {
  addressPlaceholder,
  formatMoney,
  phonePlaceholder,
  registrationPlaceholder,
  taxIdLabel,
  taxIdPlaceholder,
} from "@/lib/locale";

const LAUNCH_PROFILES = [
  { code: "KE", currencyCode: "KES", symbol: "KSh", phone: "+254", vat: 16, taxId: "KRA PIN" },
  { code: "UG", currencyCode: "UGX", symbol: "USh", phone: "+256", vat: 18, taxId: "URA TIN" },
  { code: "TZ", currencyCode: "TZS", symbol: "TSh", phone: "+255", vat: 18, taxId: "TRA TIN" },
  { code: "RW", currencyCode: "RWF", symbol: "FRw", phone: "+250", vat: 18, taxId: "RRA TIN" },
] as const;

describe("first-run setup countries", () => {
  it("offers exactly Kenya, Uganda, Tanzania, and Rwanda in product order", () => {
    expect(SETUP_COUNTRY_CODES).toEqual(["KE", "UG", "TZ", "RW"]);
    expect(listSetupCountries().map((country) => country.code)).toEqual(["KE", "UG", "TZ", "RW"]);
  });

  it("keeps Burundi's rich profile internally without offering it at first run", () => {
    expect(listCountries().length).toBeGreaterThan(listSetupCountries().length);
    expect(SETUP_COUNTRY_CODES).not.toContain("BI");
    expect(getCountry("BI")).toMatchObject({
      name: "Burundi",
      currencyCode: "BIF",
      currencySymbol: "FBu",
      defaultTaxRate: 18,
      phoneCountryCode: "+257",
    });
  });

  it.each(LAUNCH_PROFILES)(
    "$code has the required currency, dialling code, and VAT profile",
    ({ code, currencyCode, symbol, phone, vat }) => {
      expect(getCountry(code)).toMatchObject({
        currencyCode,
        currencySymbol: symbol,
        phoneCountryCode: phone,
        taxLabel: "VAT",
        defaultTaxRate: vat,
        decimals: 0,
      });
    },
  );
});

describe("launch-country formatting", () => {
  it.each(LAUNCH_PROFILES)("formats $currencyCode with its symbol and zero decimals", ({ code, symbol }) => {
    const zero = formatMoney(0, code);
    const large = formatMoney(987_654_321.6, code);
    expect(zero.startsWith(`${symbol} `)).toBe(true);
    expect(large.startsWith(`${symbol} `)).toBe(true);
    expect(zero).not.toMatch(/[.,]00$/);
    expect(large).not.toMatch(/[.,]\d{1,2}$/);
    expect(large.replace(/\D/g, "")).toBe("987654322");
  });
});

describe("country-driven field metadata", () => {
  it.each(LAUNCH_PROFILES)("uses $taxId and local contact examples for $code", ({ code, phone, taxId }) => {
    expect(taxIdLabel(code)).toBe(taxId);
    expect(taxIdPlaceholder(code)).not.toBe("");
    expect(phonePlaceholder(code)).toContain(phone);
    expect(addressPlaceholder(code)).not.toMatch(/Enter the business street/);
    expect(registrationPlaceholder(code)).toBe("Enter the business registration number");
  });

  it("uses neutral placeholders before a country is active", () => {
    expect(addressPlaceholder(null)).toBe("Enter the business street, town, and region");
    expect(taxIdLabel(null)).toBe("Tax identification number");
    expect(taxIdPlaceholder(null)).toBe("Enter the business tax ID");
  });
});
