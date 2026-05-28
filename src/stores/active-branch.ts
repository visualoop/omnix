/**
 * Active branch store — which branch is the current user working from?
 *
 * Affects which sales/inventory/etc. are visible. User can switch in
 * the topbar if they have access to multiple branches.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getUserBranches, getDefaultBranchId, type Branch } from "@/services/branches";

interface ActiveBranchState {
  active: Branch | null;
  available: Branch[];
  loaded: boolean;
  loadForUser: (userId: string) => Promise<void>;
  setActive: (branch: Branch) => void;
  clear: () => void;
}

export const useActiveBranch = create<ActiveBranchState>()(
  persist(
    (set, get) => ({
      active: null,
      available: [],
      loaded: false,

      loadForUser: async (userId) => {
        try {
          const branches = await getUserBranches(userId);
          if (branches.length === 0) {
            // User has no branch assignments yet — fall back to default
            const defId = await getDefaultBranchId();
            const fallback: Branch = {
              id: defId, code: "MAIN", name: "Main Branch",
              address: null, phone: null, email: null, manager_id: null,
              is_default: 1, active: 1, timezone: "Africa/Nairobi",
              kra_pin: null, etims_device_id: null, open_time: null,
              close_time: null, notes: null,
              created_at: new Date().toISOString(),
            };
            set({ active: fallback, available: [fallback], loaded: true });
            return;
          }
          // Pick previously-active if still available, else primary, else first
          const previous = get().active?.id;
          const stillAvailable = branches.find((b) => b.id === previous);
          const next = stillAvailable || branches.find((b) => (b as any).is_primary) || branches[0];
          set({ active: next, available: branches, loaded: true });
        } catch (e) {
          console.error("Could not load branches:", e);
          set({ loaded: true });
        }
      },

      setActive: (branch) => set({ active: branch }),
      clear: () => set({ active: null, available: [], loaded: false }),
    }),
    {
      name: "omnix-active-branch",
      partialize: (state) => ({ active: state.active }),
    },
  ),
);

/** Get the active branch ID at any point. Falls back to default if not loaded. */
export function getActiveBranchId(): string {
  return useActiveBranch.getState().active?.id || "default-branch";
}
