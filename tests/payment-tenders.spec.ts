import { describe, it, expect } from "vitest";
import { buildFinalTenders, type PaymentEntry } from "@/services/sales";

const cash = (amount: number): PaymentEntry => ({ method_id: "cash", method_name: "Cash", amount });

describe("buildFinalTenders — split-payment money bug", () => {
  it("flushes a pending manual M-Pesa remainder that was typed but not 'Added'", () => {
    // Total 1000: cash 500 Added, M-Pesa 500 + code typed but not Added.
    const out = buildFinalTenders({
      addedPayments: [cash(500)],
      pendingAmount: 500,
      pendingMethodId: "mpesa-manual",
      pendingMethodName: "M-Pesa",
      pendingReference: "QGR7XYZ123",
      pendingIsAsync: false,
      saleTotal: 1000,
    });
    const paid = out.reduce((s, p) => s + p.amount, 0);
    expect(paid).toBe(1000); // was 500 (partial) before the fix
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ method_id: "mpesa-manual", amount: 500, reference: "QGR7XYZ123" });
  });

  it("does NOT flush async tenders (STK/Paystack) — they add themselves on success", () => {
    const out = buildFinalTenders({
      addedPayments: [cash(500)],
      pendingAmount: 500,
      pendingMethodId: "mpesa-manual",
      pendingMethodName: "M-Pesa",
      pendingIsAsync: true, // Daraja/Paystack active
      saleTotal: 1000,
    });
    expect(out).toHaveLength(1);
    expect(out.reduce((s, p) => s + p.amount, 0)).toBe(500);
  });

  it("caps a flushed cash over-tender at the remaining balance (change not booked as revenue)", () => {
    // Total 1000: M-Pesa 600 Added, cashier keys 1000 cash (change 600).
    const out = buildFinalTenders({
      addedPayments: [{ method_id: "mpesa-manual", method_name: "M-Pesa", amount: 600 }],
      pendingAmount: 1000,
      pendingMethodId: "cash",
      pendingMethodName: "Cash",
      pendingIsAsync: false,
      saleTotal: 1000,
    });
    const paid = out.reduce((s, p) => s + p.amount, 0);
    expect(paid).toBe(1000); // cash flushed as 400, not 1000
    expect(out[1]).toMatchObject({ method_id: "cash", amount: 400 });
  });

  it("single payment (nothing Added) uses the typed amount", () => {
    const out = buildFinalTenders({
      addedPayments: [],
      pendingAmount: 750,
      pendingMethodId: "cash",
      pendingMethodName: "Cash",
      pendingIsAsync: false,
      saleTotal: 750,
    });
    expect(out).toEqual([{ method_id: "cash", method_name: "Cash", amount: 750, reference: undefined }]);
  });

  it("single payment with no typed amount falls back to the full total", () => {
    const out = buildFinalTenders({
      addedPayments: [],
      pendingAmount: 0,
      pendingMethodId: "cash",
      pendingMethodName: "Cash",
      pendingIsAsync: false,
      saleTotal: 900,
    });
    expect(out[0].amount).toBe(900);
  });
});
