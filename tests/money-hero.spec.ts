/**
 * moneyCompact + moneyHero tests. Locks the format contract so the giant
 * hero numbers on Dashboard + POS never regress into overflow or ambiguity.
 */
import { describe, expect, it } from "vitest";
import { moneyCompact, moneyHero } from "@/lib/money";

describe("moneyCompact", () => {
  it("shows full number below 1 000", () => {
    expect(moneyCompact(0)).toBe("0");
    expect(moneyCompact(1)).toBe("1");
    expect(moneyCompact(999)).toBe("999");
    expect(moneyCompact(999.4)).toBe("999");
  });

  it("uses K for thousands", () => {
    expect(moneyCompact(1_000)).toBe("1.0K");
    expect(moneyCompact(1_234)).toBe("1.2K");
    expect(moneyCompact(9_999)).toBe("10.0K");
    expect(moneyCompact(12_345)).toBe("12K");
    expect(moneyCompact(123_456)).toBe("123K");
    expect(moneyCompact(999_999)).toBe("1000K");
  });

  it("uses M for millions", () => {
    expect(moneyCompact(1_000_000)).toBe("1.00M");
    expect(moneyCompact(1_234_567)).toBe("1.23M");
    expect(moneyCompact(9_876_543)).toBe("9.88M");
    expect(moneyCompact(12_345_678)).toBe("12.3M");
    expect(moneyCompact(123_456_789)).toBe("123M");
  });

  it("uses B for billions", () => {
    expect(moneyCompact(1_500_000_000)).toBe("1.50B");
    expect(moneyCompact(12_300_000_000)).toBe("12.3B");
  });

  it("uses T for trillions", () => {
    expect(moneyCompact(2_500_000_000_000)).toBe("2.5T");
  });

  it("handles negatives", () => {
    expect(moneyCompact(-1_234_567)).toBe("-1.23M");
    expect(moneyCompact(-500)).toBe("-500");
  });
});

describe("moneyHero", () => {
  it("full precision under 1M — the shop needs to see exact daily totals", () => {
    expect(moneyHero(0)).toBe("0");
    expect(moneyHero(245)).toBe("245");
    expect(moneyHero(2_340)).toBe("2,340");
    expect(moneyHero(24_500)).toBe("24,500");
    expect(moneyHero(999_999)).toBe("999,999");
  });

  it("compact from 1M+ so the layout never overflows", () => {
    expect(moneyHero(1_000_000)).toBe("1.00M");
    expect(moneyHero(2_340_000)).toBe("2.34M");
    expect(moneyHero(12_345_678)).toBe("12.3M");
    expect(moneyHero(1_500_000_000)).toBe("1.50B");
  });

  it("negatives (e.g. net loss) still compact when needed", () => {
    expect(moneyHero(-500_000)).toBe("-500,000");
    expect(moneyHero(-2_500_000)).toBe("-2.50M");
  });
});
