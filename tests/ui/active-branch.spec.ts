import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "@/services/branches";

const mocks = vi.hoisted(() => ({
  getUserBranches: vi.fn(),
  loadPermissions: vi.fn(),
  role: "manager",
}));

vi.mock("@/services/branches", () => ({
  getOrRepairUserBranches: mocks.getUserBranches,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: () => ({
      user: { id: "user-1", role: mocks.role },
      loadPermissions: mocks.loadPermissions,
    }),
  },
}));

import {
  getActiveBranchId,
  getAnalyticsBranchIds,
  getBranchCacheNamespace,
  requireActiveBranchId,
  useActiveBranch,
} from "@/stores/active-branch";

function branch(id: string, name: string): Branch {
  return {
    id,
    code: id.toUpperCase(),
    name,
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

const branchA = branch("a", "Alpha");
const branchB = branch("b", "Bravo");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.getUserBranches.mockReset();
  mocks.loadPermissions.mockReset().mockResolvedValue(undefined);
  mocks.role = "manager";
  useActiveBranch.setState({ active: null, available: [], loaded: false });
  localStorage.clear();
});

describe("active branch state", () => {
  it("refreshes branch-scoped permissions when switching", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");
    mocks.loadPermissions.mockClear();

    await useActiveBranch.getState().switchTo(branchB);

    expect(useActiveBranch.getState().active).toEqual(branchB);
    expect(mocks.loadPermissions).toHaveBeenCalledTimes(1);
  });

  it("keeps users without assignments in a safe null context", async () => {
    mocks.getUserBranches.mockResolvedValue([]);

    await useActiveBranch.getState().loadForUser("unassigned-user");

    expect(useActiveBranch.getState()).toMatchObject({
      active: null,
      available: [],
      loaded: true,
    });
    expect(getActiveBranchId()).toBeNull();
    expect(() => requireActiveBranchId()).toThrow("No active branch is assigned");
    expect(mocks.loadPermissions).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale branch load from an earlier user context", async () => {
    const firstUserBranches = deferred<Branch[]>();
    const secondUserBranches = deferred<Branch[]>();
    mocks.getUserBranches
      .mockReturnValueOnce(firstUserBranches.promise)
      .mockReturnValueOnce(secondUserBranches.promise);

    const firstLoad = useActiveBranch.getState().loadForUser("user-1");
    const secondLoad = useActiveBranch.getState().loadForUser("user-2");

    secondUserBranches.resolve([branchB]);
    await secondLoad;
    firstUserBranches.resolve([branchA]);
    await firstLoad;

    expect(useActiveBranch.getState()).toMatchObject({
      active: branchB,
      available: [branchB],
      loaded: true,
    });
    expect(mocks.loadPermissions).toHaveBeenCalledTimes(1);
  });

  it("retains edited branch data after switching away and back", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");
    const editedA = { ...branchA, name: "Alpha Central", code: "AC" };

    useActiveBranch.getState().updateBranch(editedA);
    expect(useActiveBranch.getState().active).toEqual(editedA);
    const savedA = useActiveBranch.getState().available.find((candidate) => candidate.id === "a");
    expect(savedA).toEqual(editedA);

    await useActiveBranch.getState().switchTo(branchB);
    await useActiveBranch.getState().switchTo(savedA!);
    expect(useActiveBranch.getState().active).toEqual(editedA);
  });

  it("persists the selected branch without persisting the assignment list", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");
    await useActiveBranch.getState().switchTo(branchB);

    const saved = localStorage.getItem("omnix-active-branch");
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved ?? "{}").state).toEqual({ active: branchB });

    useActiveBranch.setState({ active: null, available: [], loaded: false });
    localStorage.setItem("omnix-active-branch", saved!);
    await useActiveBranch.persist.rehydrate();

    expect(useActiveBranch.getState().active).toEqual(branchB);
    expect(useActiveBranch.getState().available).toEqual([]);
  });

  it("rejects transitions to branches outside the user's assignments", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA]);
    await useActiveBranch.getState().loadForUser("user-1");

    await expect(useActiveBranch.getState().switchTo(branchB)).rejects.toThrow(
      "not assigned",
    );
    expect(useActiveBranch.getState().active).toEqual(branchA);
  });

  it("increments the reload revision and changes cache namespace on switch", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");
    const revision = useActiveBranch.getState().revision;
    expect(getBranchCacheNamespace()).toBe("branch:a");

    await useActiveBranch.getState().switchTo(branchB);

    expect(useActiveBranch.getState().revision).toBe(revision + 1);
    expect(getBranchCacheNamespace()).toBe("branch:b");
  });

  it("makes All Branches an assigned-only read-only analytics context", async () => {
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");

    await useActiveBranch.getState().switchToAllBranches();

    expect(getActiveBranchId()).toBeNull();
    expect(getAnalyticsBranchIds()).toEqual(["a", "b"]);
    expect(getBranchCacheNamespace()).toBe("all:a,b");
    expect(() => requireActiveBranchId()).toThrow("read-only");
  });

  it("rejects All Branches analytics for a non-manager role", async () => {
    mocks.role = "cashier";
    mocks.getUserBranches.mockResolvedValue([branchA, branchB]);
    await useActiveBranch.getState().loadForUser("user-1");

    await expect(useActiveBranch.getState().switchToAllBranches()).rejects.toThrow(
      "manager access",
    );
    expect(useActiveBranch.getState().scope).toBe("branch");
  });
});
