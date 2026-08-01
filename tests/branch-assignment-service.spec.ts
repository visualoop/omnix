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
  getOrRepairUserBranches,
  removeUserFromBranch,
} from "@/services/branches";

const realBranch: Branch = {
  id: "real-branch-id",
  code: "MAIN",
  name: "Main Branch",
  address: null,
  phone: null,
  email: null,
  manager_id: null,
  is_default: 1,
  active: 1,
  timezone: "Africa/Nairobi",
  kra_pin: null,
  etims_device_id: null,
  open_time: null,
  close_time: null,
  notes: null,
  created_at: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  db.query.mockReset();
  db.execute.mockReset().mockResolvedValue({ rowsAffected: 1 });
  db.transaction.mockReset().mockResolvedValue(undefined);
});

describe("branch assignment self-healing", () => {
  it("persists and returns a real default branch for an uninitialized user", async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([realBranch])
      .mockResolvedValueOnce([realBranch]);

    await expect(getOrRepairUserBranches("legacy-user")).resolves.toEqual([realBranch]);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO user_branches"),
      ["legacy-user", "real-branch-id"],
    );
    expect(db.execute.mock.calls[0][0]).toContain("user_branch_assignment_revocations");
  });

  it("keeps a deliberately revoked user unassigned and fail-closed", async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(getOrRepairUserBranches("revoked-user")).resolves.toEqual([]);

    expect(db.query.mock.calls[1][0]).toContain("user_branch_assignment_revocations");
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("records an explicit revocation when the final assignment is removed", async () => {
    await removeUserFromBranch("revoked-user", "real-branch-id");

    expect(db.transaction).toHaveBeenCalledTimes(1);
    const statements = db.transaction.mock.calls[0][0] as Array<{ sql: string }>;
    expect(statements[0].sql).toContain("DELETE FROM user_branches");
    expect(statements[2].sql).toContain("user_branch_assignment_revocations");
    expect(statements[2].sql).toContain("NOT EXISTS");
  });
});
