/**
 * Settings registry invariants.
 *
 * Catches the class of bug where a new settings page ships with a typo'd
 * or unregistered `group` value — the item would silently disappear from
 * the sidebar because it doesn't match any tab.
 */
import { describe, it, expect } from "vitest";
import {
  settingsRegistry,
  SETTINGS_GROUPS,
} from "@/lib/settings-registry";

describe("settings-registry", () => {
  const registry = settingsRegistry();

  it("has at least one entry", () => {
    expect(registry.length).toBeGreaterThan(0);
  });

  it("every entry's group is in SETTINGS_GROUPS", () => {
    for (const item of registry) {
      expect(SETTINGS_GROUPS).toContain(item.group);
    }
  });

  it("every route path is unique", () => {
    const seen = new Set<string>();
    for (const item of registry) {
      expect(seen.has(item.to), `duplicate route: ${item.to}`).toBe(false);
      seen.add(item.to);
    }
  });

  it("every entry has a non-empty label + description", () => {
    for (const item of registry) {
      expect(item.label.length, `label empty for ${item.to}`).toBeGreaterThan(0);
      expect(
        item.description.length,
        `description empty for ${item.to}`,
      ).toBeGreaterThan(0);
    }
  });

  it("hidden entries stay in the registry (route resolution) but don't clash", () => {
    // /settings/license is hidden but must still resolve — the layout
    // filters `hidden` items out of the sidebar, and App.tsx wires it as
    // a redirect route.
    const legacy = registry.find((i) => i.to === "/settings/license");
    expect(legacy).toBeDefined();
    expect(legacy?.hidden).toBe(true);
  });

  it("every SETTINGS_GROUPS entry has at least one item OR is a module-specific group", () => {
    const moduleGroups = new Set(["Dawa", "Retail", "Hardware", "Hospitality"]);
    const groupHasItem = new Set(registry.map((i) => i.group));
    for (const group of SETTINGS_GROUPS) {
      if (moduleGroups.has(group)) continue;
      expect(
        groupHasItem.has(group),
        `core group "${group}" has no entries — remove from SETTINGS_GROUPS or add a page`,
      ).toBe(true);
    }
  });

  it("route paths all start with /settings", () => {
    for (const item of registry) {
      expect(item.to.startsWith("/settings"), `bad path: ${item.to}`).toBe(true);
    }
  });
});
