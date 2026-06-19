/**
 * Settings registry — the single declarative source of truth for every
 * settings surface. The SettingsLayout renders its sidebar from this list.
 *
 * Each entry is gated by permission and (optionally) an owning module, so the
 * settings shell is automatically RBAC- and entitlement-aware. Module sub-
 * registries (Hardware, Hospitality) contribute via `registerSettings()`.
 */
import {
  Building2, CreditCard, FileCheck, Shield, Users, Key, Database, Cloud, Activity,
  Network, Boxes, ShieldCheck, Monitor, Ruler, Percent,
  Tag,           // Categories
  // Distinct icons for settings duplicate-fix:
  MapPin,        // Locations & Branches
  UsersRound,    // Groups
  KeyRound,      // Access Explorer
  Calculator,    // Tax & VAT
  ListChecks,    // Price Lists
  Printer,       // Receipt Template
  Sparkles,      // AI integration
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleId } from "@/stores/active-module";
import type { Permission } from "@/lib/permissions";

export type SettingsGroup =
  | "Business" | "Access" | "Finance" | "Operations"
  | "Dawa" | "Retail" | "Hardware" | "Hospitality";

export interface SettingsNavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
  group: SettingsGroup;
  /** When set, the item only shows if this module is the active module. */
  module?: ModuleId;
}

/** Render order for the grouped settings sidebar. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  "Business", "Access", "Finance", "Operations", "Dawa", "Retail", "Hardware", "Hospitality",
];

const CORE_SETTINGS: SettingsNavItem[] = [
  { to: "/settings", label: "Business Profile", description: "Name, contacts, identity", icon: Building2, permission: "settings.business", group: "Business" },
  { to: "/settings/branches", label: "Locations & Branches", description: "Branches and user access", icon: MapPin, permission: "settings.business", group: "Business" },
  { to: "/settings/users", label: "Users & Permissions", description: "Accounts, roles, branch access", icon: Users, permission: "users.view", group: "Access" },
  { to: "/settings/roles", label: "Roles", description: "Build roles and permissions", icon: ShieldCheck, permission: "users.manage", group: "Access" },
  { to: "/settings/groups", label: "Groups", description: "Bulk-assign roles to users", icon: UsersRound, permission: "users.manage", group: "Access" },
  { to: "/settings/access-audit", label: "Access Explorer", description: "Why a user can or can't", icon: KeyRound, permission: "users.manage", group: "Access" },
  { to: "/settings/payments", label: "Payment Methods", description: "Cash, M-Pesa, cards, bank", icon: CreditCard, permission: "settings.business", group: "Finance" },
  { to: "/settings/taxes", label: "Tax & VAT", description: "Default rates, tax classes", icon: Calculator, permission: "settings.business", group: "Finance" },
  { to: "/settings/categories", label: "Categories", description: "Group products by type", icon: Tag, permission: "inventory.edit", group: "Operations" },
  { to: "/settings/price-lists", label: "Price Lists", description: "Customer pricing tiers", icon: ListChecks, permission: "retail.price_lists.manage", group: "Finance" },
  { to: "/settings/etims", label: "KRA eTIMS", description: "Tax invoice signing", icon: FileCheck, permission: "etims.view", group: "Finance" },
  { to: "/settings/network", label: "LAN Multi-device", description: "Master/client mode", icon: Network, permission: "settings.network", group: "Operations" },
  { to: "/settings/modules", label: "Modules", description: "Active vertical and roadmap", icon: Boxes, permission: "settings.modules", group: "Operations" },
  { to: "/settings/backup", label: "Backup & Restore", description: "Protect business data", icon: Database, permission: "settings.backup", group: "Operations" },
  { to: "/settings/cloud-backup", label: "Cloud Backup", description: "Encrypted offsite copies", icon: Cloud, permission: "settings.backup", group: "Operations" },
  { to: "/settings/customer-display", label: "Customer Display", description: "Second screen settings", icon: Monitor, permission: "settings.business", group: "Operations" },
  { to: "/settings/ai", label: "AI Integration", description: "Provider keys, features, activity", icon: Sparkles, permission: "settings.business", group: "Operations" },
  { to: "/settings/receipt", label: "Receipt Template", description: "Footer message and branding", icon: Printer, permission: "settings.business", group: "Operations" },
  { to: "/settings/audit", label: "Audit Log", description: "Security and compliance history", icon: Activity, permission: "audit.view", group: "Operations" },
  { to: "/settings/license", label: "License", description: "Machine binding and updates", icon: Key, permission: "license.view", group: "Operations" },
  { to: "/settings/insurance", label: "Insurance Providers", description: "SHA and private insurers", icon: Shield, permission: "claims.view", group: "Dawa", module: "dawa" },
];

const moduleSettings: SettingsNavItem[] = [];

/** Module sub-registries (Hardware/Hospitality, Task 15) push their entries here. */
export function registerSettings(items: SettingsNavItem[]): void {
  for (const item of items) {
    if (!moduleSettings.some((s) => s.to === item.to)) moduleSettings.push(item);
  }
}

/** The full, current registry (core + any registered module settings). */
export function settingsRegistry(): SettingsNavItem[] {
  return [...CORE_SETTINGS, ...moduleSettings];
}

// ── Hardware module settings (shown only when hardware is the active module) ──
registerSettings([
  { to: "/settings/hardware/units", label: "Hardware Units & Credit", description: "Bulk units and default credit terms", icon: Ruler, permission: "hardware.accounts.manage", group: "Hardware", module: "hardware" },
  { to: "/settings/hospitality/service-charge", label: "Service Charge", description: "Auto service charge percent", icon: Percent, permission: "hospitality.service_charge.manage", group: "Hospitality", module: "hospitality" },
]);
