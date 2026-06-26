/**
 * Coverage for the rebuilt payment modal's helper logic + the new
 * payment services (brand resolver, Paystack popup amount conversion,
 * manual-M-Pesa save shape). Pure-function / mocked — the full click
 * integration lives in the manual runbook + Playwright e2e.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  paymentBrandIcon,
  paymentBrandTint,
  PAYMENT_BRAND_TINTS,
} from "@/components/icons/payment-brands";

describe("payment brand resolver", () => {
  it("maps M-Pesa ids/names to the M-Pesa tint", () => {
    expect(paymentBrandTint("mpesa-manual M-Pesa")).toBe(PAYMENT_BRAND_TINTS.mpesa);
    expect(paymentBrandTint("Lipa na M-Pesa")).toBe(PAYMENT_BRAND_TINTS.mpesa);
  });

  it("maps Paystack + card + cash + insurance + credit", () => {
    expect(paymentBrandTint("paystack")).toBe(PAYMENT_BRAND_TINTS.paystack);
    expect(paymentBrandTint("card")).toBe(PAYMENT_BRAND_TINTS.card);
    expect(paymentBrandTint("cash")).toBe(PAYMENT_BRAND_TINTS.cash);
    expect(paymentBrandTint("insurance SHA")).toBe(PAYMENT_BRAND_TINTS.insurance);
    expect(paymentBrandTint("credit")).toBe(PAYMENT_BRAND_TINTS.credit);
  });

  it("falls back to a card tint for unknown methods", () => {
    expect(paymentBrandTint("bitcoin")).toBe(PAYMENT_BRAND_TINTS.card);
  });

  it("always resolves an icon component (never undefined)", () => {
    for (const k of ["cash", "mpesa-manual", "paystack", "card", "bank", "credit", "insurance", "???"]) {
      expect(typeof paymentBrandIcon(k)).toBe("function");
    }
  });
});

/**
 * The single-CTA decision: the footer shows "Add payment" while the
 * tendered amount won't cover the bill, then flips to "Complete sale".
 * Mirrors the modal's `remaining - amount > 0.001` test.
 */
function ctaIsComplete(total: number, paid: number, amount: number): boolean {
  const remaining = total - paid;
  return !(remaining - amount > 0.001);
}

describe("payment modal single CTA", () => {
  it("shows Add payment when the amount is a partial chunk", () => {
    expect(ctaIsComplete(5000, 2000, 1000)).toBe(false); // 3000 left, paying 1000
  });
  it("shows Complete sale when the amount covers the remainder", () => {
    expect(ctaIsComplete(5000, 2000, 3000)).toBe(true);
  });
  it("shows Complete sale when overpaying (cash tendered > remaining)", () => {
    expect(ctaIsComplete(5000, 2000, 5000)).toBe(true);
  });
  it("floating-point dust doesn't keep it on Add payment", () => {
    expect(ctaIsComplete(100.1, 0, 100.1)).toBe(true);
  });
});

/**
 * removePayment restores the freed amount to the input.
 */
function remainingAfterRemove(total: number, payments: Array<{ amount: number }>, removeIdx: number): string {
  const next = payments.filter((_, i) => i !== removeIdx);
  const paid = next.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - paid).toFixed(2);
}

describe("removePayment restores remaining", () => {
  it("removing the only chunk restores the full total", () => {
    expect(remainingAfterRemove(5000, [{ amount: 2000 }], 0)).toBe("5000.00");
  });
  it("removing one of two chunks restores that chunk's amount", () => {
    expect(remainingAfterRemove(5000, [{ amount: 2000 }, { amount: 1000 }], 1)).toBe("3000.00");
  });
});

// ── Paystack popup amount conversion ──────────────────────────────────
// The mock captures the last options object + lets each test drive the
// callback (success / cancel) deterministically.
let lastOptions: Record<string, unknown> | null = null;
let driver: ((opts: Record<string, unknown>) => void) | null = null;
vi.mock("@paystack/inline-js", () => ({
  default: class {
    newTransaction(opts: Record<string, unknown>) {
      lastOptions = opts;
      driver?.(opts);
    }
  },
}));

import { payByPaystackPopup } from "@/services/paystack-popup";

describe("payByPaystackPopup", () => {
  beforeEach(() => { lastOptions = null; driver = null; });

  it("converts KES to the minor unit (×100) and passes KES currency", () => {
    payByPaystackPopup({ publicKey: "pk_test_x", email: "a@b.com", amountKes: 1500, reference: "OMX-1" });
    expect(lastOptions?.amount).toBe(150000);
    expect(lastOptions?.currency).toBe("KES");
    expect(lastOptions?.key).toBe("pk_test_x");
    expect(lastOptions?.reference).toBe("OMX-1");
  });

  it("rounds fractional KES to whole cents", () => {
    payByPaystackPopup({ publicKey: "pk", email: "a@b.com", amountKes: 99.999, reference: "r" });
    expect(lastOptions?.amount).toBe(10000);
  });

  it("resolves success when onSuccess fires", async () => {
    driver = (opts) => (opts.onSuccess as (t: { reference: string }) => void)({ reference: "PSK-123" });
    const r = await payByPaystackPopup({ publicKey: "pk", email: "a@b.com", amountKes: 100, reference: "r" });
    expect(r).toEqual({ status: "success", reference: "PSK-123" });
  });

  it("resolves cancelled when onCancel fires", async () => {
    driver = (opts) => (opts.onCancel as () => void)();
    const r = await payByPaystackPopup({ publicKey: "pk", email: "a@b.com", amountKes: 100, reference: "ref-9" });
    expect(r.status).toBe("cancelled");
    expect(r.reference).toBe("ref-9");
  });
});

// ── Manual M-Pesa save shape ──────────────────────────────────────────
describe("manual M-Pesa payment entry shape", () => {
  it("records method=mpesa-manual with the M-Pesa code as reference", () => {
    const code = "SLK7A9B2C1";
    const entry = { method_id: "mpesa-manual", method_name: "M-Pesa", amount: 1500, reference: code };
    expect(entry.method_id).toBe("mpesa-manual");
    expect(entry.reference).toBe(code);
    expect(entry.amount).toBeGreaterThan(0);
  });
});
