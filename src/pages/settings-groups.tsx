import { useEffect, useMemo, useState } from "react";
import {
  CircleNotch as Loader2,
  MagnifyingGlass as Search,
  Plus,
  Users,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/pagination-bar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listGroups, createGroup, groupMemberIds, addGroupMember, removeGroupMember,
  groupRoleIds, addGroupRole, removeGroupRole, listRoles,
  type GroupRow, type RoleRow,
} from "@/services/rbac";
import { listUsers, type User } from "@/services/auth";
import {
  BUILT_IN_ROLES,
  builtInRoleById,
  isBuiltInRoleId,
} from "@/lib/built-in-roles";
import { prompt } from "@/components/ui/confirm-dialog";

const MEMBER_PAGE_SIZE = 8;

export function SettingsGroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [roleToAdd, setRoleToAdd] = useState("");
  const [memberToAdd, setMemberToAdd] = useState("");
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

  const filteredGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    return term
      ? groups.filter((group) => group.name.toLowerCase().includes(term))
      : groups;
  }, [groupSearch, groups]);

  const assignedBuiltInRoles = BUILT_IN_ROLES.filter((role) => roleIds.has(role.id));
  const assignedLegacyRoles = roles.filter(
    (role) => roleIds.has(role.id) && !isBuiltInRoleId(role.id),
  );
  const roleOptions: ComboboxOption[] = BUILT_IN_ROLES
    .filter((role) => role.id !== "role_owner" && !roleIds.has(role.id))
    .map((role) => ({
      value: role.id,
      label: role.name,
      hint: role.moduleLabel,
      description: role.description,
      keywords: [role.module, ...role.searchTerms],
    }));

  const memberOptions: ComboboxOption[] = users
    .filter((user) => user.active === 1 && !memberIds.has(user.id))
    .map((user) => {
      const role = builtInRoleById(user.built_in_role_id);
      return {
        value: user.id,
        label: user.full_name,
        hint: `@${user.username}`,
        description: role ? role.name : undefined,
        keywords: [user.username, role?.name ?? ""],
      };
    });

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return users
      .filter((user) => memberIds.has(user.id))
      .filter((user) => {
        if (!term) return true;
        const role = builtInRoleById(user.built_in_role_id);
        return [user.full_name, user.username, role?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [memberIds, memberSearch, users]);
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBER_PAGE_SIZE));
  const pageMembers = filteredMembers.slice(
    (memberPage - 1) * MEMBER_PAGE_SIZE,
    memberPage * MEMBER_PAGE_SIZE,
  );
  const memberPagination = {
    rows: pageMembers,
    loading: false,
    error: null,
    total: filteredMembers.length,
    page: memberPage,
    pageSize: MEMBER_PAGE_SIZE,
    pageCount: memberPageCount,
    hasMore: memberPage < memberPageCount,
    search: memberSearch,
    setPage: setMemberPage,
    setSearch: setMemberSearch,
    refresh: loadGroups,
  };

  useEffect(() => {
    setMemberPage(1);
  }, [memberSearch, selectedId]);
  useEffect(() => {
    setMemberPage((current) => Math.min(current, memberPageCount));
  }, [memberPageCount]);

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
      return true;
    } catch (error) {
      toast.error(String(error));
      setRoleIds((prev) => {
        const next = new Set(prev);
        has ? next.add(roleId) : next.delete(roleId);
        return next;
      });
      return false;
    }
  };

  const toggleMember = async (userId: string) => {
    if (!selected) return;
    const isMember = memberIds.has(userId);
    setMemberIds((prev) => {
      const next = new Set(prev);
      isMember ? next.delete(userId) : next.add(userId);
      return next;
    });
    try {
      if (isMember) await removeGroupMember(selected.id, userId);
      else await addGroupMember(selected.id, userId);
      return true;
    } catch (error) {
      toast.error(String(error));
      setMemberIds((prev) => {
        const next = new Set(prev);
        isMember ? next.add(userId) : next.delete(userId);
        return next;
      });
      return false;
    }
  };

  const handleAddRole = (roleId: string) => {
    setRoleToAdd("");
    void toggleRole(roleId).then((changed) => {
      const role = builtInRoleById(roleId);
      if (changed && role) toast.success(`${role.name} added to ${selected?.name ?? "group"}`);
    });
  };

  const handleAddMember = (userId: string) => {
    setMemberToAdd("");
    void toggleMember(userId).then((changed) => {
      const user = users.find((candidate) => candidate.id === userId);
      if (changed && user) toast.success(`${user.full_name} added to ${selected?.name ?? "group"}`);
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:border-r lg:border-border lg:pr-5">
        <Button size="sm" className="w-full" onClick={handleCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New group
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
            placeholder="Search groups…"
            className="h-9 pl-8"
            aria-label="Search groups"
          />
        </div>
        {groups.length === 0 ? (
          <div className="border-l-2 border-primary pl-3">
            <p className="text-xs font-medium">Create your first group</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Groups give the same built-in job roles to several staff members at once.
            </p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No groups match “{groupSearch}”.</p>
        ) : (
          <div className="space-y-0.5">
            {filteredGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedId(group.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                  group.id === selectedId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-[13px] font-medium">{group.name}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="min-w-0">
        {selected ? (
          <div className="space-y-7">
            <header className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Each member keeps their Staff role and also inherits this group's built-in roles.
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {memberIds.size} member{memberIds.size === 1 ? "" : "s"} · {roleIds.size} role{roleIds.size === 1 ? "" : "s"}
              </span>
            </header>

            <section className="space-y-4 border-b border-border pb-7">
              <div>
                <h3 className="text-sm font-semibold">Shared job roles</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Search by job, module, or responsibility. Business Owner is intentionally not assignable through a group.
                </p>
              </div>
              <Combobox
                value={roleToAdd}
                onChange={handleAddRole}
                options={roleOptions}
                placeholder="Add a built-in role…"
                searchPlaceholder="Search roles and responsibilities…"
                emptyText="All available built-in roles are already assigned"
              />

              {assignedBuiltInRoles.length === 0 ? (
                <div className="border-l-2 border-amber-500 pl-3 text-xs leading-5 text-muted-foreground">
                  This group does not grant access yet. Add the job role its members perform.
                </div>
              ) : (
                <div className="divide-y divide-border border-y border-border">
                  {assignedBuiltInRoles.map((role) => (
                    <div key={role.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-medium">{role.name}</p>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {role.moduleLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{role.description}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleRole(role.id)}
                        aria-label={`Remove ${role.name}`}
                        title={`Remove ${role.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {assignedLegacyRoles.length > 0 && (
                <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium">Existing custom access preserved</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    These roles came from the previous advanced role system. They still work, but new assignments should use built-in roles.
                  </p>
                  {assignedLegacyRoles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between gap-3 text-xs">
                      <span>{role.name}</span>
                      <Button variant="ghost" size="sm" onClick={() => void toggleRole(role.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Members</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Add staff to inherit the roles above. Their primary role chosen under Staff is not replaced.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Combobox
                  value={memberToAdd}
                  onChange={handleAddMember}
                  options={memberOptions}
                  placeholder="Add a staff member…"
                  searchPlaceholder="Search staff…"
                  emptyText="All active staff are already members"
                />
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search current members…"
                    className="h-9 pl-8"
                    aria-label="Search group members"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                {memberIds.size === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm font-medium">No members yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Use the searchable staff picker above to add someone.</p>
                  </div>
                ) : pageMembers.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No members match “{memberSearch}”.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {pageMembers.map((user) => {
                      const role = builtInRoleById(user.built_in_role_id);
                      return (
                        <div key={user.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{user.full_name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              @{user.username}{role ? ` · Primary role: ${role.name}` : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void toggleMember(user.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <PaginationBar list={memberPagination} />
            </section>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto h-9 w-9 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">Create a group to get started</p>
            <p className="mt-1 text-xs text-muted-foreground">Use groups for teams that share extra job access.</p>
          </div>
        )}
      </main>
    </div>
  );
}
