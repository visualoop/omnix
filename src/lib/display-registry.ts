/**
 * Customer display module registry (Plan 09 §8).
 *
 * Per-module config for the customer-facing second screen: accent, idle copy,
 * active-state labels, and an optional per-line metadata renderer (e.g. retail
 * loyalty points, hardware account context). Keep it data-only — the display
 * page reads this and renders a flat, distance-legible premium screen.
 */
import type { ModuleId } from "@/stores/active-module";
import type { CartItem } from "@/services/sales";

export interface CustomerDisplayModuleConfig {
  moduleId: ModuleId;
  /** Tailwind accent classes for the thin top line + total emphasis. */
  accentLine: string;
  accentText: string;
  idleTitle: string;
  idleSubtitle: string;
  idleHint: string;
  activeLabels: {
    orderTitle: string;
    totalLabel: string;
  };
  /** Hide product names on the customer screen (Dawa privacy). */
  privacyMode: boolean;
  privacyLabel: string;
  /** Optional extra line under an item (e.g. unit, pack size). */
  lineMetadata?: (item: CartItem) => string | null;
  /** Message shown on the payment-success panel. */
  successMessage: string;
}

const CORE: CustomerDisplayModuleConfig = {
  moduleId: "core",
  accentLine: "bg-primary",
  accentText: "text-primary",
  idleTitle: "Welcome",
  idleSubtitle: "Karibu",
  idleHint: "Please proceed to the cashier",
  activeLabels: { orderTitle: "Your order", totalLabel: "Total to pay" },
  privacyMode: false,
  privacyLabel: "Item",
  successMessage: "Asante! Payment received",
};

const DISPLAY_CONFIGS: Record<string, CustomerDisplayModuleConfig> = {
  core: CORE,
  dawa: {
    ...CORE,
    moduleId: "dawa",
    accentLine: "bg-teal-500",
    accentText: "text-teal-400",
    idleTitle: "Dawa Pharmacy",
    idleSubtitle: "Your health, our priority",
    idleHint: "Please confirm your items with the pharmacist",
    activeLabels: { orderTitle: "Prescription items", totalLabel: "Amount to pay" },
    privacyMode: true,
    privacyLabel: "Pharmacy item",
    successMessage: "Get well soon · Asante",
  },
  retail: {
    ...CORE,
    moduleId: "retail",
    accentLine: "bg-amber-500",
    accentText: "text-amber-400",
    idleTitle: "Welcome",
    idleSubtitle: "Quality products, fair prices",
    idleHint: "Please proceed to the cashier",
    activeLabels: { orderTitle: "Your items", totalLabel: "Total to pay" },
    successMessage: "Asante! Karibu tena",
  },
  hardware: {
    ...CORE,
    moduleId: "hardware",
    accentLine: "bg-orange-500",
    accentText: "text-orange-400",
    idleTitle: "Welcome",
    idleSubtitle: "Building materials & hardware",
    idleHint: "Ask our team for a quotation",
    activeLabels: { orderTitle: "Your order", totalLabel: "Amount due" },
    successMessage: "Asante! See you next project",
  },
  hospitality: {
    ...CORE,
    moduleId: "hospitality",
    accentLine: "bg-emerald-600",
    accentText: "text-emerald-400",
    idleTitle: "Welcome",
    idleSubtitle: "Karibu — enjoy your stay",
    idleHint: "Your server will be with you shortly",
    activeLabels: { orderTitle: "Your bill", totalLabel: "Total" },
    successMessage: "Asante! Karibu tena",
  },
};

export function getDisplayConfig(moduleId: ModuleId): CustomerDisplayModuleConfig {
  return DISPLAY_CONFIGS[moduleId] || CORE;
}
