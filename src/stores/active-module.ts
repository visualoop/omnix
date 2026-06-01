/**
 * Active module — which vertical the user installed.
 *
 * Stored in settings (table) under key 'app.active_module'.
 * Defaults to 'dawa' (Pharmacy is the first module).
 *
 * Used to:
 * - Show the module's logo next to Omnix in the sidebar
 * - Customize copy throughout the app ("Pharmacy" vs "Hardware Store")
 * - Hide module-specific routes for irrelevant verticals
 */
import { create } from "zustand";
import { query, execute } from "@/lib/db";

export type ModuleId = "dawa" | "retail" | "hardware" | "hospitality" | "core";

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  shortName: string;
  tagline: string;
  status: "core" | "available" | "planned";
  setupPlaceholders: {
    businessName: string;
    address: string;
    phone: string;
    email: string;
  };
}

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  core: {
    id: "core",
    name: "Core ERP",
    shortName: "Core",
    tagline: "Inventory, POS, customers, suppliers, accounting",
    status: "core",
    setupPlaceholders: {
      businessName: "e.g., My Business",
      address: "e.g., Moi Avenue, Nairobi",
      phone: "0700 000 000",
      email: "info@mybusiness.co.ke",
    },
  },
  dawa: {
    id: "dawa",
    name: "Dawa Pharmacy",
    shortName: "Dawa",
    tagline: "Prescriptions, drug labels, refills, expiry, controlled substances",
    status: "available",
    setupPlaceholders: {
      businessName: "e.g., Afya Pharmacy",
      address: "e.g., Moi Avenue, Nairobi",
      phone: "0700 000 000",
      email: "info@yourpharmacy.co.ke",
    },
  },
  retail: {
    id: "retail",
    name: "Soko Retail",
    shortName: "Retail",
    tagline: "Brands, variants, laybys, special orders, shrinkage tracking",
    status: "available",
    setupPlaceholders: {
      businessName: "e.g., Mama Njeri's Shop",
      address: "e.g., Kimathi Street, Nairobi",
      phone: "0700 000 000",
      email: "info@yourshop.co.ke",
    },
  },
  hardware: {
    id: "hardware",
    name: "Hardware Store",
    shortName: "Hardware",
    tagline: "Quotations, delivery notes, contractor accounts, bulk pricing",
    status: "available",
    setupPlaceholders: {
      businessName: "e.g., Jua Kali Hardware",
      address: "e.g., Industrial Area, Nairobi",
      phone: "0700 000 000",
      email: "info@yourhardware.co.ke",
    },
  },
  hospitality: {
    id: "hospitality",
    name: "Soko Hospitality",
    shortName: "Hospitality",
    tagline: "Restaurant POS, kitchen, rooms, bookings, folios",
    status: "available",
    setupPlaceholders: {
      businessName: "e.g., Savanna Restaurant & Rooms",
      address: "e.g., Kenyatta Avenue, Nairobi",
      phone: "0700 000 000",
      email: "info@yourplace.co.ke",
    },
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
        `SELECT value FROM settings WHERE key = ?1`,
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
    // Hard gate: never switch into a module the licence doesn't include
    // (core is always allowed).
    const { isModuleEntitled } = await import("@/stores/entitlements");
    if (!isModuleEntitled(id)) {
      throw new Error("This module is not included in your licence.");
    }
    await execute(
      `INSERT INTO settings (key, value) VALUES (?1, ?2)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [STORAGE_KEY, id],
    );
    set({ active: id });
  },
}));

export function getActiveModule(): ModuleDefinition {
  return MODULE_DEFINITIONS[useActiveModule.getState().active];
}
