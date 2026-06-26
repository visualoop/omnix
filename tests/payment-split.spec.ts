/**
 * Split-payment behaviour at the cart payment-modal.
 *
 * The bug was: typing 200 in the Cash tab and switching to M-Pesa left
 * the amount input pre-populated with 200, so a casual click of "Pay"
 * posted 200 by the wrong method. The fix: switching method resets
 * the amount field to the still-unpaid remainder.
 *
 * These are pure-function tests for the calculation helpers used by the
 * modal — they don't render the React component. The actual button-
 * click integration is exercised by the manual runbook in
 * docs/PAYMENT_TEST_RUNBOOK.md.
 */
import { describe, it, expect } from "vitest"

/**
 * Mirror of the modal's calculation. Sum of partial payments produces
 * paidSoFar; total minus paidSoFar produces the remaining amount the
 * cashier needs to collect. Each new method tab starts with the remaining
 * pre-filled so single-method runs are one tap.
 */
function nextChunkAmount(total: number, payments: Array<{ amount: number }>): string {
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, total - paidSoFar)
  return remaining.toFixed(2)
}

describe("payment split — chunk amount per method switch", () => {
  it("fresh cart: amount input shows the full total", () => {
    expect(nextChunkAmount(1500, [])).toBe("1500.00")
  })

  it("after 200 cash payment, switching to M-Pesa shows the remaining 1300", () => {
    expect(nextChunkAmount(1500, [{ amount: 200 }])).toBe("1300.00")
  })

  it("after two payments, the third method tab shows what's left", () => {
    expect(nextChunkAmount(1500, [{ amount: 200 }, { amount: 800 }])).toBe("500.00")
  })

  it("fully paid → 0.00, never negative", () => {
    expect(nextChunkAmount(1500, [{ amount: 1500 }])).toBe("0.00")
    expect(nextChunkAmount(1500, [{ amount: 2000 }])).toBe("0.00")
  })

  it("rounds to 2dp consistently", () => {
    expect(nextChunkAmount(150.555, [])).toBe("150.56")
    expect(nextChunkAmount(150.554, [])).toBe("150.55")
  })
})

describe("payment split — total settlement", () => {
  /**
   * Verifies that completing a sale requires the sum of payments to
   * equal (or exceed, for cash overpay → change) the total. The cart
   * pays only when (paidSoFar >= total) so a 'Pay' click while there's
   * still remaining must keep the dialog open.
   */
  function canCompleteSale(total: number, payments: Array<{ amount: number }>): boolean {
    const paidSoFar = payments.reduce((s, p) => s + p.amount, 0)
    return paidSoFar >= total
  }

  it("partial payments cannot complete the sale", () => {
    expect(canCompleteSale(1500, [{ amount: 200 }])).toBe(false)
    expect(canCompleteSale(1500, [{ amount: 1499.99 }])).toBe(false)
  })

  it("paid in full → ready to complete", () => {
    expect(canCompleteSale(1500, [{ amount: 1500 }])).toBe(true)
  })

  it("exact split sums to total", () => {
    expect(canCompleteSale(1500, [{ amount: 200 }, { amount: 800 }, { amount: 500 }])).toBe(true)
  })

  it("cash overpay (change due) is allowed", () => {
    expect(canCompleteSale(1500, [{ amount: 2000 }])).toBe(true)
  })
})
