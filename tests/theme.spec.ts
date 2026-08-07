import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VARIANTS, type Variant } from "@/lib/variant";
import {
  bootstrapTheme,
  defaultPaletteForVariant,
  type PaletteId,
} from "@/stores/theme";

const EXPECTED_PALETTES: Record<Variant, PaletteId> = {
  pro: "classic",
  dawa: "ocean",
  retail: "meadow",
  hospitality: "espresso",
  hardware: "slate",
  salon: "blossom",
};

function resetPreferencesAndRoot(): void {
  localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.removeAttribute("data-theme");
}

beforeEach(resetPreferencesAndRoot);
afterEach(resetPreferencesAndRoot);

describe("variant theme defaults", () => {
  it("resolves a distinct, domain-specific palette for every build variant", () => {
    for (const variant of VARIANTS) {
      expect(defaultPaletteForVariant(variant)).toBe(EXPECTED_PALETTES[variant]);
    }

    expect(new Set(Object.values(EXPECTED_PALETTES)).size).toBe(VARIANTS.length);
  });

  it.each(VARIANTS)("boots %s in its dark variant palette with no stored preferences", (variant) => {
    bootstrapTheme(variant);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe(EXPECTED_PALETTES[variant]);

    // Bootstrap only resolves fallbacks. It must not turn a default into an
    // apparent user preference or prevent a future variant default update.
    expect(localStorage.getItem("omnix-theme")).toBeNull();
    expect(localStorage.getItem("omnix.palette")).toBeNull();
  });

  it("leaves an explicit stored mode and palette exactly as the user chose them", () => {
    localStorage.setItem("omnix-theme", "light");
    localStorage.setItem("omnix.palette", "rose");

    bootstrapTheme("dawa");

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("rose");
    expect(localStorage.getItem("omnix-theme")).toBe("light");
    expect(localStorage.getItem("omnix.palette")).toBe("rose");
  });
});
