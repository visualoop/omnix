import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getOrRepairUserBranches, type Branch } from "@/services/branches";
import {
  advanceBranchContext,
  setBranchContextReadOnly,
} from "@/lib/branch-context";

export type BranchViewScope = "branch" | "all";

interface ActiveBranchState {
  active: Branch | null;
  available: Branch[];
  loaded: boolean;
  scope: BranchViewScope;
  revision: number;
  loadForUser: (userId: string) => Promise<void>;
  switchTo: (branch: Branch) => Promise<void>;
  switchToAllBranches: () => Promise<void>;
  updateBranch: (branch: Branch) => void;
  clear: () => void;
}

async function refreshBranchScopedState(clearCart: boolean): Promise<void> {
  // A cart belongs to the operational branch where its stock and source
  // document were selected. Never carry it across a context transition.
  if (clearCart) {
    const { useCartStore } = await import("./cart");
    useCartStore.getState().clear();
  }

  // Auth also reads this store while resolving permissions. Keep this import
  // lazy so neither store becomes a static dependency of the other.
  const { useAuthStore } = await import("./auth");
  await useAuthStore.getState().loadPermissions();
}

// Branch assignment queries can overlap across rapid sign-out/sign-in cycles.
// Only the latest user context may publish branch state or refresh permissions.
let branchLoadVersion = 0;

export const useActiveBranch = create<ActiveBranchState>()(
  persist(
    (set, get) => ({
      active: null,
      available: [],
      loaded: false,
      scope: "branch",
      revision: 0,

      loadForUser: async (userId) => {
        const requestVersion = ++branchLoadVersion;
        try {
          const branches = await getOrRepairUserBranches(userId);
          if (requestVersion !== branchLoadVersion) return;

          const previousId = get().active?.id;
          const nextActive =
            branches.find((branch) => branch.id === previousId) ?? branches[0] ?? null;
          const changed = get().active?.id !== nextActive?.id || get().scope !== "branch";
          if (changed) {
            setBranchContextReadOnly(false);
            advanceBranchContext();
          }

          // An account without assignments has no operational context. Do not
          // manufacture a branch that the user cannot actually access.
          set((state) => ({
            active: nextActive,
            available: branches,
            loaded: true,
            scope: "branch",
            revision: changed ? state.revision + 1 : state.revision,
          }));
        } catch (error) {
          if (requestVersion !== branchLoadVersion) return;
          console.error("Could not load branches:", error);
          setBranchContextReadOnly(false);
          advanceBranchContext();
          set((state) => ({
            active: null,
            available: [],
            loaded: true,
            scope: "branch",
            revision: state.revision + 1,
          }));
        }
        if (requestVersion === branchLoadVersion) {
          await refreshBranchScopedState(true);
        }
      },

      switchTo: async (branch) => {
        const assigned = get().available.find((candidate) => candidate.id === branch.id);
        if (!assigned) throw new Error("This branch is not assigned to your account");
        if (get().active?.id === assigned.id && get().scope === "branch") return;
        setBranchContextReadOnly(false);
        advanceBranchContext();
        set((state) => ({ active: assigned, scope: "branch", revision: state.revision + 1 }));
        await refreshBranchScopedState(true);
      },

      switchToAllBranches: async () => {
        if (get().available.length === 0) {
          throw new Error("No branches are assigned to your account");
        }
        const { useAuthStore } = await import("./auth");
        const role = useAuthStore.getState().user?.role;
        if (!role || !["owner", "admin", "manager"].includes(role)) {
          throw new Error("All Branches analytics requires manager access");
        }
        if (get().scope === "all") return;
        setBranchContextReadOnly(true);
        advanceBranchContext();
        set((state) => ({ scope: "all", revision: state.revision + 1 }));
        await refreshBranchScopedState(true);
      },

      updateBranch: (branch) =>
        set((state) => ({
          active: state.active?.id === branch.id ? branch : state.active,
          available: state.available.map((candidate) =>
            candidate.id === branch.id ? branch : candidate,
          ),
        })),

      clear: () => {
        branchLoadVersion += 1;
        setBranchContextReadOnly(false);
        advanceBranchContext();
        set((state) => ({
          active: null,
          available: [],
          loaded: false,
          scope: "branch",
          revision: state.revision + 1,
        }));
        void import("./cart").then(({ useCartStore }) => useCartStore.getState().clear());
      },
    }),
    {
      name: "omnix-active-branch",
      // The operational branch survives restart. Assignment lists and the
      // read-only aggregate scope are always revalidated after authentication.
      partialize: (state) => ({ active: state.active }),
    },
  ),
);

/** The selected operational branch, or null outside an operational context. */
export function getActiveBranchId(): string | null {
  const state = useActiveBranch.getState();
  return state.scope === "branch" ? state.active?.id ?? null : null;
}

/** Stable namespace for any cache whose value depends on operational data. */
export function getBranchCacheNamespace(): string {
  const state = useActiveBranch.getState();
  if (state.scope === "all") {
    return `all:${state.available.map((branch) => branch.id).sort().join(",")}`;
  }
  return state.active ? `branch:${state.active.id}` : "branch:none";
}

/** Branch filter for analytics. Null explicitly means the read-only aggregate. */
export function getAnalyticsBranchId(): string | null {
  const state = useActiveBranch.getState();
  return state.scope === "all" ? null : state.active?.id ?? null;
}

export function isAllBranchesAnalytics(): boolean {
  return useActiveBranch.getState().scope === "all";
}

/**
 * Resolve a branch for an operational mutation. This is intentionally the
 * only write-safe accessor: aggregate analytics and unassigned users fail
 * closed instead of writing NULL or a fabricated default branch.
 */
export function requireActiveBranchId(): string {
  const state = useActiveBranch.getState();
  if (state.scope === "all") {
    throw new Error("All Branches is read-only. Select a branch before making changes.");
  }
  if (!state.active) {
    throw new Error("No active branch is assigned. Select an assigned branch before making changes.");
  }
  return state.active.id;
}

/** Authorized branch ids for analytics: one operational branch or all assignments. */
export function getAnalyticsBranchIds(): string[] {
  const state = useActiveBranch.getState();
  if (state.scope === "all") return state.available.map((branch) => branch.id);
  return state.active ? [state.active.id] : [];
}
