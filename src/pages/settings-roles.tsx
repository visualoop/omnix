import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleNotch as Loader2,
  Copy,
  Lock,
  MagnifyingGlass as Search,
  Minus as Minus,
  Plus,
  Shield,
  Trash as Trash2,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  PERMISSION_CATALOG,
  type PermissionGroup,
  type PermissionRisk,
} from "@/lib/permissions";
import {
  listRoles, rolePermissionKeys, createRole, cloneRole, deleteRole, setRolePermission,
  type RoleRow,
} from "@/services/rbac";
import { cn } from "@/lib/utils";
import { confirm, prompt } from "@/components/ui/confirm-dialog";

const GROUPS: PermissionGroup[] = [
  "Sales", "Inventory", "Purchasing", "Customers", "Suppliers", "Pharmacy",
  "Reports & Finance", "Compliance", "Admin", "HR", "Invoicing", "Banking", "Retail",
];

const RISK_STYLE: Record<PermissionRisk, string> = {
  low: "bg-muted/40 text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function SettingsRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const isSystem = !!selected?.is_system;

  const loadRoles = async () => {
    const r = await listRoles();
    setRoles(r);
    setSelectedId((cur) => cur ?? r[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { loadRoles(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    rolePermissionKeys(selectedId).then((keys) => setGrantedKeys(new Set(keys)));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PERMISSION_CATALOG;
    return PERMISSION_CATALOG.filter(
      (p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.group.toLowerCase().includes(q),
    );
  }, [search]);

  const ownerImplicitAll = selected?.id === "role_owner";

  const toggle = async (key: string) => {
    if (!selected || isSystem) return;
    const granted = !grantedKeys.has(key);
    setGrantedKeys((prev) => {
      const next = new Set(prev);
      granted ? next.add(key) : next.delete(key);
      return next;
    });
    setSaving(key);
    try {
      await setRolePermission(selected.id, key, granted);
    } catch (e) {
      toast.error(String(e));
      // revert
      setGrantedKeys((prev) => {
        const next = new Set(prev);
        granted ? next.delete(key) : next.add(key);
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async () => {
    const name = await prompt({ title: "New role", placeholder: "Role name", required: true });
    if (!name?.trim()) return;
    try {
      const id = await createRole(name.trim());
      await loadRoles();
      setSelectedId(id);
      toast.success(`Role "${name}" created`);
    } catch (e) { toast.error(String(e)); }
  };

  const handleClone = async () => {
    if (!selected) return;
    const name = await prompt({ title: `Clone "${selected.name}"`, placeholder: "New role name", defaultValue: `${selected.name} copy`, required: true });
    if (!name?.trim()) return;
    try {
      const id = await cloneRole(selected.id, name.trim());
      await loadRoles();
      setSelectedId(id);
      toast.success(`Cloned to "${name}"`);
    } catch (e) { toast.error(String(e)); }
  };

  const handleDelete = async () => {
    if (!selected || isSystem) return;
    if (!(await confirm({ title: `Delete role "${selected.name}"?`, description: "Users with only this role lose its access.", variant: "destructive", confirmText: "Delete" }))) return;
    try {
      await deleteRole(selected.id);
      setSelectedId(null);
      await loadRoles();
      toast.success("Role deleted");
    } catch (e) { toast.error(String(e)); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex gap-4 max-w-6xl h-full">
      {/* Role list */}
      <div className="w-56 shrink-0 space-y-2">
        <Button size="sm" className="w-full cursor-pointer" onClick={handleCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New role
        </Button>
        <div className="space-y-0.5">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "w-full text-left rounded-md px-2.5 py-2 transition-colors cursor-pointer",
                r.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium truncate">{r.name}</span>
                {r.is_system ? <Lock className="h-3 w-3 shrink-0 opacity-60" /> : null}
              </div>
              {r.description ? <div className="text-[10px] text-muted-foreground truncate mt-0.5">{r.description}</div> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Permission editor */}
      <div className="flex-1 min-w-0 space-y-4">
        {selected && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">{selected.name}</h2>
                {isSystem && (
                  <Badge variant="outline" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" /> System role (read-only)</Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={handleClone}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Clone
                </Button>
                {!isSystem && (
                  <Button size="sm" variant="outline" className="cursor-pointer text-red-600 hover:text-red-700" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                  </Button>
                )}
              </div>
            </div>

            {ownerImplicitAll && (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                The Owner role always has every permission and cannot be limited.
              </div>
            )}

            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permissions…"
                className="pl-8 h-8 text-[13px]"
              />
            </div>

            <div className="space-y-3">
              {GROUPS.map((group) => {
                const items = filtered.filter((p) => p.group === group);
                if (items.length === 0) return null;
                return (
                  <section key={group} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-3 py-1.5 border-b border-border">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
                    </div>
                    <div>
                      {items.map((perm) => {
                        const granted = ownerImplicitAll || grantedKeys.has(perm.key);
                        const editable = !isSystem && !ownerImplicitAll;
                        return (
                          <button
                            key={perm.key}
                            disabled={!editable}
                            onClick={() => toggle(perm.key)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-1.5 text-left border-b border-border last:border-0 transition-colors",
                              editable ? "hover:bg-accent/30 cursor-pointer" : "cursor-default",
                            )}
                          >
                            <span className={cn(
                              "h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                              granted ? "bg-emerald-600 border-emerald-600 text-white" : "border-border text-transparent",
                            )}>
                              {granted ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium truncate">{perm.label}</span>
                              <span className="block text-[10px] font-mono text-muted-foreground truncate">{perm.key}</span>
                            </span>
                            {saving === perm.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 shrink-0", RISK_STYLE[perm.risk])}>
                              {perm.risk}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
