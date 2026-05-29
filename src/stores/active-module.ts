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

export type ModuleId = "dawa" | "retail" | "hardware" | "electronics" | "salon" | "restaurant" | "core";

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
    tagline: "Bulk pricing, parts catalog, contractor accounts",
    status: "planned",
    setupPlaceholders: {
      businessName: "e.g., Jua Kali Hardware",
      address: "e.g., Industrial Area, Nairobi",
      phone: "0700 000 000",
      email: "info@yourhardware.co.ke",
    },
  },
  electronics: {
    id: "electronics",
    name: "Electronics",
    shortName: "Electronics",
    tagline: "IMEI tracking, warranty, repair tickets",
    status: "planned",
    setupPlaceholders: {
      businessName: "e.g., TechHub Electronics",
      address: "e.g., Tom Mboya Street, Nairobi",
      phone: "0700 000 000",
      email: "info@yourelectronics.co.ke",
    },
  },
  salon: {
    id: "salon",
    name: "Salon & Spa",
    shortName: "Salon",
    tagline: "Appointments, services, staff commissions",
    status: "planned",
    setupPlaceholders: {
      businessName: "e.g., Glamour Salon & Spa",
      address: "e.g., Westlands, Nairobi",
      phone: "0700 000 000",
      email: "info@yoursalon.co.ke",
    },
  },
  restaurant: {
    id: "restaurant",
    name: "Restaurant",
    shortName: "Restaurant",
    tagline: "Kitchen Order Tickets, tables, recipe costing",
    status: "planned",
    setupPlaceholders: {
      businessName: "e.g., Mama Oliech Restaurant",
      address: "e.g., Kenyatta Avenue, Nairobi",
      phone: "0700 000 000",
      email: "info@yourrestaurant.co.ke",
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
