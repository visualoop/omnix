/**
 * Correctness-fix coverage: money rounding, copay invariant, tax rounding,
 * and the transaction batch builder. These guard the audit fixes
 * (transactions, integer-cents money, insurance split).
 */
import { describe, it, expect } from "vitest";
import { round2, toCents, fromCents, sumMoney, addMoney, subMoney } from "@/lib/money";
import { inlineParams } from "@/lib/db";
import { calculateCopay } from "@/services/insurance";
import type { InsuranceMember } from "@/services/insurance";

describe("money arithmetic (no float drift)", () => {
  it("round2 fixes classic float error", () => {
    expect(round2(86.2068965)).toBe(86.21);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.675)).toBe(2.68); // half-up, EPSILON-corrected
  });

  it("toCents / fromCents are exact round-trips", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(fromCents(1999)).toBe(19.99);
    expect(fromCents(toCents(1234.56))).toBe(1234.56);
  });

  it("sumMoney avoids accumulation drift over many rows", () => {
    const many = Array.from({ length: 1000 }, () => 0.1);
    // Naive float sum drifts (99.9999…); sumMoney is exact.
    expect(sumMoney(many)).toBe(100);
  });

  it("addMoney / subMoney are exact", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subMoney(100, 0.1)).toBe(99.9);
  });
});

describe("transaction batch builder (inlineParams)", () => {
  it("substitutes positional params with typed literals", () => {
    expect(inlineParams("INSERT INTO t (a,b) VALUES (?1,?2)", ["x", 5])).toBe(
      "INSERT INTO t (a,b) VALUES ('x',5)",
    );
  });

  it("escapes single quotes to prevent breaking the batch", () => {
    expect(inlineParams("WHERE name = ?1", ["O'Brien"])).toBe("WHERE name = 'O''Brien'");
  });

  it("maps null/undefined to SQL NULL", () => {
    expect(inlineParams("VALUES (?1, ?2)", [null, undefined])).toBe("VALUES (NULL, NULL)");
  });

  it("maps booleans to 1/0 and non-finite numbers to NULL", () => {
    expect(inlineParams("VALUES (?1, ?2, ?3)", [true, false, NaN])).toBe("VALUES (1, 0, NULL)");
  });

  it("reuses the same param index multiple times", () => {
    expect(inlineParams("WHERE a = ?1 OR b = ?1", [7])).toBe("WHERE a = 7 OR b = 7");
  });
});

describe("insurance copay split — copay + claim === gross, to the cent", () => {
  const member = (pct: number, fixed: number): InsuranceMember =>
    ({
      id: "m1",
      member_number: "X",
      full_name: "Test",
      copay_percentage: pct,
      copay_fixed: fixed,
    }) as unknown as InsuranceMember;

  it("percentage copay reconstructs the gross exactly", () => {
    const { copay, claim } = calculateCopay(member(20, 0), 999.99);
    expect(round2(copay + claim)).toBe(999.99);
  });

  it("fixed + percentage copay reconstructs the gross", () => {
    const { copay, claim } = calculateCopay(member(10, 50), 1234.55);
    expect(round2(copay + claim)).toBe(1234.55);
  });

  it("copay never exceeds gross (claim floors at 0)", () => {
    const { copay, claim } = calculateCopay(member(0, 5000), 1000);
    expect(copay).toBe(1000);
    expect(claim).toBe(0);
  });

  it("awkward thirds still reconcile to the cent", () => {
    for (const gross of [33.33, 66.67, 100.01, 0.03, 7777.77]) {
      const { copay, claim } = calculateCopay(member(33, 0), gross);
      expect(Math.round(copay * 100) + Math.round(claim * 100)).toBe(Math.round(gross * 100));
    }
  });
});
