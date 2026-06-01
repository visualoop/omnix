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
  | "loyalty.manage"
  // HR
  | "hr.employees.view"
  | "hr.employees.manage"
  | "hr.payroll.view"
  | "hr.payroll.run"
  | "hr.payroll.approve"
  | "hr.attendance.view"
  | "hr.attendance.record"
  | "hr.leave.request"
  | "hr.leave.approve"
  | "invoicing.view"
  | "invoicing.create"
  | "invoicing.send"
  | "invoicing.payment"
  | "invoicing.cancel"
  | "banking.view"
  | "banking.manage"
  | "banking.reconcile"
  | "retail.brands.manage"
  | "retail.variants.manage"
  | "retail.price_lists.manage"
  | "retail.shrinkage.record"
  | "retail.laybys.use"
  | "retail.special_orders.use"
  // Hardware
  | "hardware.quotations.manage"
  | "hardware.delivery_notes.manage"
  | "hardware.accounts.manage"
  | "hardware.pricing.manage"
  | "hardware.commissions.view"
  | "hardware.reports.view"
  // Hospitality
  | "hospitality.tables.manage"
  | "hospitality.orders.take"
  | "hospitality.orders.send_kitchen"
  | "hospitality.orders.void"
  | "hospitality.kitchen.bump"
  | "hospitality.menu.manage"
  | "hospitality.recipes.manage"
  | "hospitality.bookings.manage"
  | "hospitality.checkin.manage"
  | "hospitality.folios.manage"
  | "hospitality.housekeeping.manage"
  | "hospitality.service_charge.manage"
  | "hospitality.reports.view";

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
  "hr.employees.view", "hr.employees.manage",
  "hr.payroll.view", "hr.payroll.run", "hr.payroll.approve",
  "hr.attendance.view", "hr.attendance.record",
  "hr.leave.request", "hr.leave.approve",
  "invoicing.view", "invoicing.create", "invoicing.send", "invoicing.payment", "invoicing.cancel",
  "banking.view", "banking.manage", "banking.reconcile",
  "retail.brands.manage", "retail.variants.manage", "retail.price_lists.manage",
  "retail.shrinkage.record", "retail.laybys.use", "retail.special_orders.use",
  "hardware.quotations.manage", "hardware.delivery_notes.manage", "hardware.accounts.manage",
  "hardware.pricing.manage", "hardware.commissions.view", "hardware.reports.view",
  "hospitality.tables.manage", "hospitality.orders.take", "hospitality.orders.send_kitchen",
  "hospitality.orders.void", "hospitality.kitchen.bump", "hospitality.menu.manage",
  "hospitality.recipes.manage", "hospitality.bookings.manage", "hospitality.checkin.manage",
  "hospitality.folios.manage", "hospitality.housekeeping.manage", "hospitality.service_charge.manage",
  "hospitality.reports.view",
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
    "hr.employees.view", "hr.attendance.view", "hr.attendance.record",
    "hr.leave.approve", "hr.payroll.view",
    "invoicing.view", "invoicing.create", "invoicing.send", "invoicing.payment",
    "banking.view", "banking.manage", "banking.reconcile",
    "retail.brands.manage", "retail.variants.manage", "retail.price_lists.manage",
    "retail.shrinkage.record", "retail.laybys.use", "retail.special_orders.use",
    "hardware.quotations.manage", "hardware.delivery_notes.manage", "hardware.accounts.manage",
    "hardware.pricing.manage", "hardware.commissions.view", "hardware.reports.view",
    "hospitality.tables.manage", "hospitality.orders.take", "hospitality.orders.send_kitchen",
    "hospitality.orders.void", "hospitality.kitchen.bump", "hospitality.menu.manage",
    "hospitality.recipes.manage", "hospitality.bookings.manage", "hospitality.checkin.manage",
    "hospitality.folios.manage", "hospitality.housekeeping.manage", "hospitality.service_charge.manage",
    "hospitality.reports.view",
  ],

  // Cashier: POS-focused. Can sell, take customer payments, view today's sales.
  cashier: [
    "pos.use", "sales.view",
    "inventory.view",
    "customers.view", "customers.edit", "customers.payment",
    "pharmacy.dispense", "pharmacy.refill",
    "cash_register.use",
    "reports.zreport",         // can run their end-of-day Z-report
    "hr.attendance.record",    // can clock self in/out
    "hr.leave.request",        // can request leave
    "hospitality.orders.take", "hospitality.orders.send_kitchen",
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

/** Check if a role grants a permission (for matrix UI; owner always true). */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  if (role === "owner") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export type PermissionGroup =
  | "Sales"
  | "Inventory"
  | "Purchasing"
  | "Customers"
  | "Suppliers"
  | "Pharmacy"
  | "Reports & Finance"
  | "Compliance"
  | "Admin"
  | "HR"
  | "Invoicing"
  | "Banking"
  | "Retail"
  | "Hardware"
  | "Hospitality";

export type PermissionRisk = "low" | "normal" | "high" | "critical";

export interface PermissionMeta {
  key: Permission;
  label: string;
  group: PermissionGroup;
  risk: PermissionRisk;
}

/** Human-readable catalog for role matrix and future custom-role editor. */
export const PERMISSION_CATALOG: PermissionMeta[] = [
  { key: "pos.use", label: "Use POS", group: "Sales", risk: "normal" },
  { key: "sales.view", label: "View sales", group: "Sales", risk: "low" },
  { key: "sales.refund", label: "Process refunds", group: "Sales", risk: "high" },
  { key: "sales.void", label: "Void sales", group: "Sales", risk: "critical" },
  { key: "inventory.view", label: "View inventory", group: "Inventory", risk: "low" },
  { key: "inventory.edit", label: "Edit products", group: "Inventory", risk: "normal" },
  { key: "inventory.bulk_edit", label: "Bulk edit inventory", group: "Inventory", risk: "high" },
  { key: "inventory.delete", label: "Delete products", group: "Inventory", risk: "critical" },
  { key: "purchase_orders.view", label: "View purchase orders", group: "Purchasing", risk: "low" },
  { key: "purchase_orders.create", label: "Create purchase orders", group: "Purchasing", risk: "normal" },
  { key: "purchase_orders.receive", label: "Receive goods", group: "Purchasing", risk: "normal" },
  { key: "stock_take.use", label: "Run stock takes", group: "Purchasing", risk: "high" },
  { key: "customers.view", label: "View customers", group: "Customers", risk: "low" },
  { key: "customers.edit", label: "Edit customers", group: "Customers", risk: "normal" },
  { key: "customers.payment", label: "Record customer payments", group: "Customers", risk: "normal" },
  { key: "suppliers.view", label: "View suppliers", group: "Suppliers", risk: "low" },
  { key: "suppliers.edit", label: "Edit suppliers", group: "Suppliers", risk: "normal" },
  { key: "suppliers.payment", label: "Record supplier payments", group: "Suppliers", risk: "normal" },
  { key: "pharmacy.dispense", label: "Dispense prescriptions", group: "Pharmacy", risk: "high" },
  { key: "pharmacy.refill", label: "Process refills", group: "Pharmacy", risk: "normal" },
  { key: "pharmacy.controlled", label: "Dispense controlled drugs", group: "Pharmacy", risk: "critical" },
  { key: "pharmacy.doctors.manage", label: "Manage prescribers", group: "Pharmacy", risk: "normal" },
  { key: "reports.view", label: "View reports", group: "Reports & Finance", risk: "low" },
  { key: "reports.zreport", label: "Run Z-report", group: "Reports & Finance", risk: "high" },
  { key: "reports.pnl", label: "View profit & loss", group: "Reports & Finance", risk: "normal" },
  { key: "expenses.view", label: "View expenses", group: "Reports & Finance", risk: "low" },
  { key: "expenses.create", label: "Create expenses", group: "Reports & Finance", risk: "normal" },
  { key: "cash_register.use", label: "Use cash register", group: "Reports & Finance", risk: "normal" },
  { key: "petty_cash.use", label: "Use petty cash", group: "Reports & Finance", risk: "normal" },
  { key: "etims.view", label: "View eTIMS", group: "Compliance", risk: "low" },
  { key: "etims.submit", label: "Submit eTIMS invoices", group: "Compliance", risk: "high" },
  { key: "claims.view", label: "View insurance claims", group: "Compliance", risk: "low" },
  { key: "claims.submit", label: "Submit insurance claims", group: "Compliance", risk: "high" },
  { key: "users.view", label: "View users", group: "Admin", risk: "low" },
  { key: "users.manage", label: "Manage users & roles", group: "Admin", risk: "critical" },
  { key: "settings.business", label: "Business settings", group: "Admin", risk: "high" },
  { key: "settings.network", label: "Network settings", group: "Admin", risk: "critical" },
  { key: "settings.backup", label: "Backup & restore", group: "Admin", risk: "critical" },
  { key: "settings.modules", label: "Manage modules", group: "Admin", risk: "critical" },
  { key: "license.view", label: "View license", group: "Admin", risk: "low" },
  { key: "license.manage", label: "Manage license", group: "Admin", risk: "critical" },
  { key: "audit.view", label: "View audit log", group: "Admin", risk: "normal" },
  { key: "promotions.manage", label: "Manage promotions", group: "Admin", risk: "normal" },
  { key: "loyalty.manage", label: "Manage loyalty", group: "Admin", risk: "normal" },
  { key: "hr.employees.view", label: "View employees", group: "HR", risk: "low" },
  { key: "hr.employees.manage", label: "Manage employees", group: "HR", risk: "high" },
  { key: "hr.payroll.view", label: "View payroll", group: "HR", risk: "normal" },
  { key: "hr.payroll.run", label: "Run payroll", group: "HR", risk: "critical" },
  { key: "hr.payroll.approve", label: "Approve payroll", group: "HR", risk: "critical" },
  { key: "hr.attendance.view", label: "View attendance", group: "HR", risk: "low" },
  { key: "hr.attendance.record", label: "Record attendance", group: "HR", risk: "normal" },
  { key: "hr.leave.request", label: "Request leave", group: "HR", risk: "low" },
  { key: "hr.leave.approve", label: "Approve leave", group: "HR", risk: "normal" },
  { key: "invoicing.view", label: "View invoices", group: "Invoicing", risk: "low" },
  { key: "invoicing.create", label: "Create invoices", group: "Invoicing", risk: "normal" },
  { key: "invoicing.send", label: "Send invoices", group: "Invoicing", risk: "normal" },
  { key: "invoicing.payment", label: "Record invoice payments", group: "Invoicing", risk: "normal" },
  { key: "invoicing.cancel", label: "Cancel invoices", group: "Invoicing", risk: "high" },
  { key: "banking.view", label: "View banking", group: "Banking", risk: "low" },
  { key: "banking.manage", label: "Manage bank accounts", group: "Banking", risk: "high" },
  { key: "banking.reconcile", label: "Reconcile bank", group: "Banking", risk: "high" },
  { key: "retail.brands.manage", label: "Manage brands", group: "Retail", risk: "normal" },
  { key: "retail.variants.manage", label: "Manage variants", group: "Retail", risk: "normal" },
  { key: "retail.price_lists.manage", label: "Manage price lists", group: "Retail", risk: "high" },
  { key: "retail.shrinkage.record", label: "Record shrinkage", group: "Retail", risk: "high" },
  { key: "retail.laybys.use", label: "Use laybys", group: "Retail", risk: "normal" },
  { key: "retail.special_orders.use", label: "Use special orders", group: "Retail", risk: "normal" },
  { key: "hardware.quotations.manage", label: "Manage quotations", group: "Hardware", risk: "normal" },
  { key: "hardware.delivery_notes.manage", label: "Manage delivery notes", group: "Hardware", risk: "normal" },
  { key: "hardware.accounts.manage", label: "Manage contractor accounts & credit", group: "Hardware", risk: "high" },
  { key: "hardware.pricing.manage", label: "Manage contractor pricing", group: "Hardware", risk: "high" },
  { key: "hardware.commissions.view", label: "View salesperson commissions", group: "Hardware", risk: "normal" },
  { key: "hardware.reports.view", label: "View hardware reports", group: "Hardware", risk: "low" },
  { key: "hospitality.tables.manage", label: "Manage tables & floor plan", group: "Hospitality", risk: "normal" },
  { key: "hospitality.orders.take", label: "Take orders", group: "Hospitality", risk: "normal" },
  { key: "hospitality.orders.send_kitchen", label: "Send orders to kitchen", group: "Hospitality", risk: "normal" },
  { key: "hospitality.orders.void", label: "Void / comp order items", group: "Hospitality", risk: "high" },
  { key: "hospitality.kitchen.bump", label: "Bump kitchen tickets", group: "Hospitality", risk: "low" },
  { key: "hospitality.menu.manage", label: "Manage menu & modifiers", group: "Hospitality", risk: "normal" },
  { key: "hospitality.recipes.manage", label: "Manage recipes & costing", group: "Hospitality", risk: "normal" },
  { key: "hospitality.bookings.manage", label: "Manage bookings", group: "Hospitality", risk: "normal" },
  { key: "hospitality.checkin.manage", label: "Check guests in/out", group: "Hospitality", risk: "normal" },
  { key: "hospitality.folios.manage", label: "Manage guest folios", group: "Hospitality", risk: "high" },
  { key: "hospitality.housekeeping.manage", label: "Update housekeeping status", group: "Hospitality", risk: "low" },
  { key: "hospitality.service_charge.manage", label: "Manage service charge", group: "Hospitality", risk: "high" },
  { key: "hospitality.reports.view", label: "View hospitality reports", group: "Hospitality", risk: "low" },
];

export const ROLES: Role[] = ["owner", "manager", "cashier", "viewer"];

/**
 * Effective-permission cache, populated by the auth store after RBAC
 * resolution. Kept here (not imported from the store) to avoid an import
 * cycle. `null` = not resolved → fall back to the static role matrix.
 */
let cachedPermissions: Set<string> | null = null;
export function setCachedPermissions(perms: string[] | null): void {
  cachedPermissions = perms ? new Set(perms) : null;
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;          // owner shortcut
  // Prefer the resolved dynamic RBAC set when available; else static matrix.
  if (cachedPermissions) return cachedPermissions.has(permission);
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
