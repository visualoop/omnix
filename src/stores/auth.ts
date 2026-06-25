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
  /** Cached effective permission keys for the signed-in user (null = not loaded → fall back to static matrix). */
  permissions: string[] | null;
  // actions
  refreshSetupState: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<User>;
  signOut: () => void;
  setSetupComplete: (done: boolean) => void;
  loadPermissions: () => Promise<void>;
  // Internal: bypass for setup wizard completion
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isSetupComplete: false,
      setupChecked: false,
      loading: false,
      permissions: null,

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
          // Hold the password-derived backup key in memory while the app is open.
          // Used by the cloud-backup auto-scheduler so we don't have to re-prompt.
          // Best-effort — never blocks sign-in.
          if (user.role === "owner") {
            Promise.all([
              import("@tauri-apps/api/core").then((m) => m.invoke),
              import("@/services/license").then((m) => m.getLicenseKey()),
            ]).then(([invoke, licenseKey]) => {
              if (!licenseKey) return; // licence not yet activated; backups not possible anyway
              (invoke as (cmd: string, args: Record<string, unknown>) => Promise<unknown>)(
                "cloud_backup_set_session_key",
                { password, licenseKey },
              ).catch(() => {});
            }).catch(() => {});
          }
          // Resolve + cache effective RBAC permissions for this user.
          get().loadPermissions();
          // Run a one-shot multi-licence sync so legacy local keys (from
          // before the Better Auth migration) get reconciled with the
          // cloud DB. Fire-and-forget; never blocks sign-in.
          import("@/services/local-licenses").then((m) =>
            Promise.all([
              import("@tauri-apps/api/core").then(({ invoke }) => invoke<string>("fingerprint").catch(() => "")),
              import("@/lib/db").then(({ query }) =>
                query<{ value: string }>(
                  `SELECT value FROM settings WHERE key = 'licensing.owner_email'`,
                ).then((rows) => rows[0]?.value || ""),
              ),
            ]).then(([machineId, email]) => {
              if (!email || !machineId) return;
              return m.syncLicenses(email, machineId).then((results) => {
                const verified = results.filter((r) => r.status === "verified").length;
                const trouble = results.filter((r) => r.status !== "verified").length;
                if (trouble > 0) {
                  import("sonner").then(({ toast }) =>
                    toast.warning(`${trouble} licence${trouble === 1 ? "" : "s"} need attention`, {
                      description: "Open Settings → Licences for details.",
                      duration: 8000,
                    }),
                  );
                } else if (verified > 0) {
                  import("sonner").then(({ toast }) =>
                    toast.success(`${verified} licence${verified === 1 ? "" : "s"} synced`),
                  );
                }
              });
            }).catch(() => {}),
          ).catch(() => {});
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
        set({ user: null, permissions: null });
        import("@/lib/permissions").then((m) => m.setCachedPermissions(null));
        import("./active-branch").then((m) => m.useActiveBranch.getState().clear());
        // Clear the in-memory cloud-backup key so a different user logging
        // in next can't accidentally use the previous owner's backup key.
        import("@tauri-apps/api/core").then(({ invoke }) =>
          invoke("cloud_backup_clear_session_key").catch(() => {}),
        );
      },

      loadPermissions: async () => {
        const user = get().user;
        if (!user) {
          set({ permissions: null });
          return;
        }
        try {
          const { resolveEffectivePermissions } = await import("@/services/rbac");
          const branchId = (await import("./active-branch")).getActiveBranchId();
          const active = (await import("./active-module")).useActiveModule.getState().active;
          const perms = await resolveEffectivePermissions(user.id, { branchId, moduleId: active });
          // If the user has no RBAC assignments yet, leave null so the static
          // role matrix (users.role) remains the source of truth (back-compat).
          const list = perms.size > 0 ? [...perms] : null;
          const { setCachedPermissions } = await import("@/lib/permissions");
          setCachedPermissions(list);
          set({ permissions: list });
        } catch {
          set({ permissions: null });
        }
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
