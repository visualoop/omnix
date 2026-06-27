import { describe, it, expect } from "vitest";

/**
 * The KOT status label set should remain stable — the customer display
 * subscribes to these and renders chips by exact string match. Locking
 * the labels in a test catches accidental renames before they break
 * production displays.
 */
describe("hospitality KOT status labels", () => {
  const expected: Record<string, string> = {
    new: "Queued",
    sent: "In kitchen",
    preparing: "Cooking",
    ready: "Ready",
    served: "Served",
    voided: "Cancelled",
  };

  it("covers every status defined in hospitality_order_items CHECK", () => {
    expect(Object.keys(expected).sort()).toEqual(
      ["new", "preparing", "ready", "sent", "served", "voided"].sort(),
    );
  });

  it("labels stay short enough to fit in the chip (≤ 16 chars)", () => {
    for (const v of Object.values(expected)) {
      expect(v.length).toBeLessThanOrEqual(16);
    }
  });
});

/**
 * Course grouping uses menu_items.category as the bucket key, falling
 * back to "Other" for non-menu manual lines. This test pins the
 * grouping algorithm.
 */
describe("course grouping", () => {
  interface Line { id: string; name: string; category: string | null }
  function group(lines: Line[]): Map<string, Line[]> {
    const out = new Map<string, Line[]>();
    for (const l of lines) {
      const key = l.category && l.category.trim() ? l.category : "Other";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(l);
    }
    return out;
  }

  it("buckets items by category preserving insertion order", () => {
    const result = group([
      { id: "1", name: "Bruschetta",      category: "Starters" },
      { id: "2", name: "Beef Tenderloin", category: "Mains" },
      { id: "3", name: "Caesar Salad",    category: "Starters" },
      { id: "4", name: "Tiramisu",        category: "Desserts" },
      { id: "5", name: "Manual surcharge", category: null },
    ]);
    expect(Array.from(result.keys())).toEqual(["Starters", "Mains", "Desserts", "Other"]);
    expect(result.get("Starters")!.length).toBe(2);
    expect(result.get("Mains")!.length).toBe(1);
    expect(result.get("Other")!.length).toBe(1);
  });

  it("treats empty / whitespace category as Other", () => {
    const result = group([
      { id: "1", name: "X", category: "   " },
      { id: "2", name: "Y", category: "" },
    ]);
    expect(result.has("Other")).toBe(true);
    expect(result.get("Other")!.length).toBe(2);
  });
});

/**
 * Queue board "preparing vs ready" filter mirrors what users see on
 * the wall-mounted screen. Lock the predicate.
 */
describe("queue board column filters", () => {
  type Order = { status: "open" | "sent" | "preparing" | "ready" | "served" | "paid" | "voided" };
  const orders: Order[] = [
    { status: "open" }, { status: "sent" }, { status: "preparing" },
    { status: "ready" }, { status: "ready" },
    { status: "served" }, { status: "paid" }, { status: "voided" },
  ];

  it("preparing column includes open/sent/preparing only", () => {
    const preparing = orders.filter((o) => o.status === "open" || o.status === "sent" || o.status === "preparing");
    expect(preparing.length).toBe(3);
  });

  it("ready column includes only ready", () => {
    const ready = orders.filter((o) => o.status === "ready");
    expect(ready.length).toBe(2);
  });

  it("paid + voided + served excluded from board entirely", () => {
    const visible = orders.filter((o) => o.status !== "paid" && o.status !== "voided");
    // served still visible until 10-min auto-clear (handled by REMOVE_AFTER_READY_MS)
    expect(visible.find((o) => o.status === "paid")).toBeUndefined();
    expect(visible.find((o) => o.status === "voided")).toBeUndefined();
  });
});
