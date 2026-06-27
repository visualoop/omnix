/**
 * AI write-action framework tests — the human-in-the-loop safety layer.
 *
 * Verifies: previews compute the real effect, applying is permission-gated
 * (a denied permission must THROW and never mutate), and a successful apply
 * runs the right service + logs to ai_actions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock("@/services/rbac", () => ({ requirePermission: vi.fn() }));
vi.mock("@/services/erp", () => ({ createPurchaseOrder: vi.fn(async () => "po-123") }));

import { previewAction, applyAction, type ActionProposal } from "@/services/ai/actions";
import { query, execute } from "@/lib/db";
import { requirePermission } from "@/services/rbac";
import { createPurchaseOrder } from "@/services/erp";

const mockedQuery = vi.mocked(query);
const mockedExecute = vi.mocked(execute);
const mockedRequire = vi.mocked(requirePermission);
const mockedCreatePO = vi.mocked(createPurchaseOrder);

beforeEach(() => {
  mockedQuery.mockReset();
  mockedExecute.mockReset().mockResolvedValue(undefined as never);
  mockedRequire.mockReset().mockResolvedValue(undefined as never);
  mockedCreatePO.mockClear();
});

const categoryProposal: ActionProposal = {
  id: "set_product_category",
  summary: "Categorise 2 products",
  payload: { id: "set_product_category", product_ids: ["a", "b"], category_id: "cat1", category_name: "Drinks" },
};

describe("previewAction", () => {
  it("shows the products + target category", async () => {
    mockedQuery.mockResolvedValueOnce([{ name: "Coke" }, { name: "Fanta" }] as never);
    const preview = await previewAction(categoryProposal);
    expect(preview.lines.some((l) => l.value === "Drinks")).toBe(true);
    expect(preview.lines.some((l) => l.value === "Coke")).toBe(true);
  });

  it("warns on a very large draft PO", async () => {
    const po: ActionProposal = {
      id: "draft_purchase_order",
      summary: "Draft PO",
      payload: {
        id: "draft_purchase_order", supplier_id: "s1", supplier_name: "Acme",
        items: [{ product_id: "p", product_name: "Cement", quantity: 1000, unit_cost: 800 }],
      },
    };
    const preview = await previewAction(po);
    expect(preview.warning).toMatch(/large order/i);
  });
});

describe("applyAction — permission gate", () => {
  it("THROWS and never mutates when permission is denied", async () => {
    mockedRequire.mockRejectedValueOnce(new Error("Permission denied: inventory.edit"));
    await expect(applyAction(categoryProposal, "user1")).rejects.toThrow(/permission denied/i);
    // The product UPDATE must never have run.
    const ranProductUpdate = mockedExecute.mock.calls.some(
      (c) => typeof c[0] === "string" && /UPDATE products SET category_id/.test(c[0]),
    );
    expect(ranProductUpdate).toBe(false);
  });

  it("checks the right permission for the action", async () => {
    mockedQuery.mockResolvedValue([] as never);
    await applyAction(categoryProposal, "user1");
    expect(mockedRequire).toHaveBeenCalledWith("inventory.edit", expect.anything());
  });
});

describe("applyAction — execution", () => {
  it("categorises products + records the action", async () => {
    mockedQuery.mockResolvedValue([] as never);
    const res = await applyAction(categoryProposal, "user1");
    expect(res.ok).toBe(true);
    // It inserted an ai_actions ledger row.
    const loggedAction = mockedExecute.mock.calls.some(
      (c) => typeof c[0] === "string" && /INSERT INTO ai_actions/.test(c[0]),
    );
    expect(loggedAction).toBe(true);
    // It ran the product category update.
    const ranUpdate = mockedExecute.mock.calls.some(
      (c) => typeof c[0] === "string" && /UPDATE products SET category_id/.test(c[0]),
    );
    expect(ranUpdate).toBe(true);
  });

  it("draft PO routes through createPurchaseOrder as a draft", async () => {
    mockedQuery.mockResolvedValue([] as never);
    const po: ActionProposal = {
      id: "draft_purchase_order",
      summary: "Draft PO",
      payload: {
        id: "draft_purchase_order", supplier_id: "s1", supplier_name: "Acme",
        items: [{ product_id: "p", product_name: "Nails", quantity: 10, unit_cost: 50 }],
      },
    };
    const res = await applyAction(po, "user1");
    expect(res.ok).toBe(true);
    expect(mockedCreatePO).toHaveBeenCalledTimes(1);
    expect(mockedCreatePO.mock.calls[0][0]).toMatchObject({ supplier_id: "s1", user_id: "user1" });
  });
});
