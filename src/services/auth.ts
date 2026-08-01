import { invoke } from "@tauri-apps/api/core";
import { query, execute } from "@/lib/db";
import { getOrRepairUserBranches } from "@/services/branches";
import {
  BUILT_IN_ROLE_IDS,
  LEGACY_SYSTEM_ROLE_IDS,
  builtInRoleById,
  defaultBuiltInRoleId,
  isBuiltInRoleId,
  type BuiltInRoleId,
} from "@/lib/built-in-roles";

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: "owner" | "manager" | "cashier" | "viewer";
  /** Maintained job-role assignment; defaults from role for older users. */
  built_in_role_id?: BuiltInRoleId;
  active: number;
}

export interface Business {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

// ===== Password operations (delegated to Rust for argon2) =====

export async function hashPassword(password: string): Promise<string> {
  return invoke<string>("hash_password", { password });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return invoke<boolean>("verify_password", { password, hash });
}

// ===== Setup =====

/** Whether initial setup has been completed (business + at least one owner exists) */
export async function isSetupComplete(): Promise<boolean> {
  const businesses = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM business"
  );
  if (!businesses[0] || businesses[0].count === 0) return false;
  const owners = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND active = 1"
  );
  return (owners[0]?.count ?? 0) > 0;
}

export interface SetupInput {
  business_name: string;
  business_type?: string;
  address?: string;
  phone?: string;
  email?: string;
  owner_name: string;
  username: string;
  password: string;
}

async function assignInitialBranch(userId: string): Promise<void> {
  const branches = await getOrRepairUserBranches(userId);
  if (branches.length === 0) {
    throw new Error("No active branch is available for this user");
  }
}

/** Run the initial setup: create business + admin user. Idempotent. */
export async function runSetup(input: SetupInput): Promise<{ business: Business; user: User }> {
  const already = await isSetupComplete();
  if (already) {
    throw new Error("Setup already completed");
  }

  if (input.password.length < 4) {
    throw new Error("Password must be at least 4 characters");
  }

  const businessId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);

  // Insert business
  await execute(
    `INSERT INTO business (id, name, type, address, phone, email)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [
      businessId,
      input.business_name,
      input.business_type || "pharmacy",
      input.address || null,
      input.phone || null,
      input.email || null,
    ]
  );

  // Insert owner user
  await execute(
    `INSERT INTO users (id, username, full_name, role, password_hash, active)
     VALUES (?1, ?2, ?3, 'owner', ?4, 1)`,
    [userId, input.username, input.owner_name, passwordHash]
  );
  await assignInitialBranch(userId);
  await replaceDirectBuiltInRole(userId, "role_owner");

  const business = (await query<Business>("SELECT * FROM business WHERE id = ?1", [businessId]))[0];
  const [user] = await withBuiltInRoleAssignments(
    await query<User>("SELECT * FROM users WHERE id = ?1", [userId]),
  );
  return { business, user };
}

// ===== Login =====

/** Authenticate username/password. Returns the user on success, throws on failure. */
export async function login(username: string, password: string): Promise<User> {
  const rows = await query<User & { password_hash: string }>(
    "SELECT * FROM users WHERE username = ?1 AND active = 1",
    [username]
  );
  if (rows.length === 0) {
    throw new Error("Invalid username or password");
  }

  const user = rows[0];
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw new Error("Invalid username or password");
  }

  // Strip password hash before returning and hydrate the maintained job role.
  const { password_hash: _, ...safeUser } = user;
  return (await withBuiltInRoleAssignments([safeUser]))[0];
}

// ===== Business helpers =====

export async function getBusiness(): Promise<Business | null> {
  const rows = await query<Business>("SELECT * FROM business LIMIT 1");
  return rows[0] || null;
}

// ===== User management =====

const BUILT_IN_ROLE_PLACEHOLDERS = BUILT_IN_ROLE_IDS.map(
  (_, index) => `?${index + 1}`,
).join(", ");

async function withBuiltInRoleAssignments(users: User[]): Promise<User[]> {
  if (users.length === 0) return users;

  const rows = await query<{ user_id: string; role_id: string }>(
    `SELECT user_id, role_id
       FROM user_roles
      WHERE role_id IN (${BUILT_IN_ROLE_PLACEHOLDERS})`,
    [...BUILT_IN_ROLE_IDS],
  );
  const assignedByUser = new Map<string, Set<string>>();
  for (const row of rows) {
    const assigned = assignedByUser.get(row.user_id) ?? new Set<string>();
    assigned.add(row.role_id);
    assignedByUser.set(row.user_id, assigned);
  }

  const specializedIds = BUILT_IN_ROLE_IDS.filter(
    (roleId) => !LEGACY_SYSTEM_ROLE_IDS.includes(roleId as (typeof LEGACY_SYSTEM_ROLE_IDS)[number]),
  );

  return users.map((user) => {
    const assigned = assignedByUser.get(user.id);
    const specialized = specializedIds.find((roleId) => assigned?.has(roleId));
    const selected = specialized ?? defaultBuiltInRoleId(user.role);
    return { ...user, built_in_role_id: selected };
  });
}

async function replaceDirectBuiltInRole(userId: string, roleId: BuiltInRoleId): Promise<void> {
  const placeholders = BUILT_IN_ROLE_IDS.map((_, index) => `?${index + 2}`).join(", ");
  await execute(
    `DELETE FROM user_roles
      WHERE user_id = ?1 AND role_id IN (${placeholders})`,
    [userId, ...BUILT_IN_ROLE_IDS],
  );
  await execute(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id, module_id)
     VALUES (?1, ?2, NULL, NULL)`,
    [userId, roleId],
  );
}

export async function listUsers(): Promise<User[]> {
  const users = await query<User>(
    "SELECT id, username, full_name, role, active FROM users ORDER BY full_name",
  );
  return withBuiltInRoleAssignments(users);
}

export interface CreateUserInput {
  username: string;
  full_name: string;
  password: string;
  role: User["role"];
  built_in_role_id?: BuiltInRoleId;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (input.password.length < 4) throw new Error("Password too short");
  const selectedRoleId = input.built_in_role_id ?? defaultBuiltInRoleId(input.role);
  const selectedRole = builtInRoleById(selectedRoleId);
  if (!selectedRole || !isBuiltInRoleId(selectedRoleId)) {
    throw new Error("Choose a valid built-in role");
  }
  // Check unique username
  const existing = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE username = ?1",
    [input.username]
  );
  if ((existing[0]?.count ?? 0) > 0) throw new Error("Username already exists");

  const id = crypto.randomUUID();
  const hash = await hashPassword(input.password);
  await execute(
    `INSERT INTO users (id, username, full_name, role, password_hash, active)
     VALUES (?1, ?2, ?3, ?4, ?5, 1)`,
    [id, input.username, input.full_name, selectedRole.legacyRole, hash]
  );
  await assignInitialBranch(id);
  await replaceDirectBuiltInRole(id, selectedRoleId);
  const users = await query<User>(
    "SELECT id, username, full_name, role, active FROM users WHERE id = ?1",
    [id],
  );
  return (await withBuiltInRoleAssignments(users))[0];
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  if (newPassword.length < 4) throw new Error("Password too short");
  const hash = await hashPassword(newPassword);
  await execute("UPDATE users SET password_hash = ?1 WHERE id = ?2", [hash, userId]);
}

export async function deactivateUser(userId: string): Promise<void> {
  // Don't allow deactivating last active owner
  const owners = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND active = 1 AND id != ?1",
    [userId]
  );
  if ((owners[0]?.count ?? 0) === 0) {
    throw new Error("Cannot deactivate the last owner");
  }
  await execute("UPDATE users SET active = 0 WHERE id = ?1", [userId]);
}

/** Change a user's maintained job role. The legacy users.role fallback is
 *  updated in the same operation, while custom roles, groups, and overrides
 *  remain untouched. Blocks demoting the last active owner. */
export async function setUserRole(
  userId: string,
  role: User["role"],
  builtInRoleId?: BuiltInRoleId,
): Promise<void> {
  const selectedRoleId = builtInRoleId ?? defaultBuiltInRoleId(role);
  const selectedRole = builtInRoleById(selectedRoleId);
  if (!selectedRole || !isBuiltInRoleId(selectedRoleId)) {
    throw new Error("Choose a valid built-in role");
  }

  const [current] = await query<{ role: string }>("SELECT role FROM users WHERE id = ?1", [userId]);
  if (current?.role === "owner" && selectedRole.legacyRole !== "owner") {
    const [others] = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND active = 1 AND id != ?1",
      [userId]
    );
    if ((others?.count ?? 0) === 0) throw new Error("Cannot change the last owner's role.");
  }
  await execute("UPDATE users SET role = ?1 WHERE id = ?2", [selectedRole.legacyRole, userId]);
  await replaceDirectBuiltInRole(userId, selectedRoleId);
}

export async function getActiveUsernames(): Promise<string[]> {
  const rows = await query<{ username: string }>(
    "SELECT username FROM users WHERE active = 1 ORDER BY username"
  );
  return rows.map((r) => r.username);
}

export async function resetUserPassword(
  username: string,
  newPassword: string,
  authorizerPassword: string,
): Promise<void> {
  if (newPassword.length < 4) throw new Error("New password must be at least 4 characters");

  // Verify the authorizer is an owner
  const owners = await query<User & { password_hash: string }>(
    "SELECT * FROM users WHERE role = 'owner' AND active = 1"
  );

  let authorizer: (User & { password_hash: string }) | null = null;
  for (const owner of owners) {
    const ok = await verifyPassword(authorizerPassword, owner.password_hash);
    if (ok) { authorizer = owner; break; }
  }
  if (!authorizer) throw new Error("Owner password incorrect. Only the business owner can reset passwords.");

  // Verify target user exists
  const targets = await query<{ id: string }>(
    "SELECT id FROM users WHERE username = ?1 AND active = 1", [username]
  );
  if (targets.length === 0) throw new Error(`User '${username}' not found or inactive`);

  // Reset
  const hash = await hashPassword(newPassword);
  await execute("UPDATE users SET password_hash = ?1 WHERE id = ?2", [hash, targets[0].id]);
}
