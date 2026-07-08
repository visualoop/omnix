/**
 * equipment-v50.spec.ts — Equipment DMS Phase 1.
 *
 * Covers the pure warranty math + status-transition rules, spec JSON
 * handling, and the two write paths (receiveEquipmentUnits, finalizeEquipmentSale)
 * with the DB layer mocked. The tauri-backed modules are mocked so the
 * service imports cleanly in jsdom.
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
vi.mock("@/services/license", () => ({ assertModuleEntitled: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/services/rbac", () => ({ requirePermission: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/stores/active-branch", () => ({ getActiveBranchId: () => "" }));

import {
  addMonths, computeWarranty, warrantyState, warrantyDaysRemaining,
  canTransition, parseSpecs, specSummary,
  receiveEquipmentUnits, finalizeEquipmentSale,
} from "@/services/equipment";

beforeEach(() => {
  query.mockReset();
  execute.mockReset();
  transaction.mockReset();
});

describe("addMonths — calendar month math with end-of-month clamp", () => {
  it("adds whole months", () => {
    expect(addMonths("2024-01-15T00:00:00.000Z", 12).slice(0, 10)).toBe("2025-01-15");
    expect(addMonths("2024-03-10T00:00:00.000Z", 6).slice(0, 10)).toBe("2024-09-10");
  });
  it("clamps to the last day of a shorter target month", () => {
    // Jan 31 + 1 month → Feb (29 in a leap year, 28 otherwise)
    expect(addMonths("2024-01-31T00:00:00.000Z", 1).slice(0, 10)).toBe("2024-02-29");
    expect(addMonths("2023-01-31T00:00:00.000Z", 1).slice(0, 10)).toBe("2023-02-28");
  });
  it("returns the start unchanged for zero / negative months", () => {
    expect(addMonths("2024-06-01T00:00:00.000Z", 0).slice(0, 10)).toBe("2024-06-01");
    expect(addMonths("2024-06-01T00:00:00.000Z", -3).slice(0, 10)).toBe("2024-06-01");
  });
});

describe("computeWarranty", () => {
  it("returns nulls when there is no warranty", () => {
    expect(computeWarranty("2024-01-01T00:00:00.000Z", null)).toEqual({ start: null, expiry: null, months: null });
    expect(computeWarranty("2024-01-01T00:00:00.000Z", 0)).toEqual({ start: null, expiry: null, months: null });
  });
  it("sets start = sale date and expiry = +months", () => {
    const w = computeWarranty("2024-01-01T00:00:00.000Z", 24);
    expect(w.start).toBe("2024-01-01T00:00:00.000Z");
    expect(w.expiry?.slice(0, 10)).toBe("2026-01-01");
    expect(w.months).toBe(24);
  });
});

describe("warrantyState + warrantyDaysRemaining", () => {
  const now = new Date("2024-06-01T00:00:00.000Z");
  it("classifies none / active / expiring / expired", () => {
    expect(warrantyState(null, now)).toBe("none");
    expect(warrantyState("2025-01-01T00:00:00.000Z", now)).toBe("active");
    expect(warrantyState("2024-06-20T00:00:00.000Z", now)).toBe("expiring"); // within 30d
    expect(warrantyState("2024-05-01T00:00:00.000Z", now)).toBe("expired");
  });
  it("honours a custom expiring window", () => {
    expect(warrantyState("2024-07-15T00:00:00.000Z", now, 60)).toBe("expiring");
  });
  it("computes days remaining (negative when expired)", () => {
    expect(warrantyDaysRemaining("2024-06-11T00:00:00.000Z", now)).toBe(10);
    expect(warrantyDaysRemaining("2024-05-22T00:00:00.000Z", now)).toBe(-10);
    expect(warrantyDaysRemaining(null, now)).toBeNull();
  });
});

describe("canTransition — unit lifecycle rules", () => {
  it("allows sensible moves", () => {
    expect(canTransition("in_stock", "sold")).toBe(true);
    expect(canTransition("in_stock", "reserved")).toBe(true);
    expect(canTransition("sold", "in_service")).toBe(true);
    expect(canTransition("reserved", "in_stock")).toBe(true);
    expect(canTransition("sold", "sold")).toBe(true); // idempotent
  });
  it("blocks illegal moves", () => {
    expect(canTransition("sold", "in_stock")).toBe(false);
    expect(canTransition("written_off", "sold")).toBe(false);
    expect(canTransition("written_off", "in_stock")).toBe(false);
  });
});

describe("spec helpers", () => {
  it("parseSpecs tolerates null + malformed JSON", () => {
    expect(parseSpecs(null)).toEqual({});
    expect(parseSpecs("not json")).toEqual({});
    expect(parseSpecs('{"make":"CAT"}')).toEqual({ make: "CAT" });
  });
  it("specSummary joins make · model · rating", () => {
    expect(specSummary('{"make":"CAT","model":"320D","rating":"20 t"}')).toBe("CAT · 320D · 20 t");
    expect(specSummary('{"make":"FG Wilson","engine_power":"30 kVA"}')).toBe("FG Wilson · 30 kVA");
    expect(specSummary(null)).toBe("");
  });
});

describe("receiveEquipmentUnits", () => {
  it("rejects duplicate serials within the batch before any write", async () => {
    await expect(
      receiveEquipmentUnits("prod1", [
        { serial_number: "SN1" },
        { serial_number: "SN1" },
      ], { userId: "u1" }),
    ).rejects.toThrow(/Duplicate serial/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a serial that already exists in the fleet", async () => {
    query.mockResolvedValueOnce([{ serial_number: "SN9" }]); // existing check
    await expect(
      receiveEquipmentUnits("prod1", [{ serial_number: "SN9" }], { userId: "u1" }),
    ).rejects.toThrow(/already exists/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("writes batch + movement + unit per serial in one transaction", async () => {
    query.mockResolvedValueOnce([]); // no existing serials
    transaction.mockResolvedValueOnce(undefined);
    const ids = await receiveEquipmentUnits(
      "prod1",
      [{ serial_number: "SN1", acquisition_cost: 100 }, { serial_number: "SN2" }],
      { userId: "u1" },
    );
    expect(ids).toHaveLength(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    const stmts = transaction.mock.calls[0][0] as unknown[];
    expect(stmts).toHaveLength(6); // 2 units × (batch + movement + unit)
  });
});

describe("finalizeEquipmentSale", () => {
  it("does nothing when no line carries a unit", async () => {
    await finalizeEquipmentSale([{ equipment_unit_id: null }], "sale1", "cust1");
    expect(execute).not.toHaveBeenCalled();
  });

  it("flips an in-stock unit to sold with computed warranty", async () => {
    query
      .mockResolvedValueOnce([{ status: "in_stock", product_id: "prod1" }]) // unit lookup
      .mockResolvedValueOnce([{ warranty_months: 12 }]);                    // product default
    execute.mockResolvedValue(undefined);
    await finalizeEquipmentSale(
      [{ equipment_unit_id: "unit1" }],
      "sale1",
      "cust1",
      "2024-01-01T00:00:00.000Z",
    );
    expect(execute).toHaveBeenCalledTimes(1);
    const params = execute.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("unit1");
    expect(params[1]).toBe("sale1");
    expect(params[2]).toBe("cust1");
    // warranty_expiry (index 6) is one year after the sale date
    expect(String(params[6]).slice(0, 10)).toBe("2025-01-01");
  });

  it("skips a unit that is already sold", async () => {
    query.mockResolvedValueOnce([{ status: "sold", product_id: "prod1" }]);
    await finalizeEquipmentSale([{ equipment_unit_id: "unit1" }], "sale1", null);
    expect(execute).not.toHaveBeenCalled();
  });
});
