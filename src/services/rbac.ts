/**
 * RBAC service — seeds the permission catalog + system-role grants into the
 * dynamic RBAC tables (migration 029) from the TS source of truth
 * (`src/lib/permissions.ts`), then resolves effective permissions.
 *
 * The TS catalog stays authoritative; this mirrors it into SQLite so custom
 * roles/groups/overrides can be built on top and enforced consistently.
 */
import { query, execute } from "@/lib/db";
import {
  PERMISSION_CATALOG,
  getPermissionsForRole,
  hasPermission,
  ROLES,
  type Permission,
  type PermissionGroup,
  type PermissionRisk,
} from "@/lib/permissions";

const SYSTEM_ROLE_IDS: Record<string, string> = {
  owner: "role_owner",
  manager: "role_manager",
  cashier: "role_cashier",
  viewer: "role_viewer",
};

/** Derive the owning module from a permission key prefix. */
function moduleOf(key: string): string {
  if (key.startsWith("pharmacy.")) return "dawa";
  if (key.startsWith("retail.")) return "retail";
  if (key.startsWith("hospitality.")) return "hospitality";
  if (key.startsWith("hardware.")) return "hardware";
  return "core";
}

/** Map a permission group to a coarse resource/action pair for the catalog row. */
function resourceAction(key: string): { resource: string; action: string } {
  const parts = key.split(".");
  if (parts.length >= 3) return { resource: parts[1], action: parts.slice(2).join("_") };
  if (parts.length === 2) return { resource: parts[0], action: parts[1] };
  return { resource: key, action: "use" };
}

let seeded = false;

/**
 * Idempotently sync the permission catalog and system-role grants into SQLite.
 * Safe to call on every boot; uses INSERT OR REPLACE / OR IGNORE.
 */
export async function seedRbac(): Promise<void> {
  if (seeded) return;

  // 1. Permission catalog (authoritative mirror of PERMISSION_CATALOG).
  for (const p of PERMISSION_CATALOG) {
    const { resource, action } = resourceAction(p.key);
    await execute(
      `INSERT INTO permissions (key, module_id, resource, action, description, risk_level)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(key) DO UPDATE SET
         module_id = excluded.module_id, resource = excluded.resource,
         action = excluded.action, description = excluded.description,
         risk_level = excluded.risk_level`,
      [p.key, moduleOf(p.key), resource, action, p.label, p.risk],
    );
  }

  // 2. System-role grants (owner is implicit-allow-all; still seed for the editor).
  for (const role of ROLES) {
    const roleId = SYSTEM_ROLE_IDS[role];
    if (!roleId) continue;
    const perms = getPermissionsForRole(role);
    // Clear existing system grants then re-insert (keeps in sync with TS matrix).
    await execute(`DELETE FROM role_permissions WHERE role_id = ?1`, [roleId]);
    for (const key of perms) {
      await execute(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission_key, effect)
         VALUES (?1, ?2, 'allow')`,
        [roleId, key],
      );
    }
  }

  seeded = true;
}

/** Group catalog by PermissionGroup for the role-builder UI (Task 13). */
export function catalogByGroup(): Record<PermissionGroup, typeof PERMISSION_CATALOG> {
  const out = {} as Record<PermissionGroup, typeof PERMISSION_CATALOG>;
  for (const p of PERMISSION_CATALOG) {
    (out[p.group] ??= []).push(p);
  }
  return out;
}

// ─── Effective-permission resolver ───────────────────────────────────────────

interface GrantRow {
  permission_key: string;
  effect: "allow" | "deny";
}

/**
 * Resolve a user's effective permission set for a branch/module context.
 *
 * Sources, unioned:
 *  - role_permissions for roles assigned directly (user_roles) and via groups
 *    (group_members → group_roles), respecting branch/module scope.
 *  - permission_overrides on the user, their groups, and their roles.
 *
 * Precedence (highest first): override deny > override allow > role deny > role allow.
 * The Owner system role is implicit-allow-all and short-circuits.
 *
 * NULL branch_id/module_id on a grant/override means "all branches / all modules".
 */
export async function resolveEffectivePermissions(
  userId: string,
  ctx: { branchId?: string | null; moduleId?: string | null } = {},
): Promise<Set<Permission>> {
  const branch = ctx.branchId ?? null;
  const module = ctx.moduleId ?? null;

  // Owner shortcut.
  const ownerRows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM user_roles WHERE user_id = ?1 AND role_id = 'role_owner'`,
    [userId],
  );
  if ((ownerRows[0]?.n ?? 0) > 0) {
    return new Set(PERMISSION_CATALOG.map((p) => p.key));
  }

  // Role IDs: direct (user_roles) + via groups (group_roles), branch/module scoped.
  const roleRows = await query<{ role_id: string }>(
    `SELECT role_id FROM user_roles
       WHERE user_id = ?1
         AND (branch_id IS NULL OR branch_id = ?2)
         AND (module_id IS NULL OR module_id = ?3)
     UNION
     SELECT gr.role_id FROM group_roles gr
       JOIN group_members gm ON gm.group_id = gr.group_id
       WHERE gm.user_id = ?1
         AND (gr.branch_id IS NULL OR gr.branch_id = ?2)
         AND (gr.module_id IS NULL OR gr.module_id = ?3)`,
    [userId, branch, module],
  );
  const roleIds = [...new Set(roleRows.map((r) => r.role_id))];

  const allow = new Set<string>();
  const deny = new Set<string>();

  if (roleIds.length > 0) {
    const placeholders = roleIds.map((_, i) => `?${i + 1}`).join(",");
    const grants = await query<GrantRow>(
      `SELECT permission_key, effect FROM role_permissions WHERE role_id IN (${placeholders})`,
      roleIds,
    );
    for (const g of grants) {
      if (g.effect === "deny") deny.add(g.permission_key);
      else allow.add(g.permission_key);
    }
  }

  // Override subjects: the user, their groups, and their roles.
  const groupRows = await query<{ group_id: string }>(
    `SELECT group_id FROM group_members WHERE user_id = ?1`,
    [userId],
  );
  const subjectIds = [userId, ...groupRows.map((g) => g.group_id), ...roleIds];
  if (subjectIds.length > 0) {
    const ph = subjectIds.map((_, i) => `?${i + 1}`).join(",");
    const bIdx = subjectIds.length + 1;
    const mIdx = subjectIds.length + 2;
    const overrides = await query<GrantRow>(
      `SELECT permission_key, effect FROM permission_overrides
         WHERE subject_id IN (${ph})
           AND (branch_id IS NULL OR branch_id = ?${bIdx})
           AND (module_id IS NULL OR module_id = ?${mIdx})`,
      [...subjectIds, branch, module],
    );
    for (const o of overrides) {
      if (o.effect === "deny") {
        deny.add(o.permission_key);
        allow.delete(o.permission_key);
      } else {
        allow.add(o.permission_key);
      }
    }
  }

  for (const d of deny) allow.delete(d);
  return new Set([...allow] as Permission[]);
}

// ─── Audit + critical-action enforcement ─────────────────────────────────────

const RISK_BY_KEY: Record<string, PermissionRisk> = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.key, p.risk]),
);

interface AuditContext {
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/** Append a row to the audit_log. Best-effort — never throws. */
export async function auditLog(
  permission: Permission,
  outcome: "allowed" | "denied",
  ctx: AuditContext = {},
): Promise<void> {
  try {
    const { useAuthStore } = await import("@/stores/auth");
    const { getActiveBranchId } = await import("@/stores/active-branch");
    const user = useAuthStore.getState().user;
    await execute(
      `INSERT INTO audit_log
         (id, user_id, user_name, permission_key, action, outcome, risk_level, branch_id, entity_type, entity_id, metadata)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      [
        crypto.randomUUID(),
        user?.id ?? null,
        user?.full_name ?? user?.username ?? null,
        permission,
        permission,
        outcome,
        RISK_BY_KEY[permission] ?? "normal",
        getActiveBranchId(),
        ctx.entityType ?? null,
        ctx.entityId ?? null,
        ctx.metadata ? JSON.stringify(ctx.metadata) : null,
      ],
    );
  } catch {
    /* audit must never break the action path */
  }
}

/**
 * Enforce a permission before a high/critical mutation. Throws (blocking the
 * action) when the current user lacks it, and writes an audit_log row for both
 * allowed and denied outcomes. Call at the top of critical service ops
 * (void/refund, payroll run/approve, settings, license, controlled dispense).
 */
export async function requirePermission(
  permission: Permission,
  ctx: AuditContext = {},
): Promise<void> {
  const { useAuthStore } = await import("@/stores/auth");
  const user = useAuthStore.getState().user;
  const ok = hasPermission(user, permission);
  await auditLog(permission, ok ? "allowed" : "denied", ctx);
  if (!ok) {
    throw new Error(`You don't have permission to perform this action (${permission}).`);
  }
}

// ─── RBAC CRUD (for the management UI, Task 13) ──────────────────────────────

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
  active: number;
}
export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  active: number;
}

export async function listRoles(): Promise<RoleRow[]> {
  return query<RoleRow>(`SELECT id, name, description, is_system, active FROM roles WHERE active = 1 ORDER BY is_system DESC, name`);
}

export async function listGroups(): Promise<GroupRow[]> {
  return query<GroupRow>(`SELECT id, name, description, active FROM groups WHERE active = 1 ORDER BY name`);
}

/** Permission keys (allow effect) granted to a role. */
export async function rolePermissionKeys(roleId: string): Promise<string[]> {
  const rows = await query<{ permission_key: string }>(
    `SELECT permission_key FROM role_permissions WHERE role_id = ?1 AND effect = 'allow'`,
    [roleId],
  );
  return rows.map((r) => r.permission_key);
}

export async function createRole(name: string, description = ""): Promise<string> {
  await requirePermission("users.manage", { entityType: "role", metadata: { name } });
  const id = `role_${crypto.randomUUID().slice(0, 8)}`;
  await execute(
    `INSERT INTO roles (id, name, description, is_system) VALUES (?1, ?2, ?3, 0)`,
    [id, name, description],
  );
  return id;
}

/** Clone a role's permission set into a new custom role. */
export async function cloneRole(sourceRoleId: string, newName: string): Promise<string> {
  const id = await createRole(newName, `Cloned from ${sourceRoleId}`);
  const keys = await rolePermissionKeys(sourceRoleId);
  for (const key of keys) {
    await execute(
      `INSERT OR IGNORE INTO role_permissions (role_id, permission_key, effect) VALUES (?1, ?2, 'allow')`,
      [id, key],
    );
  }
  return id;
}

export async function deleteRole(roleId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "role", entityId: roleId });
  // System roles are protected.
  await execute(`DELETE FROM roles WHERE id = ?1 AND is_system = 0`, [roleId]);
}

/** Toggle a single permission on a (custom) role. */
export async function setRolePermission(roleId: string, key: string, granted: boolean): Promise<void> {
  await requirePermission("users.manage", { entityType: "role", entityId: roleId, metadata: { key, granted } });
  if (granted) {
    await execute(
      `INSERT OR REPLACE INTO role_permissions (role_id, permission_key, effect) VALUES (?1, ?2, 'allow')`,
      [roleId, key],
    );
  } else {
    await execute(`DELETE FROM role_permissions WHERE role_id = ?1 AND permission_key = ?2`, [roleId, key]);
  }
}

export async function createGroup(name: string, description = ""): Promise<string> {
  await requirePermission("users.manage", { entityType: "group", metadata: { name } });
  const id = `grp_${crypto.randomUUID().slice(0, 8)}`;
  await execute(`INSERT INTO groups (id, name, description) VALUES (?1, ?2, ?3)`, [id, name, description]);
  return id;
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "group", entityId: groupId, metadata: { userId } });
  await execute(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?1, ?2)`, [groupId, userId]);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "group", entityId: groupId, metadata: { userId } });
  await execute(`DELETE FROM group_members WHERE group_id = ?1 AND user_id = ?2`, [groupId, userId]);
}

export async function groupMemberIds(groupId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(`SELECT user_id FROM group_members WHERE group_id = ?1`, [groupId]);
  return rows.map((r) => r.user_id);
}

/** Role ids assigned to a group. */
export async function groupRoleIds(groupId: string): Promise<string[]> {
  const rows = await query<{ role_id: string }>(`SELECT DISTINCT role_id FROM group_roles WHERE group_id = ?1`, [groupId]);
  return rows.map((r) => r.role_id);
}

/** Assign a role to a group (global scope). Members inherit the role's
 *  permissions via getEffectivePermissions (group_members → group_roles). */
export async function addGroupRole(groupId: string, roleId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "group", entityId: groupId, metadata: { roleId } });
  // Composite PK includes branch/module; NULLs aren't deduped by the PK, so
  // clear any existing global link first, then insert one with NULL scope
  // (NULL = applies to all branches/modules, which the resolver matches).
  await execute(`DELETE FROM group_roles WHERE group_id = ?1 AND role_id = ?2 AND branch_id IS NULL AND module_id IS NULL`, [groupId, roleId]);
  await execute(`INSERT INTO group_roles (group_id, role_id, branch_id, module_id) VALUES (?1, ?2, NULL, NULL)`, [groupId, roleId]);
}

export async function removeGroupRole(groupId: string, roleId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "group", entityId: groupId, metadata: { roleId } });
  await execute(`DELETE FROM group_roles WHERE group_id = ?1 AND role_id = ?2`, [groupId, roleId]);
}

/** Assign a role directly to a user (optionally branch/module scoped). */
export async function assignUserRole(userId: string, roleId: string, branchId: string | null = null, moduleId: string | null = null): Promise<void> {
  await requirePermission("users.manage", { entityType: "user", entityId: userId, metadata: { roleId } });
  await execute(
    `INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id, module_id) VALUES (?1, ?2, ?3, ?4)`,
    [userId, roleId, branchId, moduleId],
  );
}

export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  await requirePermission("users.manage", { entityType: "user", entityId: userId, metadata: { roleId } });
  await execute(`DELETE FROM user_roles WHERE user_id = ?1 AND role_id = ?2`, [userId, roleId]);
}

export async function userRoleIds(userId: string): Promise<string[]> {
  const rows = await query<{ role_id: string }>(`SELECT DISTINCT role_id FROM user_roles WHERE user_id = ?1`, [userId]);
  return rows.map((r) => r.role_id);
}

/**
 * Explain why a user has (or lacks) a permission — for the effective-access viewer.
 * Returns the decision + the contributing role names.
 */
export async function explainPermission(
  userId: string,
  permission: Permission,
  ctx: { branchId?: string | null; moduleId?: string | null } = {},
): Promise<{ allowed: boolean; viaRoles: string[] }> {
  const perms = await resolveEffectivePermissions(userId, ctx);
  const roleIdRows = await query<{ role_id: string; name: string }>(
    `SELECT DISTINCT r.id AS role_id, r.name FROM roles r
       JOIN role_permissions rp ON rp.role_id = r.id
       WHERE rp.permission_key = ?2 AND rp.effect = 'allow' AND r.id IN (
         SELECT role_id FROM user_roles WHERE user_id = ?1
         UNION
         SELECT gr.role_id FROM group_roles gr JOIN group_members gm ON gm.group_id = gr.group_id WHERE gm.user_id = ?1
       )`,
    [userId, permission],
  );
  return { allowed: perms.has(permission), viaRoles: roleIdRows.map((r) => r.name) };
}


export type { Permission };
