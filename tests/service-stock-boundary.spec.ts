import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDb = vi.hoisted(() => ({
  current: null as import("sql.js").Database | null,
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    if (!testDb.current) throw new Error("Test database is not open");
    const stmt = testDb.current.prepare(sql);
    try {
      stmt.bind(params as Array<string | number | null>);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
      return rows;
    } finally {
      stmt.free();
    }
  }),
  execute: vi.fn(async (sql: string, params: unknown[] = []): Promise<void> => {
    if (!testDb.current) throw new Error("Test database is not open");
    const stmt = testDb.current.prepare(sql);
    try {
      stmt.bind(params as Array<string | number | null>);
      stmt.step();
    } finally {
      stmt.free();
    }
  }),
}));
vi.mock("@/stores/active-branch", () => ({
  getActiveBranchId: () => "default-branch",
  requireActiveBranchId: () => "default-branch",
}));

import { openTestDb, exec, selectAll } from "./helpers/sql-harness";
import { regenerateSuggestions, listSuggestions } from "@/services/reorder-suggestions";
import {
  deadStock as insightDeadStock,
  expiryRisk,
  reorderSuggestions,
  topFindings,
} from "@/services/insights";
import {
  deadStock as qualityDeadStock,
  startCycleCount,
  stockAging,
} from "@/services/inventory-quality";
import { getStockValuation } from "@/services/reports";
import { getExpiringItems } from "@/services/pharmacy";

const DAY_MS = 86_400_000;

type ProductFixture = {
  id: string;
  name: string;
  kind?: "physical" | "menu_item";
  isService?: boolean;
  reorderLevel?: number;
  createdDaysAgo?: number;
  stock?: number;
  buyingPrice?: number;
  sellingPrice?: number;
  expiryDays?: number;
};

function addProduct(product: ProductFixture): void {
  if (!testDb.current) throw new Error("Test database is not open");
  const createdAt = new Date(Date.now() - (product.createdDaysAgo ?? 120) * DAY_MS).toISOString();
  exec(
    testDb.current,
    `INSERT INTO products
       (id, name, sku, reorder_level, active, created_at, updated_at, kind, is_service)
     VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5, ?6, ?7)`,
    [
      product.id,
      product.name,
      `SKU-${product.id}`,
      product.reorderLevel ?? 0,
      createdAt,
      product.kind ?? "physical",
      product.isService ? 1 : 0,
    ],
  );
  exec(
    testDb.current,
    `INSERT INTO product_prices (product_id, price_list_id, buying_price, selling_price)
     VALUES (?1, 'default', ?2, ?3)`,
    [product.id, product.buyingPrice ?? 0, product.sellingPrice ?? 100],
  );
  if (product.stock !== undefined) {
    const expiry = product.expiryDays === undefined
      ? null
      : new Date(Date.now() + product.expiryDays * DAY_MS).toISOString();
    exec(
      testDb.current,
      `INSERT INTO batches
         (id, product_id, batch_number, quantity, buying_price, expiry_date, received_at, branch_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'default-branch')`,
      [
        `batch-${product.id}`,
        product.id,
        `B-${product.id}`,
        product.stock,
        product.buyingPrice ?? 0,
        expiry,
        createdAt,
      ],
    );
  }
}

function addDailySales(productId: string, productName: string): void {
  if (!testDb.current) throw new Error("Test database is not open");
  for (let day = 0; day < 30; day += 1) {
    const saleId = `sale-${productId}-${day}`;
    const createdAt = new Date(Date.now() - day * DAY_MS).toISOString();
    exec(
      testDb.current,
      `INSERT INTO sales
         (id, sale_number, user_id, subtotal, tax_amount, total, payment_status, status, created_at, branch_id)
       VALUES (?1, ?2, 'owner', 100, 0, 100, 'paid', 'completed', ?3, 'default-branch')`,
      [saleId, day + 1 + productId.length * 100, createdAt],
    );
    exec(
      testDb.current,
      `INSERT INTO sale_items
         (id, sale_id, product_id, product_name, quantity, unit_price, discount, tax_rate, total)
       VALUES (?1, ?2, ?3, ?4, 1, 100, 0, 0, 100)`,
      [`item-${productId}-${day}`, saleId, productId, productName],
    );
  }
}

beforeEach(async () => {
  testDb.current = await openTestDb();
  exec(
    testDb.current,
    `INSERT INTO users (id, username, full_name, role, password_hash)
     VALUES ('owner', 'owner-stock-test', 'Stock Test Owner', 'owner', 'hash')`,
  );
  exec(
    testDb.current,
    `INSERT OR IGNORE INTO price_lists (id, name, is_default, active)
     VALUES ('default', 'Default', 1, 1)`,
  );

  addProduct({
    id: "salon-service",
    name: "Ladies Cut",
    isService: true,
    reorderLevel: 5,
  });
  addProduct({
    id: "menu-item",
    name: "House Burger",
    kind: "menu_item",
    reorderLevel: 5,
  });
  addProduct({
    id: "backbar",
    name: "Salon Shampoo",
    stock: 1,
    buyingPrice: 20,
    sellingPrice: 60,
    reorderLevel: 5,
  });
  addProduct({
    id: "retail",
    name: "Retail Soap",
    stock: 1,
    buyingPrice: 40,
    sellingPrice: 80,
    reorderLevel: 5,
  });
  addProduct({
    id: "dead-retail",
    name: "Old Retail Stock",
    stock: 2,
    buyingPrice: 30,
    sellingPrice: 50,
    expiryDays: 10,
  });
  // Deliberately malformed legacy data proves reports do not merely rely on
  // the normal invariant that services have no batches.
  addProduct({
    id: "legacy-service-batch",
    name: "Legacy Massage Package",
    isService: true,
    stock: 9,
    buyingPrice: 999,
    sellingPrice: 1_200,
    expiryDays: 5,
  });

  addDailySales("salon-service", "Ladies Cut");
  addDailySales("menu-item", "House Burger");
  addDailySales("backbar", "Salon Shampoo");
  addDailySales("retail", "Retail Soap");
});

afterEach(() => {
  testDb.current?.close();
  testDb.current = null;
});

describe("canonical stockable product boundary", () => {
  it("excludes a daily-selling Salon service and Hospitality menu item from both reorder engines", async () => {
    expect(await regenerateSuggestions()).toBe(2);
    const persisted = await listSuggestions();
    expect(persisted.map((item) => item.product_id).sort()).toEqual(["backbar", "retail"]);

    const live = await reorderSuggestions({ windowDays: 30, leadDays: 7 });
    expect(live.map((item) => item.product_id).sort()).toEqual(["backbar", "retail"]);
  });

  it("never creates a Ladies Cut stockout headline in top findings", async () => {
    const findings = await topFindings();
    expect(findings.some((finding) => finding.headline.includes("Ladies Cut"))).toBe(false);
    expect(findings.some((finding) => finding.kind === "reorder")).toBe(true);
  });

  it("keeps physical Salon back-bar consumables and Retail goods eligible for reorder", async () => {
    const suggestions = await reorderSuggestions({ windowDays: 30, leadDays: 7 });
    expect(suggestions.map((item) => item.name)).toEqual(
      expect.arrayContaining(["Salon Shampoo", "Retail Soap"]),
    );
  });

  it("excludes services from dead stock, ageing, expiry, valuation, and inventory counts", async () => {
    const insightDead = await insightDeadStock({ idleDays: 60 });
    const qualityDead = await qualityDeadStock(60);
    const ageing = await stockAging();
    const expiry = await expiryRisk({ withinDays: 30 });
    const pharmacyExpiry = await getExpiringItems(30);
    const valuation = await getStockValuation();

    expect(insightDead.items.map((item) => item.product_id)).toContain("dead-retail");
    expect(insightDead.items.map((item) => item.product_id)).not.toContain("legacy-service-batch");
    expect(qualityDead.map((item) => item.product_id)).toContain("dead-retail");
    expect(qualityDead.map((item) => item.product_id)).not.toContain("legacy-service-batch");
    expect(ageing.map((item) => item.product_id)).not.toContain("legacy-service-batch");
    expect(expiry.items.map((item) => item.product_id)).toEqual(["dead-retail"]);
    expect(pharmacyExpiry.map((item) => item.product_id)).toEqual(["dead-retail"]);
    expect(valuation).toEqual({ at_cost: 120, at_retail: 240, total_items: 4 });

    const countId = await startCycleCount({});
    const counted = selectAll<{ product_id: string }>(
      testDb.current!,
      `SELECT product_id FROM cycle_count_items WHERE cycle_count_id = ?1 ORDER BY product_id`,
      [countId],
    );
    expect(counted.map((item) => item.product_id)).toEqual([
      "backbar",
      "dead-retail",
      "retail",
    ]);
  });
});
