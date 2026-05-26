/**
 * Role-Based Access Control (RBAC)
 *
 * Defines what each role can do. Used by:
 * - Sidebar (hides nav items the user can't access)
 * - <RequireRole> route guard (blocks pages with a friendly message)
 * - Action gating in pages (e.g. hide Delete buttons)
 *
 * Roles, in order of privilege:
 *   owner > manager > cashier > viewer
 *
 * To add a new permission, add it to the Permission union and update the
 * role matrix below.
 */

import type { User } from "@/services/auth";

export type Role = "owner" | "manager" | "cashier" | "viewer";

export type Permission =
  // Sales
  | "pos.use"
  | "sales.view"
  | "sales.refund"
  | "sales.void"
  // Inventory
  | "inventory.view"
  | "inventory.edit"
  | "inventory.bulk_edit"
  | "inventory.delete"
  // Purchasing
  | "purchase_orders.view"
  | "purchase_orders.create"
  | "purchase_orders.receive"
  | "stock_take.use"
  // Customers
  | "customers.view"
  | "customers.edit"
  | "customers.payment"
  // Suppliers
  | "suppliers.view"
  | "suppliers.edit"
  | "suppliers.payment"
  // Pharmacy
  | "pharmacy.dispense"
  | "pharmacy.refill"
  | "pharmacy.controlled"
  | "pharmacy.doctors.manage"
  // Reports & accounting
  | "reports.view"
  | "reports.zreport"
  | "reports.pnl"
  | "expenses.view"
  | "expenses.create"
  | "cash_register.use"
  | "petty_cash.use"
  // Compliance
  | "etims.view"
  | "etims.submit"
  | "claims.view"
  | "claims.submit"
  // Admin
  | "users.view"
  | "users.manage"
  | "settings.business"
  | "settings.network"
  | "settings.backup"
  | "settings.modules"
  | "license.view"
  | "license.manage"
  | "audit.view"
  | "promotions.manage"
  | "loyalty.manage";

const ALL_PERMISSIONS: Permission[] = [
  "pos.use", "sales.view", "sales.refund", "sales.void",
  "inventory.view", "inventory.edit", "inventory.bulk_edit", "inventory.delete",
  "purchase_orders.view", "purchase_orders.create", "purchase_orders.receive", "stock_take.use",
  "customers.view", "customers.edit", "customers.payment",
  "suppliers.view", "suppliers.edit", "suppliers.payment",
  "pharmacy.dispense", "pharmacy.refill", "pharmacy.controlled", "pharmacy.doctors.manage",
  "reports.view", "reports.zreport", "reports.pnl",
  "expenses.view", "expenses.create",
  "cash_register.use", "petty_cash.use",
  "etims.view", "etims.submit", "claims.view", "claims.submit",
  "users.view", "users.manage",
  "settings.business", "settings.network", "settings.backup", "settings.modules",
  "license.view", "license.manage", "audit.view",
  "promotions.manage", "loyalty.manage",
];

/** Permission matrix. Each role gets exactly the permissions it should have. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Owner: everything. Period.
  owner: ALL_PERMISSIONS,

  // Manager: runs day-to-day operations. No user/license/network admin.
  manager: [
    "pos.use", "sales.view", "sales.refund", "sales.void",
    "inventory.view", "inventory.edit", "inventory.bulk_edit",
    "purchase_orders.view", "purchase_orders.create", "purchase_orders.receive", "stock_take.use",
    "customers.view", "customers.edit", "customers.payment",
    "suppliers.view", "suppliers.edit", "suppliers.payment",
    "pharmacy.dispense", "pharmacy.refill", "pharmacy.doctors.manage",
    "reports.view", "reports.zreport", "reports.pnl",
    "expenses.view", "expenses.create",
    "cash_register.use", "petty_cash.use",
    "etims.view", "etims.submit", "claims.view", "claims.submit",
    "settings.business", "settings.backup",
    "audit.view",
    "promotions.manage", "loyalty.manage",
  ],

  // Cashier: POS-focused. Can sell, take customer payments, view today's sales.
  cashier: [
    "pos.use", "sales.view",
    "inventory.view",
    "customers.view", "customers.edit", "customers.payment",
    "pharmacy.dispense", "pharmacy.refill",
    "cash_register.use",
    "reports.zreport",         // can run their end-of-day Z-report
  ],

  // Viewer: read-only. Reports, dashboards, no edits.
  viewer: [
    "sales.view",
    "inventory.view",
    "customers.view",
    "suppliers.view",
    "reports.view", "reports.pnl",
    "expenses.view",
    "etims.view", "claims.view",
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;          // owner shortcut
  return ROLE_PERMISSIONS[user.role as Role]?.includes(permission) ?? false;
}

export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

/** Friendly role description for UI */
export const ROLE_INFO: Record<Role, { label: string; tagline: string; color: string }> = {
  owner: {
    label: "Owner",
    tagline: "Full access — sees and changes everything",
    color: "text-violet-700",
  },
  manager: {
    label: "Manager",
    tagline: "Operations — inventory, purchases, reports, no admin",
    color: "text-blue-700",
  },
  cashier: {
    label: "Cashier",
    tagline: "POS-focused — sells, dispenses, runs Z-report",
    color: "text-emerald-700",
  },
  viewer: {
    label: "Viewer",
    tagline: "Read-only — sees reports, no changes",
    color: "text-muted-foreground",
  },
};
