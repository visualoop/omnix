import { invoke } from "@tauri-apps/api/core";
import { query, execute } from "@/lib/db";

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: "owner" | "manager" | "cashier" | "viewer";
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

  const business = (await query<Business>("SELECT * FROM business WHERE id = ?1", [businessId]))[0];
  const user = (await query<User>("SELECT * FROM users WHERE id = ?1", [userId]))[0];
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

  // Strip password hash before returning
  const { password_hash: _, ...safeUser } = user;
  return safeUser;
}

// ===== Business helpers =====

export async function getBusiness(): Promise<Business | null> {
  const rows = await query<Business>("SELECT * FROM business LIMIT 1");
  return rows[0] || null;
}

// ===== User management =====

export async function listUsers(): Promise<User[]> {
  return query<User>("SELECT id, username, full_name, role, active FROM users ORDER BY full_name");
}

export interface CreateUserInput {
  username: string;
  full_name: string;
  password: string;
  role: User["role"];
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (input.password.length < 4) throw new Error("Password too short");
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
    [id, input.username, input.full_name, input.role, hash]
  );
  return (await query<User>("SELECT id, username, full_name, role, active FROM users WHERE id = ?1", [id]))[0];
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

/** Change a user's base role. Blocks demoting the last active owner (which
 *  would lock everyone out of owner-only settings). */
export async function setUserRole(userId: string, role: User["role"]): Promise<void> {
  const [current] = await query<{ role: string }>("SELECT role FROM users WHERE id = ?1", [userId]);
  if (current?.role === "owner" && role !== "owner") {
    const [others] = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND active = 1 AND id != ?1",
      [userId]
    );
    if ((others?.count ?? 0) === 0) throw new Error("Cannot change the last owner's role.");
  }
  await execute("UPDATE users SET role = ?1 WHERE id = ?2", [role, userId]);
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
