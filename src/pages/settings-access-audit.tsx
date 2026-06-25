import { useEffect, useState } from "react";
import {
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  ShieldCheck,
  ShieldChevron as ShieldX,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { resolveEffectivePermissions, explainPermission } from "@/services/rbac";
import { listUsers, type User } from "@/services/auth";
import { getActiveBranchId } from "@/stores/active-branch";
import { useActiveModule } from "@/stores/active-module";

/**
 * Effective-access viewer: pick a user, see exactly which permissions they
 * have in the current branch/module context and why (which roles grant each).
 */
export function SettingsAccessAuditPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [why, setWhy] = useState<{ key: string; roles: string[] } | null>(null);

  useEffect(() => {
    listUsers().then((u) => {
      setUsers(u);
      setUserId((cur) => cur || u[0]?.id || "");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const moduleId = useActiveModule.getState().active;
    resolveEffectivePermissions(userId, { branchId: getActiveBranchId(), moduleId }).then((set) =>
      setGranted(new Set(set)),
    );
    setWhy(null);
  }, [userId]);

  const explain = async (key: string) => {
    const moduleId = useActiveModule.getState().active;
    const r = await explainPermission(userId, key as never, { branchId: getActiveBranchId(), moduleId });
    setWhy({ key, roles: r.viaRoles });
  };

  const q = search.trim().toLowerCase();
  const items = q
    ? PERMISSION_CATALOG.filter((p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
    : PERMISSION_CATALOG;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={userId} onValueChange={(v) => setUserId(String(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.full_name} (@{u.username})</SelectItem>
          ))}
        </SelectContent></Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permissions…" className="pl-8 h-8 text-[13px]" />
        </div>
        <span className="text-xs text-muted-foreground">{granted.size} granted in this branch/module</span>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {items.map((perm) => {
          const allowed = granted.has(perm.key);
          return (
            <div key={perm.key}>
              <button
                onClick={() => explain(perm.key)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors cursor-pointer"
              >
                {allowed ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <ShieldX className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium truncate">{perm.label}</span>
                  <span className="block text-[10px] font-mono text-muted-foreground truncate">{perm.key}</span>
                </span>
                <span className={cn("text-[11px] font-medium shrink-0", allowed ? "text-emerald-600" : "text-muted-foreground")}>
                  {allowed ? "Allowed" : "Denied"}
                </span>
              </button>
              {why?.key === perm.key && (
                <div className="px-3 pb-2.5 pl-10 text-[11px] text-muted-foreground">
                  {why.roles.length > 0
                    ? <>Granted via role{why.roles.length > 1 ? "s" : ""}: <span className="text-foreground font-medium">{why.roles.join(", ")}</span></>
                    : allowed
                      ? "Granted by the Owner role (implicit full access) or an override."
                      : "No assigned role grants this permission in the current context."}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
