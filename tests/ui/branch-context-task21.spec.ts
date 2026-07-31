import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "@/services/branches";

const db = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: db.query,
  execute: db.execute,
  transaction: db.transaction,
}));

import {
  advanceBranchContext,
  assertBranchContextWritable,
  assertCurrentBranchContext,
  captureBranchContext,
  setBranchContextReadOnly,
} from "@/lib/branch-context";
import { runReport } from "@/services/report-builder";
import { getSales } from "@/services/sales";
import { createTransfer } from "@/services/stock-transfers";
import { useActiveBranch } from "@/stores/active-branch";

function branch(id: string): Branch {
  return {
    id,
    code: id.toUpperCase(),
    name: `Branch ${id.toUpperCase()}`,
    address: null,
    phone: null,
    email: null,
    manager_id: null,
    is_default: id === "a" ? 1 : 0,
    active: 1,
    timezone: "Africa/Nairobi",
    kra_pin: null,
    etims_device_id: null,
    open_time: null,
    close_time: null,
    notes: null,
    created_at: "2026-07-31T00:00:00.000Z",
  };
}

const branchA = branch("a");
const branchB = branch("b");

beforeEach(() => {
  db.query.mockReset();
  db.execute.mockReset().mockResolvedValue({ rowsAffected: 1 });
  db.transaction.mockReset().mockResolvedValue(undefined);
  setBranchContextReadOnly(false);
  useActiveBranch.setState({
    active: branchA,
    available: [branchA, branchB],
    loaded: true,
    scope: "branch",
    revision: 1,
  });
});

describe("branch context isolation", () => {
  it("rejects a result captured before a branch switch boundary", () => {
    const generation = captureBranchContext();
    advanceBranchContext();
    expect(() => assertCurrentBranchContext(generation)).toThrow("branch changed");
  });

  it("rejects every write in the explicit All Branches context", () => {
    setBranchContextReadOnly(true);
    expect(() => assertBranchContextWritable()).toThrow("read-only");
  });

  it("does not allow an explicit sales branch to bypass the selected branch", async () => {
    await expect(getSales(50, "b")).rejects.toThrow("Switch to that branch");
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("stock transfer branch authorization", () => {
  const input = {
    from_branch_id: "a",
    to_branch_id: "b",
    user_id: "manager-1",
    items: [{ product_id: "p1", product_name: "Widget", quantity: 2 }],
  };

  it("creates a transfer only when both endpoints are assigned", async () => {
    db.query
      .mockResolvedValueOnce([{ branch_id: "a" }, { branch_id: "b" }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await createTransfer(input);

    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("user_branches"),
      ["manager-1", "a", "b"],
    );
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO stock_transfers"),
      expect.arrayContaining(["a", "b", "manager-1"]),
    );
  });

  it("rejects a transfer destination outside the user's assignments", async () => {
    db.query.mockResolvedValueOnce([{ branch_id: "a" }]);

    await expect(createTransfer(input)).rejects.toThrow("Both transfer branches");
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("manager aggregate authorization", () => {
  it("limits All Branches analytics SQL to assigned branch ids", async () => {
    useActiveBranch.setState({ scope: "all" });
    db.query.mockResolvedValue([]);

    await runReport({
      entity: "sales",
      dimensions: ["day"],
      measures: ["total"],
      filters: {},
    });

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("s.branch_id IN (?1, ?2)"),
      ["a", "b"],
    );
  });
});
