/**
 * Active module — which vertical the user installed.
 *
 * Stored in business_settings (table) under key 'app.active_module'.
 * Defaults to 'dawa' (Pharmacy is the first module).
 *
 * Used to:
 * - Show the module's logo next to SokoOS in the sidebar
 * - Customize copy throughout the app ("Pharmacy" vs "Hardware Store")
 * - Hide module-specific routes for irrelevant verticals
 */
import { create } from "zustand";
import { query, execute } from "@/lib/db";

export type ModuleId = "dawa" | "hardware" | "electronics" | "salon" | "restaurant" | "core";

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  shortName: string;
  tagline: string;
  status: "core" | "available" | "planned";
}

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  core: {
    id: "core",
    name: "Core ERP",
    shortName: "Core",
    tagline: "Inventory, POS, customers, suppliers, accounting",
    status: "core",
  },
  dawa: {
    id: "dawa",
    name: "Dawa Pharmacy",
    shortName: "Dawa",
    tagline: "Prescriptions, drug labels, refills, expiry, controlled substances",
    status: "available",
  },
  hardware: {
    id: "hardware",
    name: "Hardware Store",
    shortName: "Hardware",
    tagline: "Bulk pricing, parts catalog, contractor accounts",
    status: "planned",
  },
  electronics: {
    id: "electronics",
    name: "Electronics",
    shortName: "Electronics",
    tagline: "IMEI tracking, warranty, repair tickets",
    status: "planned",
  },
  salon: {
    id: "salon",
    name: "Salon & Spa",
    shortName: "Salon",
    tagline: "Appointments, services, staff commissions",
    status: "planned",
  },
  restaurant: {
    id: "restaurant",
    name: "Restaurant",
    shortName: "Restaurant",
    tagline: "Kitchen Order Tickets, tables, recipe costing",
    status: "planned",
  },
};

const STORAGE_KEY = "app.active_module";

interface ModuleStore {
  active: ModuleId;
  loaded: boolean;
  load: () => Promise<void>;
  setActive: (id: ModuleId) => Promise<void>;
}

export const useActiveModule = create<ModuleStore>((set, get) => ({
  active: "dawa",
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const rows = await query<{ value: string }>(
        `SELECT value FROM business_settings WHERE key = ?1`,
        [STORAGE_KEY],
      );
      const stored = rows[0]?.value as ModuleId | undefined;
      const valid = stored && MODULE_DEFINITIONS[stored] ? stored : "dawa";
      set({ active: valid, loaded: true });
    } catch {
      set({ active: "dawa", loaded: true });
    }
  },

  setActive: async (id) => {
    await execute(
      `INSERT INTO business_settings (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [STORAGE_KEY, id],
    );
    set({ active: id });
  },
}));

export function getActiveModule(): ModuleDefinition {
  return MODULE_DEFINITIONS[useActiveModule.getState().active];
}
