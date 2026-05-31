/**
 * Customer display module registry.
 * Per-module config for what the customer-facing display shows.
 */
import type { ModuleId } from "@/stores/active-module";

export interface CustomerDisplayModuleConfig {
  moduleId: ModuleId;
  idleTitle: string;
  idleSubtitle: string;
  activeLabels: {
    orderTitle: string;
    totalLabel: string;
  };
  privacyMode: boolean;
}

const DISPLAY_CONFIGS: Record<string, CustomerDisplayModuleConfig> = {
  dawa: {
    moduleId: "dawa",
    idleTitle: "Dawa Pharmacy",
    idleSubtitle: "Your health, our priority",
    activeLabels: { orderTitle: "Prescription items", totalLabel: "Amount to pay" },
    privacyMode: true,
  },
  retail: {
    moduleId: "retail",
    idleTitle: "Soko Retail",
    idleSubtitle: "Quality products, fair prices",
    activeLabels: { orderTitle: "Your items", totalLabel: "Total to pay" },
    privacyMode: false,
  },
  core: {
    moduleId: "core",
    idleTitle: "Welcome",
    idleSubtitle: "Thank you for shopping with us",
    activeLabels: { orderTitle: "Your items", totalLabel: "Total to pay" },
    privacyMode: false,
  },
};

export function getDisplayConfig(moduleId: ModuleId): CustomerDisplayModuleConfig {
  return DISPLAY_CONFIGS[moduleId] || DISPLAY_CONFIGS.core;
}
