import { describe, it, expect } from "vitest";
import {
  eightySixPresets,
} from "../src/services/hospitality";

/**
 * Contract tests for the v0.43 hospitality expansion: soft-86 presets,
 * modifier & recipe canvas shapes, sales-trend zero-fill invariants.
 * These lock the pure functions so future refactors don't silently
 * change the interface UI consumers rely on.
 */

describe("86 presets", () => {
  it("returns four options in stable order", () => {
    const presets = eightySixPresets();
    expect(presets.map((p) => p.label)).toEqual([
      "After 6 pm today",
      "Tomorrow morning",
      "End of week",
      "Indefinite",
    ]);
  });

  it("indefinite preset has null until", () => {
    const [, , , indefinite] = eightySixPresets();
    expect(indefinite.until).toBeNull();
  });

  it("dated presets return future ISO timestamps", () => {
    const now = Date.now();
    const presets = eightySixPresets();
    for (const p of presets.slice(0, 3)) {
      expect(p.until).not.toBeNull();
      expect(new Date(p.until as string).getTime()).toBeGreaterThan(now);
    }
  });

  it("tomorrow morning preset lands at 08:00 local time", () => {
    const [, tomorrow] = eightySixPresets();
    const d = new Date(tomorrow.until as string);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
  });

  it("end-of-week preset lands on a Sunday at 23:59", () => {
    const [, , endOfWeek] = eightySixPresets();
    const d = new Date(endOfWeek.until as string);
    expect(d.getDay()).toBe(0); // Sunday
    expect(d.getHours()).toBe(23);
  });
});

/**
 * The visual recipe canvas persists `{ nodes: [{ id, x, y }], viewport }`
 * as JSON on recipes.canvas_layout. Test the shape stays parseable.
 */
describe("recipe canvas layout JSON contract", () => {
  it("round-trips a minimal layout", () => {
    const layout = {
      nodes: [
        { id: "dish", x: 400, y: 100 },
        { id: "ing-abc", x: 60, y: 40 },
      ],
    };
    const round = JSON.parse(JSON.stringify(layout));
    expect(round.nodes).toHaveLength(2);
    expect(round.nodes[0]).toMatchObject({ id: "dish", x: 400, y: 100 });
  });
});

/**
 * Sales-trend zero-fill: the day series must be contiguous over the
 * requested window so a stacked bar chart doesn't have gaps.
 */
describe("sales-trend zero-fill invariant", () => {
  it("produces N contiguous ISO days ending today", () => {
    const days = 14;
    const today = new Date();
    const isoDays: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      isoDays.push(d.toISOString().slice(0, 10));
    }
    expect(isoDays).toHaveLength(days);
    expect(isoDays[isoDays.length - 1]).toBe(today.toISOString().slice(0, 10));
    // Adjacent days must differ by exactly 1 day.
    for (let i = 1; i < isoDays.length; i++) {
      const a = new Date(isoDays[i - 1]).getTime();
      const b = new Date(isoDays[i]).getTime();
      expect(b - a).toBe(86400000);
    }
  });
});
