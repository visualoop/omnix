/**
 * Variant constant + helpers — pure logic, no mocks needed.
 *
 * The runtime VARIANT is set from `import.meta.env.VITE_OMNIX_VARIANT` at
 * import time, so tests can't easily flip it after import. Instead we
 * exercise the pure helpers (`variantName`, `modulesAllowedForVariant`,
 * `variantFromLicenseKey`, `isLicenseCompatible`) which take the variant
 * as an argument.
 */
import { describe, it, expect } from "vitest";
import {
  VARIANTS,
  variantName,
  variantTagline,
  variantAccent,
  variantLicensePrefix,
  modulesAllowedForVariant,
  lockedModuleForVariant,
  variantFromLicenseKey,
  ALL_LICENSE_PREFIXES,
} from "@/lib/variant";

describe("variant — names + branding", () => {
  it("each variant has a customer-facing name", () => {
    expect(variantName("pro")).toBe("Omnix");
    expect(variantName("dawa")).toBe("Omnix Dawa");
    expect(variantName("retail")).toBe("Omnix Retail");
    expect(variantName("hospitality")).toBe("Omnix Hospitality");
    expect(variantName("hardware")).toBe("Omnix Hardware");
  });

  it("every variant has a tagline + accent", () => {
    for (const v of VARIANTS) {
      expect(variantTagline(v)).toMatch(/.{10,}/);
      expect(variantAccent(v)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("accents are unique across variants", () => {
    const accents = VARIANTS.map((v) => variantAccent(v));
    expect(new Set(accents).size).toBe(VARIANTS.length);
  });
});

describe("variant — module gates", () => {
  it("Pro allows every trade module + core", () => {
    expect(modulesAllowedForVariant("pro")).toEqual([
      "core",
      "dawa",
      "retail",
      "hospitality",
      "hardware",
    ]);
    expect(lockedModuleForVariant("pro")).toBeNull();
  });

  it("trade variants allow only their module + core", () => {
    expect(modulesAllowedForVariant("dawa")).toEqual(["core", "dawa"]);
    expect(modulesAllowedForVariant("retail")).toEqual(["core", "retail"]);
    expect(modulesAllowedForVariant("hospitality")).toEqual(["core", "hospitality"]);
    expect(modulesAllowedForVariant("hardware")).toEqual(["core", "hardware"]);
  });

  it("locked module matches the variant for trades", () => {
    expect(lockedModuleForVariant("dawa")).toBe("dawa");
    expect(lockedModuleForVariant("retail")).toBe("retail");
    expect(lockedModuleForVariant("hospitality")).toBe("hospitality");
    expect(lockedModuleForVariant("hardware")).toBe("hardware");
  });
});

describe("variant — license prefixes", () => {
  it("every variant has a unique prefix", () => {
    const prefixes = VARIANTS.map((v) => variantLicensePrefix(v));
    expect(new Set(prefixes).size).toBe(VARIANTS.length);
  });

  it("ALL_LICENSE_PREFIXES is comprehensive", () => {
    const expected = VARIANTS.map((v) => variantLicensePrefix(v));
    for (const p of expected) {
      expect(ALL_LICENSE_PREFIXES as readonly string[]).toContain(p);
    }
  });

  it("parses variant from a license key prefix", () => {
    expect(variantFromLicenseKey("OMNIX-DAWA-1234-5678-ABCD-EF01")).toBe("dawa");
    expect(variantFromLicenseKey("OMNIX-RETAIL-1234-5678-ABCD-EF01")).toBe("retail");
    expect(variantFromLicenseKey("OMNIX-HOSP-1234-5678-ABCD-EF01")).toBe("hospitality");
    expect(variantFromLicenseKey("OMNIX-HW-1234-5678-ABCD-EF01")).toBe("hardware");
    expect(variantFromLicenseKey("OMNIX-PRO-1234-5678-ABCD-EF01")).toBe("pro");
  });

  it("returns null for unprefixed legacy keys (treated as Pro by callers)", () => {
    expect(variantFromLicenseKey("ABCD-EFGH-1234-5678-9999")).toBeNull();
    expect(variantFromLicenseKey("OMNIX-1234-5678-9999-ABCD")).toBeNull();
  });

  it("is case-insensitive on prefix detection", () => {
    expect(variantFromLicenseKey("omnix-dawa-1234")).toBe("dawa");
    expect(variantFromLicenseKey("Omnix-Hosp-9999")).toBe("hospitality");
  });
});
