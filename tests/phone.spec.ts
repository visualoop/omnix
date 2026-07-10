import { describe, it, expect } from "vitest";
import { toIntlDigits } from "@/lib/phone";

describe("toIntlDigits (KE phone normalization for wa.me)", () => {
  it("converts 0-prefixed local numbers to 254…", () => {
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
  it("returns null for empty/too-short input", () => {
    expect(toIntlDigits("")).toBeNull();
    expect(toIntlDigits(null)).toBeNull();
    expect(toIntlDigits("123")).toBeNull();
  });
});
