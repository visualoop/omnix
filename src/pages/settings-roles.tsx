import { useMemo, useState } from "react";
import { Search, Shield, Check, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PERMISSION_CATALOG,
  ROLES,
  ROLE_INFO,
  roleHasPermission,
  getPermissionsForRole,
  type PermissionGroup,
  type PermissionRisk,
  type Role,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

const GROUPS: PermissionGroup[] = [
  "Sales",
  "Inventory",
  "Purchasing",
  "Customers",
  "Suppliers",
  "Pharmacy",
  "Reports & Finance",
  "Compliance",
  "Admin",
  "HR",
  "Invoicing",
  "Banking",
  "Retail",
];

const RISK_STYLE: Record<PermissionRisk, string> = {
  low: "bg-muted/40 text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-700",
  high: "bg-amber-500/10 text-amber-700",
  critical: "bg-red-500/10 text-red-700",
};

function PermissionCell({ allowed }: { allowed: boolean }) {
  return (
    <td className="px-2 py-1.5 text-center">
      {allowed ? (
        <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" aria-label="Allowed" />
      ) : (
        <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" aria-label="Denied" />
      )}
    </td>
  );
}

export function SettingsRolesPage() {
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PERMISSION_CATALOG.filter((p) => {
      if (selectedRole !== "all" && !roleHasPermission(selectedRole, p.key)) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [search, selectedRole]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ROLES.map((role) => [role, getPermissionsForRole(role).length]),
      ) as Record<Role, number>,
    [],
  );

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
        Built-in roles are read-only in this version. Assign users a role under{" "}
        <strong className="text-foreground">Users & Permissions</strong>. Custom roles and per-user
        overrides are planned next (Plan 09).
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions…"
            className="pl-8 h-8 text-[13px]"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as Role | "all")}
          className="h-8 rounded-md border border-input bg-background px-2 text-[13px]"
        >
          <option value="all">All permissions</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_INFO[role].label} ({counts[role]} granted)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ROLES.map((role) => (
          <div key={role} className="border border-border rounded-md px-3 py-2">
            <div className={cn("text-sm font-medium", ROLE_INFO[role].color)}>{ROLE_INFO[role].label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{ROLE_INFO[role].tagline}</div>
            <div className="text-[10px] font-mono text-muted-foreground mt-1">
              {role === "owner" ? "All permissions" : `${counts[role]} permissions`}
            </div>
          </div>
        ))}
      </div>

      {GROUPS.map((group) => {
        const items = filtered.filter((p) => p.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 border-b border-border">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium min-w-[220px]">Permission</th>
                    <th className="px-2 py-2 font-medium w-16 text-center">Risk</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-2 py-2 font-medium w-16 text-center">
                        {ROLE_INFO[role].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((perm) => (
                    <tr key={perm.key} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5">
                        <div className="font-medium">{perm.label}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{perm.key}</div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", RISK_STYLE[perm.risk])}>
                          {perm.risk}
                        </Badge>
                      </td>
                      {ROLES.map((role) => (
                        <PermissionCell key={role} allowed={roleHasPermission(role, perm.key)} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No permissions match your filter.</p>
      )}
    </div>
  );
}
