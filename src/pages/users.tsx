import { useEffect, useMemo, useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  CircleNotch as Loader2,
  Lock,
  MagnifyingGlass as Search,
  Pencil as Edit3,
  ShieldCheck,
  UserPlus,
  UserMinus as UserX,
  Users,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { BuiltInRoleCombobox } from "@/components/built-in-role-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/pagination-bar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  listUsers,
  createUser,
  changePassword,
  deactivateUser,
  setUserRole,
  type User,
  type CreateUserInput,
} from "@/services/auth";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";
import { Can } from "@/components/require-role";
import {
  BUILT_IN_ROLES,
  builtInRoleById,
  defaultBuiltInRoleId,
  type BuiltInRoleId,
  type BuiltInRoleModule,
} from "@/lib/built-in-roles";
import { BackButton } from "@/components/ui/back-button";

const PAGE_SIZE = 10;

const MODULE_BADGE_TONES: Record<BuiltInRoleModule, string> = {
  core: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  dawa: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  retail: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  hardware: "border-yellow-600/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  hospitality: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  salon: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function roleForUser(user: User) {
  return builtInRoleById(user.built_in_role_id ?? defaultBuiltInRoleId(user.role));
}

function StaffRoleBadge({ user }: { user: User }) {
  const role = roleForUser(user);
  if (!role) return null;
  return (
    <Badge variant="outline" className={MODULE_BADGE_TONES[role.module]}>
      <ShieldCheck className="mr-1 h-3 w-3" />
      {role.name}
    </Badge>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const currentUser = useAuthStore((state) => state.user);

  const load = async () => setUsers(await listUsers());
  useEffect(() => { load(); }, []);

  const activeOwners = users.filter((user) => user.role === "owner" && user.active === 1);
  const activeStaff = users.filter((user) => user.active === 1).length;
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const role = roleForUser(user);
      return [user.full_name, user.username, role?.name, role?.moduleLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [search, users]);
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pagination = {
    rows: pageUsers,
    loading: false,
    error: null,
    total: filteredUsers.length,
    page,
    pageSize: PAGE_SIZE,
    pageCount,
    hasMore: page < pageCount,
    search,
    setPage,
    setSearch,
    refresh: load,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <BackButton fallback="/" />
          <h1 className="text-xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Control who can sign in to {APP_NAME} and choose a ready-made role for their job.
          </p>
        </div>
        <Can permission="users.manage">
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add staff member
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-4">
        <div className="px-4 first:pl-0">
          <p className="text-xs text-muted-foreground">Active staff</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{activeStaff}</p>
        </div>
        <div className="px-4">
          <p className="text-xs text-muted-foreground">Business owners</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{activeOwners.length}</p>
        </div>
        <div className="px-4">
          <p className="text-xs text-muted-foreground">Built-in roles</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{BUILT_IN_ROLES.length}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-border">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Staff directory</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Built-in roles are maintained by Omnix, so there is no permission matrix to configure.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff or roles…"
              className="h-9 pl-8"
              aria-label="Search staff"
            />
          </div>
        </div>

        {users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-30" />
            <p className="text-sm">No staff members yet</p>
            <p className="mt-1 text-xs">Add the first person who needs their own sign-in.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Username</th>
                    <th className="px-3 py-2 text-left font-medium">Built-in role</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No staff or roles match “{search}”.
                      </td>
                    </tr>
                  ) : pageUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span>{user.full_name}</span>
                          {currentUser?.id === user.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{user.username}</td>
                      <td className="px-3 py-2.5"><StaffRoleBadge user={user} /></td>
                      <td className="px-3 py-2.5 text-center">
                        {user.active === 1 ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Can permission="users.manage">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                            aria-label={`Edit ${user.full_name}`}
                            title={`Edit ${user.full_name}`}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-4 pb-3">
              <PaginationBar list={pagination} />
            </div>
          </>
        )}
      </section>

      {/* Last owner warning */}
      {activeOwners.length === 1 && (
        <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Only one owner.</strong> Add another owner before deactivating the current one.
          </p>
        </div>
      )}

      {/* Create staff sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>Add staff member</SheetTitle>
          </SheetHeader>
          <CreateUserForm onCreated={() => { setShowCreate(false); load(); }} />
        </SheetContent>
      </Sheet>

      {/* Edit staff sheet */}
      <Sheet open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>{editingUser?.full_name}</SheetTitle>
          </SheetHeader>
          {editingUser && (
            <EditUserForm
              user={editingUser}
              currentUserId={currentUser?.id}
              isOnlyOwner={editingUser.role === "owner" && activeOwners.length === 1}
              onSaved={() => { setEditingUser(null); load(); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserInput>({
    username: "",
    full_name: "",
    password: "",
    role: "cashier",
  });
  const [roleId, setRoleId] = useState<BuiltInRoleId>("role_cashier");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (form.password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!form.username.match(/^[a-zA-Z0-9_]+$/)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }
    setSubmitting(true);
    try {
      const selectedRole = builtInRoleById(roleId);
      if (!selectedRole) throw new Error("Choose a valid built-in role");
      await createUser({
        ...form,
        role: selectedRole.legacyRole,
        built_in_role_id: roleId,
      });
      toast.success("Staff member created");
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Give each person their own sign-in, then choose the job that best matches what they do.
      </p>
      <Field label="Full name *">
        <Input
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          autoFocus
          autoComplete="name"
        />
      </Field>
      <Field label="Username *">
        <Input
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
          placeholder="e.g. john"
          className="font-mono"
          autoComplete="username"
        />
      </Field>
      <Field label="Built-in role *">
        <BuiltInRoleCombobox value={roleId} onChange={setRoleId} />
      </Field>
      <Field label="Password *">
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="At least 4 characters"
        />
      </Field>
      <Field label="Confirm Password *">
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Field>

      {error && (
        <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !form.full_name || !form.username || !form.password || !confirmPassword}
        className="w-full"
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
        ) : (
          "Create User"
        )}
      </Button>
    </div>
  );
}

function EditUserForm({
  user, currentUserId, isOnlyOwner, onSaved,
}: {
  user: User;
  currentUserId?: string;
  isOnlyOwner: boolean;
  onSaved: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const initialRoleId = user.built_in_role_id ?? defaultBuiltInRoleId(user.role);
  const [roleId, setRoleId] = useState<BuiltInRoleId>(initialRoleId);
  const [savingRole, setSavingRole] = useState(false);

  const isSelf = currentUserId === user.id;
  const selectedRole = builtInRoleById(roleId);
  const roleChanged = roleId !== initialRoleId;

  const handleSaveRole = async () => {
    if (!roleChanged || !selectedRole) return;
    setSavingRole(true);
    try {
      await setUserRole(user.id, selectedRole.legacyRole, roleId);
      toast.success(`Role changed to ${selectedRole.name}`);
      onSaved();
    } catch (error) {
      toast.error(String(error));
      setRoleId(initialRoleId);
    } finally {
      setSavingRole(false);
    }
  };

  const handleChangePassword = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(user.id, newPassword);
      toast.success("Password changed");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!(await confirm({ title: `Deactivate ${user.full_name}? They won't be able to sign in.` }))) return;
    try {
      await deactivateUser(user.id);
      toast.success("User deactivated");
      onSaved();
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="mt-5 space-y-6">
      <div className="space-y-2 border-y border-border py-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Username</span>
          <span className="font-mono text-sm">{user.username}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Role</span>
          <StaffRoleBadge user={user} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Status</span>
          {user.active === 1 ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      {/* Change role */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-medium">Built-in role</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose the closest match for this person's daily work.</p>
          </div>
        </div>
        {isOnlyOwner ? (
          <p className="text-xs leading-5 text-muted-foreground">
            This is the only business owner. Add another owner before changing this role so administration is never locked out.
          </p>
        ) : (
          <>
            <BuiltInRoleCombobox value={roleId} onChange={setRoleId} disabled={savingRole} />
            <Button
              onClick={handleSaveRole}
              disabled={savingRole || !roleChanged}
              className="w-full"
              variant="outline"
            >
              {savingRole
                ? "Saving…"
                : roleChanged && selectedRole
                  ? `Change to ${selectedRole.name}`
                  : "Role is up to date"}
            </Button>
            {isSelf && roleChanged && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                You're changing your own role and may lose access to this page.
              </p>
            )}
          </>
        )}
      </section>

      {/* Change password */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Change Password</h3>
        </div>
        <Field label="New Password">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 4 characters"
          />
        </Field>
        <Field label="Confirm New Password">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        {error && (
          <div className="border border-red-500/50 bg-red-500/5 rounded-md p-2.5 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        <Button
          onClick={handleChangePassword}
          disabled={submitting || !newPassword || !confirmPassword}
          className="w-full"
          variant="outline"
        >
          {submitting ? "Changing..." : "Change Password"}
        </Button>
      </div>

      {/* Branch assignments */}
      <BranchAssignmentBlock userId={user.id} />

      {/* Danger zone */}
      {!isSelf && !isOnlyOwner && user.active === 1 && (
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-medium text-red-700">Deactivate staff member</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            They will no longer be able to sign in. Their data is preserved.
          </p>
          <Button onClick={handleDeactivate} variant="destructive" size="sm">
            Deactivate {user.full_name}
          </Button>
        </div>
      )}

      {isSelf && (
        <p className="text-xs text-muted-foreground italic">You cannot deactivate yourself.</p>
      )}
      {isOnlyOwner && (
        <p className="text-xs text-amber-700 italic">Cannot deactivate the only owner.</p>
      )}
    </div>
  );
}

function BranchAssignmentBlock({ userId }: { userId: string }) {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; assigned: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { listBranches, listUserBranches } = await import("@/services/branches");
      const [all, assigned] = await Promise.all([
        listBranches(false),
        listUserBranches(userId),
      ]);
      const assignedIds = new Set(assigned.map((assignment) => assignment.id));
      setBranches(all.map((b) => ({ id: b.id, name: b.name, assigned: assignedIds.has(b.id) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const toggle = async (branchId: string, assigned: boolean) => {
    const { assignUserToBranch, removeUserFromBranch } = await import("@/services/branches");
    if (assigned) await removeUserFromBranch(userId, branchId);
    else await assignUserToBranch(userId, branchId);
    toast.success(assigned ? "Removed from branch" : "Assigned to branch");
    load();
  };

  if (loading) return null;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium">Branch Access</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Which branches can this user log into?</p>
      </div>
      <div className="space-y-1.5">
        {branches.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={b.assigned} onCheckedChange={() => toggle(b.id, b.assigned)} />
            <span>{b.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
