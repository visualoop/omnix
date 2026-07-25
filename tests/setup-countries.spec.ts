import { describe, expect, it } from "vitest";
import {
  SETUP_COUNTRY_CODES,
  getCountry,
  listCountries,
  listSetupCountries,
} from "@/lib/countries";

describe("first-run setup countries", () => {
  it("offers exactly the five supported East African markets in product order", () => {
    expect(SETUP_COUNTRY_CODES).toEqual(["KE", "UG", "TZ", "RW", "BI"]);
    expect(listSetupCountries().map((country) => country.code)).toEqual([
      "KE",
      "UG",
      "TZ",
      "RW",
      "BI",
    ]);
  });

  it("keeps the broader internal country registry available", () => {
    expect(listCountries().length).toBeGreaterThan(listSetupCountries().length);
    expect(getCountry("GH")?.name).toBe("Ghana");
  });

  it("uses a rich Burundi profile instead of generic USD defaults", () => {
    const burundi = getCountry("BI");
    expect(burundi).toMatchObject({
      name: "Burundi",
      currencyCode: "BIF",
      currencySymbol: "FBu",
      decimals: 0,
      taxLabel: "VAT",
      defaultTaxRate: 18,
      phoneCountryCode: "+257",
      intlLocale: "fr-BI",
    });
    expect(burundi?.phonePlaceholder).not.toBe("");
    expect(burundi?.paymentMethods).toContain("airtel_money");
  });
});
