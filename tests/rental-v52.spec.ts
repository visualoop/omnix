/**
 * rental-v52.spec.ts — Equipment DMS Phase 3 (rental fleet integration).
 *
 * Verifies that hiring out a unit flips it to `rented` + records meter-out,
 * that returning flips it back + records meter-in, and that a unit which
 * isn't free to hire is rejected. DB layer mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
const execute = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/db", () => ({
  query: (...a: unknown[]) => query(...a),
  execute: (...a: unknown[]) => execute(...a),
  transaction: (...a: unknown[]) => transaction(...a),
}));

import { createRentalAgreement, returnRental } from "@/services/operations";

beforeEach(() => {
  query.mockReset();
  execute.mockReset();
  transaction.mockReset();
});

describe("createRentalAgreement — unit integration", () => {
  it("flips a hired unit to rented and records meter_out", async () => {
    query
      .mockResolvedValueOnce([{ n: "2" }])                          // agreement number
      .mockResolvedValueOnce([{ id: "u1", status: "in_stock" }]);  // unit availability guard
    transaction.mockResolvedValueOnce(undefined);

    await createRentalAgreement({
      customer_id: "c1",
      starts_at: "2026-07-01",
      ends_at: "2026-07-08",
      items: [{ product_id: "p1", equipment_unit_id: "u1", daily_rate: 5000, meter_out: 1200 }],
    });

    const stmts = transaction.mock.calls[0][0] as { sql: string; params: unknown[] }[];
    // agreement insert + item insert + unit → rented
    expect(stmts).toHaveLength(3);
    expect(stmts[1].sql).toMatch(/rental_items/);
    expect(stmts[1].params).toContain(1200);      // meter_out captured
    expect(stmts[2].sql).toMatch(/status = 'rented'/);
  });

  it("rejects a unit that isn't free to hire", async () => {
    query
      .mockResolvedValueOnce([{ n: "0" }])
      .mockResolvedValueOnce([{ id: "u1", status: "in_service" }]);
    await expect(
      createRentalAgreement({
        customer_id: "c1", starts_at: "2026-07-01", ends_at: "2026-07-08",
        items: [{ product_id: "p1", equipment_unit_id: "u1", daily_rate: 5000 }],
      }),
    ).rejects.toThrow(/not available to hire/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("handles non-serial items without touching units", async () => {
    query.mockResolvedValueOnce([{ n: "5" }]); // number only (no unit guard query)
    transaction.mockResolvedValueOnce(undefined);
    await createRentalAgreement({
      customer_id: "c1", starts_at: "2026-07-01", ends_at: "2026-07-08",
      items: [{ product_id: "p1", daily_rate: 500 }],
    });
    const stmts = transaction.mock.calls[0][0] as { sql: string }[];
    // agreement + item only — no unit update
    expect(stmts).toHaveLength(2);
    expect(stmts.some((s) => s.sql.includes("equipment_units"))).toBe(false);
  });
});

describe("returnRental — unit integration", () => {
  it("flips the unit back to its resting state and records meter_in", async () => {
    query.mockResolvedValueOnce([{ id: "ri1", equipment_unit_id: "u1" }]); // items
    transaction.mockResolvedValueOnce(undefined);

    await returnRental("agr1", { damageFee: 1500, condition: "Scratched panel", meterIn: { ri1: 1360 } });

    const stmts = transaction.mock.calls[0][0] as { sql: string; params: unknown[] }[];
    // agreement update + item update + unit update
    expect(stmts).toHaveLength(3);
    expect(stmts[0].params).toContain(1500);       // damage fee
    expect(stmts[1].params).toContain(1360);       // meter_in on the item
    expect(stmts[2].sql).toMatch(/CASE WHEN sale_id/); // resting-state logic
    expect(stmts[2].params).toContain(1360);       // meter written to the unit
  });

  it("returns cleanly when there are no serialized units", async () => {
    query.mockResolvedValueOnce([{ id: "ri1", equipment_unit_id: null }]);
    transaction.mockResolvedValueOnce(undefined);
    await returnRental("agr1", {});
    const stmts = transaction.mock.calls[0][0] as { sql: string }[];
    expect(stmts).toHaveLength(2); // agreement + item, no unit update
  });
});
