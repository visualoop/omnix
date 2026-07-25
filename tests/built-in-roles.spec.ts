import { describe, expect, it } from "vitest";
import {
  BUILT_IN_ROLES,
  BUILT_IN_ROLE_IDS,
  defaultBuiltInRoleId,
} from "@/lib/built-in-roles";
import {
  MODULE_ACCESS_PERMISSIONS,
  PERMISSION_CATALOG,
  ROLES,
  getPermissionsForRole,
  type Permission,
} from "@/lib/permissions";

const MODULES = ["core", "dawa", "retail", "hardware", "hospitality", "salon"];

const MODULE_PERMISSION_PREFIX: Partial<Record<(typeof MODULES)[number], string>> = {
  dawa: "pharmacy.",
  retail: "retail.",
  hardware: "hardware.",
  hospitality: "hospitality.",
  salon: "salon.",
};

const STANDALONE_MODULE_PERMISSIONS: Record<string, readonly Permission[]> = {
  dawa: ["claims.view", "claims.submit"],
  retail: ["promotions.manage", "loyalty.manage"],
};

describe("built-in roles", () => {
  it("uses unique, stable, readable IDs", () => {
    expect(BUILT_IN_ROLES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(BUILT_IN_ROLE_IDS).size).toBe(BUILT_IN_ROLE_IDS.length);
    for (const role of BUILT_IN_ROLES) {
      expect(role.id).toMatch(/^role_[a-z0-9_]+$/);
      expect(role.name.trim()).not.toBe("");
      expect(role.description.length).toBeGreaterThan(20);
    }
  });

  it("covers Core and every shipped module", () => {
    expect(new Set(BUILT_IN_ROLES.map((role) => role.module))).toEqual(new Set(MODULES));
    for (const module of MODULES) {
      expect(BUILT_IN_ROLES.filter((role) => role.module === module).length).toBeGreaterThan(0);
    }
  });

  it("only grants permissions from the canonical permission catalogue", () => {
    const valid = new Set(PERMISSION_CATALOG.map((permission) => permission.key));
    for (const role of BUILT_IN_ROLES) {
      expect(new Set(role.permissions).size, `${role.id} has duplicate permissions`).toBe(role.permissions.length);
      for (const permission of role.permissions) {
        expect(valid.has(permission), `${role.id} contains unknown permission ${permission}`).toBe(true);
      }
    }
  });

  it("keeps every legacy fallback valid and deterministic", () => {
    for (const role of BUILT_IN_ROLES) {
      expect(ROLES).toContain(role.legacyRole);
    }
    expect(defaultBuiltInRoleId("owner")).toBe("role_owner");
    expect(defaultBuiltInRoleId("manager")).toBe("role_manager");
    expect(defaultBuiltInRoleId("cashier")).toBe("role_cashier");
    expect(defaultBuiltInRoleId("viewer")).toBe("role_viewer");
  });


  it("gives every vertical job at least one permission that opens its module", () => {
    for (const role of BUILT_IN_ROLES) {
      if (role.module === "core") continue;
      const modulePermissions: readonly Permission[] = MODULE_ACCESS_PERMISSIONS[role.module];
      expect(
        role.permissions.some((permission) => modulePermissions.includes(permission)),
        `${role.id} cannot open the ${role.module} module`,
      ).toBe(true);
    }
  });

  it("lets both the general Cashier and dedicated Salon Cashier work in Salon", () => {
    const cashier = BUILT_IN_ROLES.find((role) => role.id === "role_cashier");
    const salonCashier = BUILT_IN_ROLES.find((role) => role.id === "role_salon_cashier");
    expect(cashier?.permissions).toContain("salon.access");
    expect(cashier?.permissions).toContain("salon.appointments.manage");
    expect(salonCashier?.permissions).toContain("salon.access");
    expect(salonCashier?.permissions).toContain("salon.appointments.manage");
  });

  it("includes practical HR, payroll, finance, procurement, compliance, and administration jobs", () => {
    const ids = new Set<string>(BUILT_IN_ROLE_IDS);
    for (const id of [
      "role_core_hr_manager",
      "role_core_payroll",
      "role_core_accountant",
      "role_core_procurement",
      "role_core_compliance",
      "role_core_system_admin",
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });
  it("keeps Business Owner equivalent to the canonical owner role", () => {
    const owner = BUILT_IN_ROLES.find((role) => role.id === "role_owner");
    expect(owner).toBeDefined();
    expect(new Set(owner?.permissions)).toEqual(new Set(getPermissionsForRole("owner")));
  });

  it("does not leak one vertical's permissions into another vertical's job roles", () => {
    const verticalRoles = BUILT_IN_ROLES.filter((role) => role.module !== "core");
    for (const role of verticalRoles) {
      for (const [module, prefix] of Object.entries(MODULE_PERMISSION_PREFIX)) {
        if (module === role.module || !prefix) continue;
        expect(
          role.permissions.some((permission) => permission.startsWith(prefix)),
          `${role.id} unexpectedly grants ${module} permissions`,
        ).toBe(false);
      }
      for (const [module, permissions] of Object.entries(STANDALONE_MODULE_PERMISSIONS)) {
        if (module === role.module) continue;
        expect(
          role.permissions.some((permission) => permissions.includes(permission)),
          `${role.id} unexpectedly grants ${module} permissions`,
        ).toBe(false);
      }
    }
  });
});
