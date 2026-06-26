/**
 * db-maintenance — verify the throttle logic and that maintenance only
 * touches disposable tables (never sales/eTIMS/audit). Pure-logic; the
 * SQL itself is validated by the schema-stale audit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const executeMock = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  execute: (...a: unknown[]) => executeMock(...a),
}));

import { runMaintenanceIfDue, pruneChurn, rollUpSales } from "@/services/db-maintenance";

describe("db maintenance throttle", () => {
  beforeEach(() => {
    queryMock.mockReset();
    executeMock.mockReset();
    executeMock.mockResolvedValue(undefined);
  });

  it("skips when it ran within the last 20h", async () => {
    queryMock.mockResolvedValue([{ value: new Date().toISOString() }]);
    await runMaintenanceIfDue();
    // No work executed (no rollup/prune/optimize/setSetting).
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("runs when never run before", async () => {
    queryMock.mockResolvedValue([]); // no last-run row
    await runMaintenanceIfDue();
    expect(executeMock).toHaveBeenCalled();
    // Records the run timestamp at the end.
    const calls = executeMock.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("maintenance.last_run") || s.includes("INSERT INTO settings"))).toBe(true);
  });

  it("runs when the last run is older than 20h", async () => {
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    queryMock.mockResolvedValue([{ value: old }]);
    await runMaintenanceIfDue();
    expect(executeMock).toHaveBeenCalled();
  });
});

describe("maintenance only prunes disposable data", () => {
  beforeEach(() => {
    executeMock.mockReset();
    executeMock.mockResolvedValue(undefined);
  });

  it("pruneChurn only deletes from ai_calls (never sales/etims/audit)", async () => {
    await pruneChurn();
    const deletes = executeMock.mock.calls.map((c) => String(c[0])).filter((s) => /DELETE/i.test(s));
    expect(deletes.length).toBeGreaterThan(0);
    for (const d of deletes) {
      expect(d).toMatch(/ai_calls/);
      expect(d).not.toMatch(/FROM sales\b|etims|audit_log|sale_items|stock_movements/i);
    }
  });

  it("rollUpSales upserts into sales_daily without deleting raw sales", async () => {
    await rollUpSales(7);
    const sql = executeMock.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/INSERT INTO sales_daily/i);
    expect(sql).not.toMatch(/DELETE FROM sales\b/i);
  });
});
