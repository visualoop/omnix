/**
 * Sanity: importing @/services/ai/v2 registers the full toolset.
 *
 * We check every tool we've shipped so far. New tool added? Add its id
 * to the expected list here so this test guards against accidental
 * mis-registrations.
 */
import { describe, it, expect } from "vitest";
import { listTools } from "@/services/ai/v2/tools/registry";
import "@/services/ai/v2";  // side-effect: register every tool

const EXPECTED_TOOLS = [
  // read
  "get_low_stock",
  "get_expiring",
  "recent_sales",
  "find_customer",
  "find_product",
  // write — inventory + parties
  "create_product",
  "create_customer",
  "create_supplier",
  // write — finance
  "record_expense",
  "record_petty_cash",
  "create_purchase_order",
  // write — hospitality
  "create_dining_area",
  "create_table",
  "create_kitchen_station",
  "create_menu_item",
  "create_room_type",
  "create_room",
  "create_booking",
  "open_order",
  "add_order_item",
  // write — pharmacy
  "create_prescription",
  "refill_prescription",
  // write — retail + hardware
  "create_brand",
  "create_layby",
  "create_special_order",
  "record_shrinkage",
  "create_hardware_quotation",
  "create_delivery_note",
] as const;

describe("ai/v2 tool coverage", () => {
  it("registers every expected tool at import time", () => {
    const ids = new Set(listTools().map((t) => t.id));
    for (const expected of EXPECTED_TOOLS) {
      expect(ids.has(expected), `Missing tool: ${expected}`).toBe(true);
    }
  });

  it("has correct tier tags on write tools", () => {
    const byId = new Map(listTools().map((t) => [t.id, t]));
    expect(byId.get("create_product")?.tier).toBe("write");
    expect(byId.get("record_shrinkage")?.tier).toBe("destructive");
    expect(byId.get("get_low_stock")?.tier).toBe("read");
  });
});
