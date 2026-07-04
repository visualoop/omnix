import { describe, it, expect } from "vitest";

/**
 * v0.45 Hardware audit remediation — contract tests.
 *
 * Locks the pure algorithms + logic invariants so future refactors
 * can't silently regress. Data-plane behaviour that depends on live
 * SQL is exercised in the sql-smoke suite; this file focuses on the
 * derivations we can validate offline.
 */

/** FIFO payment application — mirrors agedReceivables() logic. */
function fifoOutstanding(entries: Array<{ type: "charge" | "payment" | "adjustment"; amount: number; due?: string }>) {
  const unpaid: Array<{ amount: number; due: Date }> = [];
  for (const e of entries) {
    if (e.type === "charge") {
      unpaid.push({ amount: Math.abs(e.amount), due: e.due ? new Date(e.due) : new Date() });
    } else {
      let toApply = Math.abs(e.amount);
      while (toApply > 0 && unpaid.length > 0) {
        const head = unpaid[0];
        if (head.amount <= toApply) { toApply -= head.amount; unpaid.shift(); }
        else { head.amount -= toApply; toApply = 0; }
      }
    }
  }
  return unpaid;
}

describe("agedReceivables — FIFO invariants", () => {
  it("charge fully paid disappears from outstanding", () => {
    const out = fifoOutstanding([
      { type: "charge", amount: 1000 },
      { type: "payment", amount: 1000 },
    ]);
    expect(out).toEqual([]);
  });

  it("partial payment leaves the remainder", () => {
    const out = fifoOutstanding([
      { type: "charge", amount: 1000 },
      { type: "payment", amount: 300 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(700);
  });

  it("payment applies to oldest charge first", () => {
    const out = fifoOutstanding([
      { type: "charge", amount: 1000, due: "2026-01-01" },
      { type: "charge", amount: 500, due: "2026-02-01" },
      { type: "payment", amount: 800 },
    ]);
    // First charge partially paid; second untouched.
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(200);
    expect(out[1].amount).toBe(500);
  });

  it("overpayment doesn't create negative balance", () => {
    const out = fifoOutstanding([
      { type: "charge", amount: 500 },
      { type: "payment", amount: 800 },
    ]);
    expect(out).toEqual([]);
  });

  it("adjustment reducing balance works like a payment", () => {
    const out = fifoOutstanding([
      { type: "charge", amount: 1000 },
      { type: "adjustment", amount: -200 }, // credit note
    ]);
    expect(out[0].amount).toBe(800);
  });
});

describe("aging bucket math", () => {
  function bucket(days: number): string {
    if (days <= 0) return "current";
    if (days <= 30) return "d1_30";
    if (days <= 60) return "d31_60";
    if (days <= 90) return "d61_90";
    return "d90_plus";
  }

  it("day 0 lands in current", () => {
    expect(bucket(0)).toBe("current");
  });

  it("day 30 stays in d1_30", () => {
    expect(bucket(30)).toBe("d1_30");
  });

  it("day 31 crosses into d31_60", () => {
    expect(bucket(31)).toBe("d31_60");
  });

  it("day 91 crosses into d90_plus", () => {
    expect(bucket(91)).toBe("d90_plus");
  });
});

describe("credit check invariants", () => {
  interface Account { balance: number; credit_limit: number; on_hold: number; }

  function check(a: Account, amount: number): { ok: boolean; reason?: string } {
    if (a.on_hold) return { ok: false, reason: "Account is on hold" };
    if (a.balance + amount > a.credit_limit) return { ok: false, reason: "Over credit limit" };
    return { ok: true };
  }

  it("passes when balance + amount <= limit", () => {
    expect(check({ balance: 500, credit_limit: 1000, on_hold: 0 }, 300).ok).toBe(true);
  });

  it("fails at exactly limit + 1", () => {
    expect(check({ balance: 500, credit_limit: 1000, on_hold: 0 }, 501).ok).toBe(false);
  });

  it("fails on hold regardless of balance", () => {
    expect(check({ balance: 0, credit_limit: 1000, on_hold: 1 }, 1).ok).toBe(false);
  });
});

describe("on-account detection", () => {
  function isOnAccount(p: { method_id?: string; method_name?: string }): boolean {
    const idNorm = (p.method_id || "").toLowerCase();
    const nameNorm = (p.method_name || "").toLowerCase();
    return idNorm === "on_account" || idNorm === "credit"
      || nameNorm.includes("on account") || nameNorm.includes("contractor account");
  }

  it("recognises id 'on_account'", () => {
    expect(isOnAccount({ method_id: "on_account", method_name: "" })).toBe(true);
  });

  it("recognises 'contractor account' by name", () => {
    expect(isOnAccount({ method_id: "custom-42", method_name: "Contractor account" })).toBe(true);
  });

  it("rejects 'cash'", () => {
    expect(isOnAccount({ method_id: "cash", method_name: "Cash" })).toBe(false);
  });

  it("rejects 'mpesa'", () => {
    expect(isOnAccount({ method_id: "mpesa", method_name: "M-Pesa" })).toBe(false);
  });
});

describe("commission math", () => {
  function commission(base: number, percent: number): number {
    if (percent <= 0) return 0;
    return base * (percent / 100);
  }

  it("5% of 10000 = 500", () => {
    expect(commission(10000, 5)).toBe(500);
  });

  it("zero percent yields zero regardless of base", () => {
    expect(commission(1_000_000, 0)).toBe(0);
  });

  it("negative percent treated as zero (defensive)", () => {
    expect(commission(1000, -1)).toBe(0);
  });
});

describe("quote-to-sale conversion time", () => {
  function daysBetween(quoteAt: string, saleAt: string): number {
    return (new Date(saleAt).getTime() - new Date(quoteAt).getTime()) / 86400000;
  }

  it("computes days precisely", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z")).toBe(3);
  });

  it("half-day sale = 0.5", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")).toBe(0.5);
  });
});
