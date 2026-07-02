/**
 * Settings registry — the single declarative source of truth for every
 * settings surface. The SettingsLayout renders its tab bar + item list
 * from this list.
 *
 * Groups are job-oriented, not implementation-oriented. Every group
 * answers a different question the owner has when they open Settings:
 *   Business    — "who am I / where do I trade?"
 *   People      — "who works here + what can they do?"
 *   Money       — "how do I get paid + taxed?"
 *   Hardware    — "what physical devices are plugged in?"
 *   Application — "the app itself on this computer"
 *   System      — "data safety, LAN, audit trail"
 *   Module-specific tabs only show when their module is active.
 *
 * Every entry stays at its existing route path so bookmarks + deep
 * links from earlier releases keep resolving.
 */
import {
  MapPin,
  Key as KeyRound,
  Users as UsersRound,
  Printer,
  Sparkle as Sparkles,
  ListChecks,
  Pulse as Activity,
  Building as Building2,
  Cloud,
  CreditCard,
  Database,
  DeviceMobile,
  FileText as FileCheck,
  Key,
  Monitor,
  Network,
  Package as Boxes,
  Percent,
  Ruler,
  Shield,
  ShieldCheck,
  Tag,
  Users,
  Calculator,
  Power,
  ArrowsClockwise,
  Barcode,
} from "@phosphor-icons/react";
import type { Icon as LucideIcon } from "@phosphor-icons/react";
import type { ModuleId } from "@/stores/active-module";
import type { Permission } from "@/lib/permissions";

/**
 * Seven job-oriented groups, ordered by how often the owner touches them.
 * "Dawa" / "Retail" / "Hardware" / "Hospitality" only render when the
 * matching module is active.
 */
export type SettingsGroup =
  | "Business"
  | "People"
  | "Money"
  | "Hardware Devices"
  | "Application"
  | "System"
  | "Dawa"
  | "Retail"
  | "Hardware"
  | "Hospitality";

export interface SettingsNavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
  group: SettingsGroup;
  /** When set, the item only shows if this module is the active module. */
  module?: ModuleId;
  /** Hide from the sidebar but keep the route resolvable (used for legacy paths). */
  hidden?: boolean;
}

/** Render order for the grouped settings sidebar. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  "Business",
  "People",
  "Money",
  "Hardware Devices",
  "Application",
  "System",
  "Dawa",
  "Retail",
  "Hardware",
  "Hospitality",
];

const CORE_SETTINGS: SettingsNavItem[] = [
  // ── Business ──────────────────────────────────────────────
  { to: "/settings", label: "Business profile", description: "Name, contacts, identity", icon: Building2, permission: "settings.business", group: "Business" },
  { to: "/settings/branches", label: "Locations & branches", description: "Branches and user access", icon: MapPin, permission: "settings.business", group: "Business" },
  { to: "/settings/modules", label: "Active module", description: "Which trade is running", icon: Boxes, permission: "settings.modules", group: "Business" },

  // ── People ────────────────────────────────────────────────
  { to: "/settings/users", label: "Staff", description: "Staff accounts and branch access", icon: Users, permission: "users.view", group: "People" },
  { to: "/settings/roles", label: "Roles", description: "Build roles and permissions", icon: ShieldCheck, permission: "users.manage", group: "People" },
  { to: "/settings/groups", label: "Groups", description: "Bulk-assign roles to users", icon: UsersRound, permission: "users.manage", group: "People" },
  { to: "/settings/access-audit", label: "Access explorer", description: "Why a user can or can't", icon: KeyRound, permission: "users.manage", group: "People" },

  // ── Money ─────────────────────────────────────────────────
  { to: "/settings/payments", label: "Payment methods", description: "Cash, M-Pesa, cards, bank", icon: CreditCard, permission: "settings.business", group: "Money" },
  { to: "/settings/taxes", label: "Tax & VAT", description: "Default rates, tax classes", icon: Calculator, permission: "settings.business", group: "Money" },
  { to: "/settings/price-lists", label: "Price lists", description: "Customer pricing tiers", icon: ListChecks, permission: "retail.price_lists.manage", group: "Money" },
  { to: "/settings/categories", label: "Categories", description: "Group products by type", icon: Tag, permission: "inventory.edit", group: "Money" },
  { to: "/settings/etims", label: "KRA eTIMS", description: "Tax invoice signing", icon: FileCheck, permission: "etims.view", group: "Money" },

  // ── Hardware Devices ──────────────────────────────────────
  { to: "/settings/printing", label: "Printing", description: "Auto-print, drawer kick, preferred printers", icon: Printer, permission: "settings.business", group: "Hardware Devices" },
  { to: "/settings/receipt", label: "Receipt template", description: "Footer message and branding", icon: Printer, permission: "settings.business", group: "Hardware Devices" },
  { to: "/settings/scanner", label: "Barcode scanner", description: "Test scanner, terminator, auto-focus", icon: Barcode, permission: "settings.business", group: "Hardware Devices" },
  { to: "/settings/customer-display", label: "Customer display", description: "Second screen settings", icon: Monitor, permission: "settings.business", group: "Hardware Devices" },

  // ── Application (this app on this computer) ───────────────
  { to: "/settings/display", label: "Display & touch", description: "Density, touch mode, target sizes", icon: DeviceMobile, permission: "settings.business", group: "Application" },
  { to: "/settings/ai", label: "AI integration", description: "Provider keys, features, activity", icon: Sparkles, permission: "settings.business", group: "Application" },
  { to: "/settings/updates", label: "Software updates", description: "Check for updates, install patches", icon: ArrowsClockwise, permission: "settings.business", group: "Application" },
  { to: "/settings/autostart", label: "Start with Windows", description: "Launch automatically on boot", icon: Power, permission: "settings.business", group: "Application" },
  { to: "/settings/2fa", label: "Two-factor authentication", description: "Require a phone code on sign-in", icon: ShieldCheck, permission: "settings.business", group: "Application" },
  { to: "/settings/peripherals", label: "Peripherals", description: "Cash drawer, weight scale, kitchen printer, card reader", icon: Boxes, permission: "settings.business", group: "Hardware Devices" },
  { to: "/settings/currencies", label: "Currencies &amp; FX", description: "Add exchange rates for USD, EUR, UGX, etc.", icon: Calculator, permission: "settings.business", group: "Money" },
  { to: "/settings/licenses", label: "Licences", description: "Active modules, sync, add another", icon: Key, permission: "license.view", group: "Application" },

  // ── System ────────────────────────────────────────────────
  { to: "/settings/network", label: "LAN multi-device", description: "Master / client mode", icon: Network, permission: "settings.network", group: "System" },
  { to: "/settings/backup", label: "Backup & restore", description: "Protect business data", icon: Database, permission: "settings.backup", group: "System" },
  { to: "/settings/cloud-backup", label: "Cloud backup", description: "Encrypted offsite copies", icon: Cloud, permission: "settings.backup", group: "System" },
  { to: "/settings/audit", label: "Audit log", description: "Security and compliance history", icon: Activity, permission: "audit.view", group: "System" },

  // ── Module-specific ───────────────────────────────────────
  { to: "/settings/insurance", label: "Insurance providers", description: "SHA and private insurers", icon: Shield, permission: "claims.view", group: "Dawa", module: "dawa" },

  // ── Legacy paths — resolvable but hidden from the sidebar ─
  { to: "/settings/license", label: "License (legacy)", description: "Redirects to Licences", icon: Key, permission: "license.view", group: "Application", hidden: true },
];

const moduleSettings: SettingsNavItem[] = [];

/** Module sub-registries (Hardware / Hospitality) push their entries here. */
export function registerSettings(items: SettingsNavItem[]): void {
  for (const item of items) {
    if (!moduleSettings.some((s) => s.to === item.to)) moduleSettings.push(item);
  }
}

/** The full, current registry (core + any registered module settings). */
export function settingsRegistry(): SettingsNavItem[] {
  return [...CORE_SETTINGS, ...moduleSettings];
}

// ── Hardware module + Hospitality module contributions ─────
registerSettings([
  { to: "/settings/hardware/units", label: "Hardware units & credit", description: "Bulk units and default credit terms", icon: Ruler, permission: "hardware.accounts.manage", group: "Hardware", module: "hardware" },
  { to: "/settings/hospitality/service-charge", label: "Service charge", description: "Auto service charge percent", icon: Percent, permission: "hospitality.service_charge.manage", group: "Hospitality", module: "hospitality" },
]);
