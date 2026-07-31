import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/services/auth";

const mocks = vi.hoisted(() => ({
  branchId: "a" as string | null,
  resolveEffectivePermissions: vi.fn(),
  setCachedPermissions: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  isSetupComplete: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@/services/rbac", () => ({
  resolveEffectivePermissions: mocks.resolveEffectivePermissions,
}));

vi.mock("@/stores/active-branch", () => ({
  getActiveBranchId: () => mocks.branchId,
}));

vi.mock("@/stores/active-module", () => ({
  useActiveModule: { getState: () => ({ active: "core" }) },
}));

vi.mock("@/lib/permissions", () => ({
  setCachedPermissions: mocks.setCachedPermissions,
}));

import { useAuthStore } from "@/stores/auth";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const user: User = {
  id: "user-1",
  username: "operator",
  full_name: "Branch Operator",
  role: "manager",
  active: 1,
};

beforeEach(() => {
  localStorage.clear();
  mocks.branchId = "a";
  mocks.resolveEffectivePermissions.mockReset();
  mocks.setCachedPermissions.mockReset();
  useAuthStore.setState({ user, permissions: null });
});

describe("branch-scoped permission loading", () => {
  it("prevents a slower stale branch request from replacing the latest permissions", async () => {
    const branchA = deferred<Set<"inventory.view">>();
    const branchB = deferred<Set<"sales.view">>();
    mocks.resolveEffectivePermissions
      .mockReturnValueOnce(branchA.promise)
      .mockReturnValueOnce(branchB.promise);

    const firstLoad = useAuthStore.getState().loadPermissions();
    await vi.waitFor(() => expect(mocks.resolveEffectivePermissions).toHaveBeenCalledTimes(1));

    mocks.branchId = "b";
    const secondLoad = useAuthStore.getState().loadPermissions();
    await vi.waitFor(() => expect(mocks.resolveEffectivePermissions).toHaveBeenCalledTimes(2));

    branchB.resolve(new Set(["sales.view"]));
    await secondLoad;
    branchA.resolve(new Set(["inventory.view"]));
    await firstLoad;

    expect(mocks.resolveEffectivePermissions).toHaveBeenNthCalledWith(1, user.id, {
      branchId: "a",
      moduleId: "core",
    });
    expect(mocks.resolveEffectivePermissions).toHaveBeenNthCalledWith(2, user.id, {
      branchId: "b",
      moduleId: "core",
    });
    expect(useAuthStore.getState().permissions).toEqual(["sales.view"]);
    expect(mocks.setCachedPermissions).toHaveBeenCalledTimes(1);
    expect(mocks.setCachedPermissions).toHaveBeenLastCalledWith(["sales.view"]);
  });
});
