import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("simplified staff role surface", () => {
  it("redirects the removed Settings role editor to Staff", () => {
    const app = source("src/App.tsx");
    expect(app).not.toContain("SettingsRolesPage");
    expect(app).toContain('<Route path="roles" element={<Navigate to="/settings/users" replace />} />');
  });

  it("uses the searchable role picker and paginates the staff table", () => {
    const users = source("src/pages/users.tsx");
    expect(users).toContain("BuiltInRoleCombobox");
    expect(users).toContain("Search staff or roles");
    expect(users).toContain("PaginationBar");
    expect(users).not.toContain("<Select");
  });

  it("keeps Groups aligned with built-in roles and paginated Staff membership", () => {
    const groups = source("src/pages/settings-groups.tsx");
    expect(groups).toContain("BUILT_IN_ROLES");
    expect(groups).toContain("Search roles and responsibilities");
    expect(groups).toContain("PaginationBar");
    expect(groups).toContain("primary role chosen under Staff is not replaced");
    expect(groups).not.toContain("Settings → Roles & Permissions");
  });

  it("renders only the setup-country allowlist with SVG flags", () => {
    const setup = source("src/pages/setup.tsx");
    expect(setup).toContain("listSetupCountries()");
    expect(setup).toContain("<Flag");
    expect(setup).not.toContain("listCountries");
    expect(setup).not.toContain("Other country");
    expect(setup).not.toContain("<details");
  });
});
