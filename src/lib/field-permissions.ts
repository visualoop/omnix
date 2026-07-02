/**
 * Field-level permissions.
 *
 * Adds a granular layer on top of the existing role permissions in
 * lib/permissions.ts. Where a whole page might be visible to `manager` (via
 * `inventory.view`), specific fields on that page (buying_price, cost) can
 * be hidden by default.
 *
 * Design:
 *   - Each protected field has a permission scope of form 'field.<entity>.<field>'.
 *     e.g. 'field.product.buying_price', 'field.employee.salary'.
 *   - By default, cashier/viewer roles are DENIED protected fields; manager
 *     and owner see everything.
 *   - Components consume via `useFieldPermission('field.product.buying_price')`.
 *   - Server-side calls should also filter via `canSeeField` when returning
 *     rows to LAN clients (defensive redaction).
 *
 * This is intentionally simpler than a per-user override matrix — Omnix
 * SMEs don't need SOX-grade granularity. Roles + a static deny-list covers
 * 95% of cases; owner can extend via UI later.
 */
import type { Role } from "@/lib/permissions";

export type FieldScope = string; // 'field.<entity>.<field>'

const DENIED_BY_ROLE: Record<Role, FieldScope[]> = {
  owner: [],
  manager: [],
  cashier: [
    "field.product.buying_price",
    "field.product.cost",
    "field.employee.salary",
    "field.employee.bank_account",
    "field.supplier.credit_terms",
    "field.batch.cost",
  ],
  viewer: [
    "field.product.buying_price",
    "field.product.cost",
    "field.employee.salary",
    "field.employee.bank_account",
    "field.supplier.credit_terms",
    "field.batch.cost",
  ],
};

/**
 * True if the given role can see the field.
 */
export function canSeeField(role: Role | null | undefined, scope: FieldScope): boolean {
  if (!role) return false;
  const denies = DENIED_BY_ROLE[role] ?? [];
  return !denies.includes(scope);
}

/**
 * Mask a field value based on role. Returns '••••' when not permitted.
 */
export function maskField<T>(role: Role | null | undefined, scope: FieldScope, value: T): T | string {
  return canSeeField(role, scope) ? value : "••••";
}

/**
 * List every field scope currently protected — useful for the admin UI to
 * render a matrix + eventually let owner override.
 */
export function listProtectedScopes(): FieldScope[] {
  const set = new Set<FieldScope>();
  for (const role of Object.keys(DENIED_BY_ROLE) as Role[]) {
    for (const scope of DENIED_BY_ROLE[role]) set.add(scope);
  }
  return Array.from(set).sort();
}

/**
 * React helper — reads the current user's role from the auth store.
 * Component usage:
 *   const canSeePrice = useFieldPermission('field.product.buying_price');
 *   {canSeePrice ? <span>{price}</span> : <span className="text-muted">••••</span>}
 */
export function useFieldPermission(scope: FieldScope): boolean {
  // Lazy import to avoid circular deps at build time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("@/stores/auth") as typeof import("@/stores/auth");
  const role = useAuthStore((s) => s.user?.role as Role | undefined);
  return canSeeField(role, scope);
}
