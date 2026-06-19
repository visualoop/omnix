/**
 * Module hub pages — /pharmacy /retail /hardware /hospitality become
 * landing pages that arrange every child route as a tab. Replaces the
 * old expand/collapse submenu in the sidebar.
 *
 * The module's own dashboard (or the most-used screen) is the default
 * tab. Existing direct routes (`/pharmacy/cold-chain`, `/retail/laybys`
 * etc.) are still mounted for deep links.
 */
import { useAuthStore } from "@/stores/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  Pill, Snowflake, FileWarning, Stethoscope, RefreshCw,
  TrendingUp, Tag as TagIcon, Wallet as WalletIcon, ShoppingBag, Boxes,
  FileText, FileSignature, Users as UsersIcon, BarChart3,
  LayoutDashboard, UtensilsCrossed, ClipboardList, Flame,
  Bed, CalendarRange, Sparkles, FolderOpen, ChefHat,
} from "lucide-react";
import { HubLayout } from "@/components/layout/hub-layout";
import { useCountry } from "@/stores/country";
import { pharmacyTerm } from "@/lib/locale";

import { PharmacyPage } from "@/pages/pharmacy";
import { ColdChainPage } from "@/pages/cold-chain";
import { ControlledRegisterPage } from "@/pages/controlled-register";
import { ExpiryPage } from "@/pages/expiry";
import { DoctorsPage } from "@/pages/doctors";
import { RefillsPage } from "@/pages/refills";
import { AmrReportPage } from "@/pages/amr-report";
import { ClaimsPage } from "@/pages/claims";

import { RetailDashboardPage } from "@/pages/retail-dashboard";
import { BrandsPage } from "@/pages/retail-brands";
import { LaybysPage } from "@/pages/retail-laybys";
import { SpecialOrdersPage } from "@/pages/retail-special-orders";
import { ShrinkagePage } from "@/pages/retail-shrinkage";

import {
  HardwareDashboardPage, HardwareQuotationsPage, HardwareDeliveryNotesPage,
  HardwareAccountsPage, HardwareCommissionsPage, HardwareReportsPage,
} from "@/pages/hardware";

import {
  HospitalityDashboardPage, HospitalityTablesPage, HospitalityMenuPage,
  HospitalityOrdersPage, HospitalityKitchenPage,
  HospitalityRoomsPage, HospitalityBookingsPage, HospitalityHousekeepingPage,
  HospitalityFoliosPage, HospitalityRecipesPage, HospitalityReportsPage,
} from "@/pages/hospitality";

export function PharmacyHubPage() {
  const cc = useCountry((s) => s.code);
  const term = pharmacyTerm(cc);
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow={term}
      title={`${term} module`}
      description="Dispensing, controlled drugs, expiry watch, claims and refills."
      tabs={[
        { id: "dispense", label: "Dispense", icon: Pill, component: PharmacyPage, permission: "pharmacy.dispense" },
        { id: "expiry", label: "Expiry", icon: FileWarning, component: ExpiryPage, permission: "inventory.view" },
        { id: "controlled", label: "Controlled register", icon: ClipboardList, component: ControlledRegisterPage, permission: "pharmacy.dispense" },
        { id: "cold-chain", label: "Cold chain", icon: Snowflake, component: ColdChainPage, permission: "pharmacy.dispense" },
        { id: "doctors", label: "Doctors", icon: Stethoscope, component: DoctorsPage, permission: "pharmacy.doctors.manage" },
        { id: "refills", label: "Refills", icon: RefreshCw, component: RefillsPage, permission: "pharmacy.refill" },
        { id: "amr", label: "AMR report", icon: BarChart3, component: AmrReportPage, permission: "reports.view" },
        { id: "claims", label: "Claims", icon: FileSignature, component: ClaimsPage, permission: "claims.view" },
      ]}
      hasPermission={has}
    />
  );
}

export function RetailHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Module"
      title="Retail"
      description="Shop-floor insights, brand mix, laybys, special orders, shrinkage."
      tabs={[
        { id: "insights", label: "Insights", icon: TrendingUp, component: RetailDashboardPage, permission: "reports.view" },
        { id: "brands", label: "Brands", icon: TagIcon, component: BrandsPage, permission: "retail.brands.manage" },
        { id: "laybys", label: "Laybys", icon: WalletIcon, component: LaybysPage, permission: "retail.laybys.use" },
        { id: "special-orders", label: "Special orders", icon: ShoppingBag, component: SpecialOrdersPage, permission: "retail.special_orders.use" },
        { id: "shrinkage", label: "Shrinkage", icon: Boxes, component: ShrinkagePage, permission: "retail.shrinkage.record" },
      ]}
      hasPermission={has}
    />
  );
}

export function HardwareHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Module"
      title="Hardware"
      description="Quotations, delivery notes, contractor accounts, sales-rep commissions."
      tabs={[
        { id: "overview", label: "Overview", icon: LayoutDashboard, component: HardwareDashboardPage, permission: "hardware.reports.view" },
        { id: "quotations", label: "Quotations", icon: FileText, component: HardwareQuotationsPage, permission: "hardware.quotations.manage" },
        { id: "delivery-notes", label: "Delivery notes", icon: FileSignature, component: HardwareDeliveryNotesPage, permission: "hardware.delivery_notes.manage" },
        { id: "accounts", label: "Accounts", icon: UsersIcon, component: HardwareAccountsPage, permission: "hardware.accounts.manage" },
        { id: "commissions", label: "Commissions", icon: WalletIcon, component: HardwareCommissionsPage, permission: "hardware.accounts.manage" },
        { id: "reports", label: "Reports", icon: BarChart3, component: HardwareReportsPage, permission: "hardware.reports.view" },
      ]}
      hasPermission={has}
    />
  );
}

export function HospitalityHubPage() {
  const user = useAuthStore((s) => s.user);
  const has = (perm: string) => hasPermission(user, perm as Permission);
  return (
    <HubLayout
      eyebrow="Module"
      title="Hospitality"
      description="Tables, kitchen, rooms, bookings — the whole front-of-house and back-of-house."
      tabs={[
        { id: "overview", label: "Overview", icon: LayoutDashboard, component: HospitalityDashboardPage, permission: "hospitality.tables.manage" },
        { id: "tables", label: "Tables", icon: UtensilsCrossed, component: HospitalityTablesPage, permission: "hospitality.tables.manage" },
        { id: "menu", label: "Menu", icon: ClipboardList, component: HospitalityMenuPage, permission: "hospitality.menu.manage" },
        { id: "orders", label: "Orders", icon: FileText, component: HospitalityOrdersPage, permission: "hospitality.orders.manage" },
        { id: "kitchen", label: "Kitchen", icon: Flame, component: HospitalityKitchenPage, permission: "hospitality.kitchen.view" },
        { id: "rooms", label: "Rooms", icon: Bed, component: HospitalityRoomsPage, permission: "hospitality.rooms.manage" },
        { id: "bookings", label: "Bookings", icon: CalendarRange, component: HospitalityBookingsPage, permission: "hospitality.bookings.manage" },
        { id: "housekeeping", label: "Housekeeping", icon: Sparkles, component: HospitalityHousekeepingPage, permission: "hospitality.rooms.manage" },
        { id: "folios", label: "Folios", icon: FolderOpen, component: HospitalityFoliosPage, permission: "hospitality.folios.manage" },
        { id: "recipes", label: "Recipes", icon: ChefHat, component: HospitalityRecipesPage, permission: "hospitality.recipes.manage" },
        { id: "reports", label: "Reports", icon: BarChart3, component: HospitalityReportsPage, permission: "hospitality.reports.view" },
      ]}
      hasPermission={has}
    />
  );
}
