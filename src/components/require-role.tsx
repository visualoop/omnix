import { Lock, Shield, ArrowLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import { hasPermission, hasAnyPermission, ROLE_INFO, type Permission } from "@/lib/permissions";
import { useNavigate, useLocation } from "react-router-dom";
import type { Role } from "@/lib/permissions";
import { useActiveModule, MODULE_DEFINITIONS } from "@/stores/active-module";
import { getFeatureModule } from "@/lib/module-features";

interface Props {
  /** Required permission(s). User needs ANY ONE of these to access. */
  permission?: Permission | Permission[];
  /** Or restrict by role list (alternative to permission). */
  roles?: Role[];
  /** Page content if access granted */
  children: React.ReactNode;
}

/**
 * Route guard. Wrap a route element to require a permission/role.
 *
 *   <RequireRole permission="users.manage">
 *     <UsersPage />
 *   </RequireRole>
 */
export function RequireRole({ permission, roles, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const activeModule = useActiveModule((s) => s.active);

  if (!user) {
    return null; // App.tsx handles login redirect; we shouldn't render here
  }

  // ─── Module gate ─────────────────────────────────────────
  // If this route belongs to a module that isn't currently active,
  // show a clear "feature not enabled" screen instead of granting access.
  const requiredModule = getFeatureModule(location.pathname);
  if (requiredModule && requiredModule !== activeModule) {
    const moduleDef = MODULE_DEFINITIONS[requiredModule];
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-blue-500/15 flex items-center justify-center mb-4">
          <Box className="h-7 w-7 text-blue-700" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Module not enabled</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-1">
          This feature belongs to the <b>{moduleDef.name}</b> module.
        </p>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          You're currently using the <b>{MODULE_DEFINITIONS[activeModule].name}</b> module.
          Switch modules from Settings to enable {moduleDef.shortName} features.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
          </Button>
          <Button size="sm" onClick={() => navigate("/settings/modules")}>
            <Box className="h-3.5 w-3.5 mr-1.5" /> Manage Modules
          </Button>
        </div>
      </div>
    );
  }

  const allowedByPermission = (() => {
    if (!permission) return true;
    if (Array.isArray(permission)) return hasAnyPermission(user, permission);
    return hasPermission(user, permission);
  })();

  const allowedByRole = !roles || roles.includes(user.role as Role);

  if (allowedByPermission && allowedByRole) {
    return <>{children}</>;
  }

  // Access denied screen
  const info = ROLE_INFO[user.role as Role];
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
        <Lock className="h-7 w-7 text-amber-700" />
      </div>
      <h1 className="text-xl font-semibold">Access restricted</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        Your role does not have permission to view this page.
      </p>

      <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <Shield className={`h-4 w-4 ${info?.color || "text-muted-foreground"}`} />
        <div className="text-left">
          <div className="text-sm font-medium">{info?.label || user.role}</div>
          <div className="text-xs text-muted-foreground">{info?.tagline || "—"}</div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 max-w-md">
        If you need access, ask the Owner to upgrade your role from
        <strong> Settings → Users</strong>.
      </p>

      <Button variant="outline" className="mt-5" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go back
      </Button>
    </div>
  );
}

/**
 * Inline conditional render. Hides children if user lacks permission.
 *
 *   <Can permission="inventory.delete">
 *     <Button>Delete</Button>
 *   </Can>
 */
export function Can({ permission, children, fallback = null }: {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const ok = Array.isArray(permission)
    ? hasAnyPermission(user, permission)
    : hasPermission(user, permission);
  return <>{ok ? children : fallback}</>;
}
