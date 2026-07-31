import { beforeEach, describe, it, expect } from "vitest";
import { toIntlDigits } from "@/lib/phone";
import { useCountry } from "@/stores/country";

describe("toIntlDigits (country-aware phone normalization for wa.me)", () => {
  beforeEach(() => {
    useCountry.setState({ code: "KE", currencyCode: "KES", loaded: true });
  });

  it("converts 0-prefixed Kenyan numbers to 254…", () => {
    expect(toIntlDigits("0712 345 678")).toBe("254712345678");
    expect(toIntlDigits("0112345678")).toBe("254112345678");
  });
  it("strips '+' and spaces from international numbers", () => {
    expect(toIntlDigits("+254 712 345 678")).toBe("254712345678");
  });
  it("prefixes bare subscriber numbers", () => {
    expect(toIntlDigits("712345678")).toBe("254712345678");
  });
  it("leaves already-254 numbers intact", () => {
    expect(toIntlDigits("254712345678")).toBe("254712345678");
  });
  it.each([
    ["KE", "KES", "0712345678", "254712345678"],
    ["UG", "UGX", "0772123456", "256772123456"],
    ["TZ", "TZS", "0712123456", "255712123456"],
    ["RW", "RWF", "0788123456", "250788123456"],
  ] as const)("uses the %s business dialling code", (code, currencyCode, input, expected) => {
    useCountry.setState({ code, currencyCode, loaded: true });
    expect(toIntlDigits(input)).toBe(expected);
  });
  it("returns null for empty/too-short input", () => {
    expect(toIntlDigits("")).toBeNull();
    expect(toIntlDigits(null)).toBeNull();
    expect(toIntlDigits("123")).toBeNull();
  });
});
