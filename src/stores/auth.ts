import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isSetupComplete as checkSetupDb,
  login as loginDb,
  type User,
} from "@/services/auth";

interface AuthState {
  user: User | null;
  isSetupComplete: boolean;
  setupChecked: boolean;          // Have we queried the DB yet?
  loading: boolean;
  // actions
  refreshSetupState: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<User>;
  signOut: () => void;
  setSetupComplete: (done: boolean) => void;
  // Internal: bypass for setup wizard completion
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isSetupComplete: false,
      setupChecked: false,
      loading: false,

      refreshSetupState: async () => {
        const done = await checkSetupDb();
        set({ isSetupComplete: done, setupChecked: true });
      },

      signIn: async (username, password) => {
        set({ loading: true });
        try {
          const user = await loginDb(username, password);
          set({ user, loading: false });
          // Lazy-import to avoid circular dependency
          import("./active-branch").then((m) => m.useActiveBranch.getState().loadForUser(user.id));
          // Run recurring invoice schedule (once per session, async fire-and-forget)
          import("@/services/recurring-invoicing").then((m) =>
            m.runRecurringSchedule(user.id).then((r) => {
              if (r.generated > 0) {
                import("sonner").then(({ toast }) =>
                  toast.success(`Generated ${r.generated} recurring invoice${r.generated !== 1 ? "s" : ""}`),
                );
              }
            }).catch(() => {}),
          );
          return user;
        } catch (e) {
          set({ loading: false });
          throw e;
        }
      },

      signOut: () => {
        set({ user: null });
        import("./active-branch").then((m) => m.useActiveBranch.getState().clear());
      },

      setSetupComplete: (done) => set({ isSetupComplete: done }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "omnix-auth",
      // Only persist user (not loading/setupChecked); we re-check setup from DB on load
      partialize: (state) => ({ user: state.user }),
    }
  )
);
