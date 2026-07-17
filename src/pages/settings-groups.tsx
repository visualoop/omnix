import { useEffect, useState } from "react";
import {
  CircleNotch as Loader2,
  Plus,
  UserPlus,
  Users,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listGroups, createGroup, groupMemberIds, addGroupMember, removeGroupMember,
  groupRoleIds, addGroupRole, removeGroupRole, listRoles,
  type GroupRow, type RoleRow,
} from "@/services/rbac";
import { listUsers, type User } from "@/services/auth";
import { prompt } from "@/components/ui/confirm-dialog";

export function SettingsGroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  const loadGroups = async () => {
    const [g, u, r] = await Promise.all([listGroups(), listUsers(), listRoles()]);
    setGroups(g);
    setUsers(u);
    setRoles(r);
    setSelectedId((cur) => cur ?? g[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => {
    if (!selectedId) { setMemberIds(new Set()); setRoleIds(new Set()); return; }
    groupMemberIds(selectedId).then((ids) => setMemberIds(new Set(ids)));
    groupRoleIds(selectedId).then((ids) => setRoleIds(new Set(ids)));
  }, [selectedId]);

  const handleCreate = async () => {
    const name = await prompt({ title: "New group", placeholder: "e.g. Nairobi Cashiers", required: true });
    if (!name?.trim()) return;
    try {
      const id = await createGroup(name.trim());
      await loadGroups();
      setSelectedId(id);
      toast.success(`Group "${name}" created`);
    } catch (e) { toast.error(String(e)); }
  };

  const toggleRole = async (roleId: string) => {
    if (!selected) return;
    const has = roleIds.has(roleId);
    setRoleIds((prev) => {
      const next = new Set(prev);
      has ? next.delete(roleId) : next.add(roleId);
      return next;
    });
    try {
      if (has) await removeGroupRole(selected.id, roleId);
      else await addGroupRole(selected.id, roleId);
    } catch (e) {
      toast.error(String(e));
      setRoleIds((prev) => {
        const next = new Set(prev);
        has ? next.add(roleId) : next.delete(roleId);
        return next;
      });
    }
  };

  const toggleMember = async (userId: string) => {    if (!selected) return;
    const isMember = memberIds.has(userId);
    setMemberIds((prev) => {
      const next = new Set(prev);
      isMember ? next.delete(userId) : next.add(userId);
      return next;
    });
    try {
      if (isMember) await removeGroupMember(selected.id, userId);
      else await addGroupMember(selected.id, userId);
    } catch (e) {
      toast.error(String(e));
      setMemberIds((prev) => {
        const next = new Set(prev);
        isMember ? next.add(userId) : next.delete(userId);
        return next;
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex gap-4 max-w-5xl">
      <div className="w-56 shrink-0 space-y-2">
        <Button size="sm" className="w-full cursor-pointer" onClick={handleCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New group
        </Button>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3">No groups yet. Groups let you assign roles to many users at once.</p>
        ) : (
          <div className="space-y-0.5">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={cn(
                  "w-full text-left rounded-md px-2.5 py-2 transition-colors cursor-pointer flex items-center gap-1.5",
                  g.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[13px] font-medium truncate">{g.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {selected ? (
          <>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{selected.name}</h2>
              <span className="text-xs text-muted-foreground">{memberIds.size} member{memberIds.size === 1 ? "" : "s"} · {roleIds.size} role{roleIds.size === 1 ? "" : "s"}</span>
            </div>

            {/* Roles assigned to this group — members inherit these permissions. */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Roles for this group</div>
              <p className="text-xs text-muted-foreground">Pick the roles everyone in this group should have. Members automatically get every permission from these roles.</p>
              {roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roles yet — create roles under Settings → Roles &amp; Permissions first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const on = roleIds.has(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleRole(r.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors cursor-pointer",
                          on ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                        )}
                      >
                        {on ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Members</div>
            <p className="text-xs text-muted-foreground">Tap a user to add or remove them from this group.</p>
            <div className="border border-border rounded-lg divide-y divide-border">
              {users.map((u) => {
                const isMember = memberIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium truncate">{u.full_name}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">@{u.username} · {u.role}</span>
                    </span>
                    {isMember ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><X className="h-3 w-3" /> Remove</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><UserPlus className="h-3 w-3" /> Add</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Create a group to get started.</p>
        )}
      </div>
    </div>
  );
}
