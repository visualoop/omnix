import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  invoke: vi.fn(),
  getOrRepairUserBranches: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  query: mocks.query,
  execute: mocks.execute,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@/services/branches", () => ({
  getOrRepairUserBranches: mocks.getOrRepairUserBranches,
}));

import { createUser, runSetup } from "@/services/auth";

beforeEach(() => {
  mocks.query.mockReset();
  mocks.execute.mockReset().mockResolvedValue({ rowsAffected: 1 });
  mocks.invoke.mockReset().mockResolvedValue("argon-hash");
  mocks.getOrRepairUserBranches.mockReset().mockResolvedValue([{ id: "real-branch-id" }]);
});

describe("user creation branch invariant", () => {
  it("assigns the initial owner during a fresh install setup", async () => {
    mocks.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*) as count FROM business")) return Promise.resolve([{ count: 0 }]);
      if (sql.includes("SELECT * FROM business")) {
        return Promise.resolve([{
          id: String(params?.[0]),
          name: "Hotfix Pharmacy",
          type: "pharmacy",
          address: null,
          phone: null,
          email: null,
        }]);
      }
      if (sql.includes("SELECT * FROM users WHERE id")) {
        return Promise.resolve([{
          id: String(params?.[0]),
          username: "owner",
          full_name: "Owner",
          role: "owner",
          active: 1,
        }]);
      }
      if (sql.includes("FROM user_roles")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await runSetup({
      business_name: "Hotfix Pharmacy",
      owner_name: "Owner",
      username: "owner",
      password: "safe-password",
    });

    const userInsert = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO users"),
    );
    expect(userInsert).toBeDefined();
    expect(mocks.getOrRepairUserBranches).toHaveBeenCalledWith(userInsert?.[1]?.[0]);
  });

  it("assigns every newly created staff user", async () => {
    mocks.query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes("COUNT(*) as count FROM users")) return Promise.resolve([{ count: 0 }]);
      if (sql.includes("SELECT id, username, full_name, role, active FROM users")) {
        return Promise.resolve([{
          id: String(params?.[0]),
          username: "cashier",
          full_name: "Cashier",
          role: "cashier",
          active: 1,
        }]);
      }
      if (sql.includes("FROM user_roles")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await createUser({
      username: "cashier",
      full_name: "Cashier",
      password: "safe-password",
      role: "cashier",
    });

    const userInsert = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO users"),
    );
    expect(userInsert).toBeDefined();
    expect(mocks.getOrRepairUserBranches).toHaveBeenCalledWith(userInsert?.[1]?.[0]);
  });
});
