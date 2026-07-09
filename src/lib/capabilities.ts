/**
 * Cross-cutting module capabilities.
 *
 * Some features aren't owned by a single module — they're capabilities a
 * module opts into. Serialized-unit tracking + per-unit warranty is the first:
 * equipment dealers, electronics shops and general retail all need it, so it
 * must not be gated to `activeModule === "hardware"`. This helper is the single
 * source of truth for which modules surface the serial/warranty UI.
 */
import type { ModuleId } from "@/stores/active-module";

/**
 * Whether a module can track products by serial number (and therefore show
 * the serial/warranty product tab, the POS unit-picker, and the product
 * detail Units tab).
 *
 * Enabled: core, retail, hardware, pro (multi-trade). Electronics inherits
 * this once its variant lands.
 * Disabled: dawa (drugs are batch/expiry-tracked, not serialized) and
 * hospitality (menu items, not serialized goods).
 */
export function moduleTracksSerials(moduleId: ModuleId | string): boolean {
  return moduleId === "core"
    || moduleId === "retail"
    || moduleId === "hardware"
    || moduleId === "electronics"
    || moduleId === "pro";
}

/** Whether serialized units in this module are framed as equipment/fleet
 *  (vs. plain serialized goods). Drives labels: "Equipment"/"Fleet" for
 *  the hardware trade, "Serial & Warranty"/"Units" everywhere else. */
export function usesEquipmentFraming(moduleId: ModuleId | string): boolean {
  return moduleId === "hardware";
}

/** Module-aware label for the product serial/warranty configuration tab. */
export function serialTabLabel(moduleId: ModuleId | string): string {
  return usesEquipmentFraming(moduleId) ? "Equipment" : "Serial & Warranty";
}
