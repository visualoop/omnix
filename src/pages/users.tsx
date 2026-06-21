import { useState, useEffect } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  CircleNotch as Loader2,
  Lock,
  Pencil as Edit3,
  ShieldCheck,
  UserPlus,
  UserMinus as UserX,
  Users,
  WarningCircle as AlertCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  listUsers,
  createUser,
  changePassword,
  deactivateUser,
  type User,
  type CreateUserInput,
} from "@/services/auth";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/brand";
import { Can } from "@/components/require-role";
import { getPermissionsForRole, ROLE_INFO } from "@/lib/permissions";

const ROLE_LABELS: Record<User["role"], { label: string; description: string; color: string }> = {
  owner: { label: "Owner", description: "Full access, cannot be removed", color: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  manager: { label: "Manager", description: "Inventory, reports, no settings", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  cashier: { label: "Cashier", description: "POS only", color: "bg-green-500/10 text-green-700 border-green-500/30" },
  viewer: { label: "Viewer", description: "Read-only access to reports", color: "bg-muted/30 text-muted-foreground border-border" },
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const currentUser = useAuthStore((s) => s.user);

  const load = async () => setUsers(await listUsers());
  useEffect(() => { load(); }, []);

  const activeOwners = users.filter((u) => u.role === "owner" && u.active === 1);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who can sign in to {APP_NAME}
          </p>
        </div>
        <Can permission="users.manage">
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add User
          </Button>
        </Can>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(["owner", "manager", "cashier", "viewer"] as const).map((role) => {
          const count = users.filter((u) => u.role === role && u.active === 1).length;
          return (
            <div key={role} className="border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground capitalize">{role}s</p>
              <p className="text-2xl font-semibold font-mono mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Users table */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No users yet</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Username</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.full_name}</span>
                      {currentUser?.id === u.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{u.username}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={ROLE_LABELS[u.role].color}>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {ROLE_LABELS[u.role].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {u.active === 1 ? (
                      <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Can permission="users.manage">
                      <Button variant="ghost" size="sm" onClick={() => setEditingUser(u)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Last owner warning */}
      {activeOwners.length === 1 && (
        <div className="border border-amber-500/50 bg-amber-500/5 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Only one owner.</strong> Add another owner before deactivating the current one.
          </p>
        </div>
      )}

      {/* Create user dialog */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>Add User</SheetTitle>
          </SheetHeader>
          <CreateUserForm onCreated={() => { setShowCreate(false); load(); }} />
        </SheetContent>
      </Sheet>

      {/* Edit user panel */}
      <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
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
      await createUser(form);
      toast.success("User created");
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Field label="Full Name *">
        <Input
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          autoFocus
        />
      </Field>
      <Field label="Username *">
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
          placeholder="e.g., john"
          className="font-mono"
        />
      </Field>
      <Field label="Role *">
        <Select
          value={form.role}
          onValueChange={(v) => setForm({ ...form, role: v as User["role"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a role" />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(ROLE_LABELS) as [User["role"], typeof ROLE_LABELS[User["role"]]][]).map(([role, info]) => (
              <SelectItem key={role} value={role}>
                {info.label} — {info.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {ROLE_INFO[form.role].tagline}
          {" · "}
          {form.role === "owner"
            ? "All permissions"
            : `${getPermissionsForRole(form.role).length} permissions granted`}
        </p>
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

  const isSelf = currentUserId === user.id;

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
    <div className="space-y-5 mt-4">
      <div className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Username</span>
          <span className="text-sm font-mono">{user.username}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Role</span>
          <Badge variant="outline" className={ROLE_LABELS[user.role].color}>
            {ROLE_LABELS[user.role].label}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Status</span>
          {user.active === 1 ? (
            <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

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
            <h3 className="text-sm font-medium text-red-700">Deactivate User</h3>
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
      const assignedIds = new Set(assigned.map((a: any) => a.id));
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
  if (branches.length <= 1) return null;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium">Branch Access</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Which branches can this user log into?</p>
      </div>
      <div className="space-y-1.5">
        {branches.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={b.assigned}
              onChange={() => toggle(b.id, b.assigned)}
              className="rounded"
            />
            <span>{b.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
