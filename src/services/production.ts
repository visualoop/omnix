/**
 * Medium-tier accounting + inventory services.
 * One module keeps the surface tight; split later if these grow.
 */
import { execute, query } from "@/lib/db";

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

// ─── Cost centres (Task 39) ─────────────────────────────
export interface CostCentre {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  budget: number;
  active: number;
}

export async function listCostCentres(): Promise<CostCentre[]> {
  return query<CostCentre>(
    `SELECT id, code, name, parent_id, budget, active
     FROM cost_centres WHERE active = 1 ORDER BY code`,
  );
}

export async function createCostCentre(input: { code: string; name: string; parent_id?: string; budget?: number }): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO cost_centres (id, code, name, parent_id, budget) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, input.code, input.name, input.parent_id ?? null, input.budget ?? 0],
  );
  return id;
}

// ─── Landed cost allocation on GRN (Task 41) ───────────
export async function addLandedCost(input: {
  goods_receipt_id: string;
  cost_type: "freight" | "duty" | "insurance" | "clearing" | "other";
  amount: number;
  allocation_basis?: "value" | "weight" | "quantity";
  notes?: string;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO landed_costs (id, goods_receipt_id, cost_type, amount, allocation_basis, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, input.goods_receipt_id, input.cost_type, input.amount, input.allocation_basis ?? "value", input.notes ?? null],
  );
  return id;
}

/**
 * Allocate every landed cost on a GRN proportionally across the receipt lines.
 * Updates goods_receipt_items.unit_cost with the loaded cost (product cost + share).
 */
export async function allocateLandedCosts(goodsReceiptId: string): Promise<{ allocated: number }> {
  const totalCosts = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM landed_costs WHERE goods_receipt_id = ?1`,
    [goodsReceiptId],
  ).catch(() => [{ total: 0 }]);
  const total = totalCosts[0]?.total ?? 0;
  if (total <= 0) return { allocated: 0 };

  const lines = await query<{ id: string; line_total: number; quantity: number }>(
    `SELECT id, line_total, quantity FROM goods_receipt_items WHERE goods_receipt_id = ?1`,
    [goodsReceiptId],
  ).catch(() => []);
  const baseTotal = lines.reduce((s, l) => s + (l.line_total || 0), 0);
  if (baseTotal <= 0) return { allocated: 0 };

  for (const line of lines) {
    const share = (line.line_total / baseTotal) * total;
    const perUnit = share / (line.quantity || 1);
    await execute(
      `UPDATE goods_receipt_items
       SET unit_cost = COALESCE(unit_cost, 0) + ?2, line_total = (quantity * (COALESCE(unit_cost, 0) + ?2))
       WHERE id = ?1`,
      [line.id, perUnit],
    ).catch(() => {});
  }
  return { allocated: total };
}

// ─── Recurring expenses (Task 42) ──────────────────────
export interface RecurringExpense {
  id: string;
  name: string;
  category_id: string | null;
  amount: number;
  frequency: "monthly" | "weekly" | "quarterly" | "annually";
  next_due_date: string;
  active: number;
  auto_post: number;
}

export async function listRecurring(): Promise<RecurringExpense[]> {
  return query<RecurringExpense>(
    `SELECT id, name, category_id, amount, frequency, next_due_date, active, auto_post
     FROM recurring_expenses ORDER BY next_due_date ASC LIMIT 200`,
  );
}

export async function createRecurring(input: {
  name: string;
  category_id?: string;
  amount: number;
  frequency: RecurringExpense["frequency"];
  next_due_date: string;
  payment_source?: string;
  auto_post?: boolean;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO recurring_expenses (id, name, category_id, amount, frequency, next_due_date, payment_source, auto_post)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      id, input.name, input.category_id ?? null, input.amount, input.frequency, input.next_due_date,
      input.payment_source ?? "bank", input.auto_post === false ? 0 : 1,
    ],
  );
  return id;
}

/**
 * Post any recurring expenses due today. Idempotent per (recurring_id, due_date).
 */
export async function postDueRecurring(): Promise<number> {
  const due = await query<RecurringExpense & { payment_source: string; category_id: string | null }>(
    `SELECT * FROM recurring_expenses
     WHERE active = 1 AND auto_post = 1 AND next_due_date <= date('now')`,
  ).catch(() => []);
  let posted = 0;
  for (const r of due) {
    const expenseId = newId();
    await execute(
      `INSERT INTO expenses (id, category_id, amount, description, expense_date, created_at, payment_source)
       VALUES (?1, ?2, ?3, ?4, date('now'), datetime('now'), ?5)`,
      [expenseId, r.category_id, r.amount, `Recurring: ${r.name}`, r.payment_source],
    ).catch(() => {});

    // Bump next_due_date.
    const step = r.frequency === "weekly" ? "+7 days"
      : r.frequency === "monthly" ? "+1 months"
      : r.frequency === "quarterly" ? "+3 months"
      : "+1 years";
    await execute(
      `UPDATE recurring_expenses
       SET last_posted_at = datetime('now'), next_due_date = date(next_due_date, ?2)
       WHERE id = ?1`,
      [r.id, step],
    );
    posted++;
  }
  return posted;
}

// ─── Multi-warehouse bins (Task 43) ────────────────────
export interface WarehouseBin {
  id: string;
  branch_id: string | null;
  code: string;
  name: string;
  bin_type: string | null;
  active: number;
}

export async function listBins(branchId?: string): Promise<WarehouseBin[]> {
  if (branchId) {
    return query<WarehouseBin>(
      `SELECT * FROM warehouse_bins WHERE branch_id = ?1 AND active = 1 ORDER BY code`,
      [branchId],
    );
  }
  return query<WarehouseBin>(`SELECT * FROM warehouse_bins WHERE active = 1 ORDER BY branch_id, code`);
}

export async function createBin(input: { branch_id?: string; code: string; name: string; bin_type?: string }): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO warehouse_bins (id, branch_id, code, name, bin_type) VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, input.branch_id ?? null, input.code, input.name, input.bin_type ?? null],
  );
  return id;
}

// ─── Assembly / manufacturing (Task 44) ────────────────
export interface BOM {
  id: string;
  output_product_id: string;
  output_product_name: string;
  yield_quantity: number;
  labour_cost: number;
  overhead_cost: number;
  active: number;
}

export interface BOMIngredient {
  id: string;
  ingredient_product_id: string;
  ingredient_name: string;
  quantity: number;
  unit_of_measure: string | null;
  unit_cost: number;
}

export async function createBOM(input: {
  output_product_id: string;
  yield_quantity?: number;
  labour_cost?: number;
  overhead_cost?: number;
  ingredients: Array<{ product_id: string; quantity: number; unit?: string }>;
}): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO assembly_bom (id, output_product_id, yield_quantity, labour_cost, overhead_cost)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [id, input.output_product_id, input.yield_quantity ?? 1, input.labour_cost ?? 0, input.overhead_cost ?? 0],
  );
  for (const ing of input.ingredients) {
    await execute(
      `INSERT INTO assembly_bom_ingredients (id, bom_id, ingredient_product_id, quantity, unit_of_measure)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
      [newId(), id, ing.product_id, ing.quantity, ing.unit ?? null],
    );
  }
  return id;
}

export async function listBOMs(): Promise<BOM[]> {
  return query<BOM>(
    `SELECT ab.id, ab.output_product_id, p.name AS output_product_name,
            ab.yield_quantity, ab.labour_cost, ab.overhead_cost, ab.active
     FROM assembly_bom ab
     JOIN products p ON p.id = ab.output_product_id
     WHERE ab.active = 1
     ORDER BY p.name`,
  );
}

export async function listBOMIngredients(bomId: string): Promise<BOMIngredient[]> {
  return query<BOMIngredient>(
    `SELECT ing.id, ing.ingredient_product_id, p.name AS ingredient_name,
            ing.quantity, ing.unit_of_measure,
            COALESCE((SELECT AVG(buying_price) FROM batches WHERE product_id = p.id AND quantity > 0), 0) AS unit_cost
     FROM assembly_bom_ingredients ing
     JOIN products p ON p.id = ing.ingredient_product_id
     WHERE ing.bom_id = ?1
     ORDER BY p.name`,
    [bomId],
  );
}

async function nextRunNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(run_number, 9) AS INTEGER)), 0) AS n
     FROM production_runs WHERE run_number LIKE ?1`,
    [`PR-${year}-%`],
  );
  return `PR-${year}-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

/**
 * Execute a production run: deduct ingredients from stock, add output to stock,
 * record the run. Returns the run id + total cost.
 */
export async function runProduction(bomId: string, outputQuantity: number, producedBy?: string, notes?: string): Promise<{ id: string; total_cost: number }> {
  const [bom] = await query<BOM>(
    `SELECT ab.id, ab.output_product_id, p.name AS output_product_name,
            ab.yield_quantity, ab.labour_cost, ab.overhead_cost, ab.active
     FROM assembly_bom ab JOIN products p ON p.id = ab.output_product_id
     WHERE ab.id = ?1`,
    [bomId],
  );
  if (!bom) throw new Error("BOM not found");

  const ingredients = await listBOMIngredients(bomId);
  const scale = outputQuantity / (bom.yield_quantity || 1);
  let ingredientCost = 0;

  // Deduct each ingredient (FIFO).
  for (const ing of ingredients) {
    let remaining = ing.quantity * scale;
    ingredientCost += ing.unit_cost * remaining;
    const batches = await query<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM batches
       WHERE product_id = ?1 AND quantity > 0
         AND (expiry_date IS NULL OR expiry_date > date('now'))
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC`,
      [ing.ingredient_product_id],
    );
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      await execute(`UPDATE batches SET quantity = quantity - ?2 WHERE id = ?1`, [b.id, take]);
      remaining -= take;
    }
  }

  const totalCost = ingredientCost + (bom.labour_cost || 0) * scale + (bom.overhead_cost || 0) * scale;

  // Add output to stock — create a new batch.
  await execute(
    `INSERT INTO batches (id, product_id, batch_number, quantity, buying_price, received_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))`,
    [newId(), bom.output_product_id, `PROD-${new Date().toISOString().slice(0, 10)}`, outputQuantity, totalCost / outputQuantity],
  );

  // Record the run.
  const runId = newId();
  const number = await nextRunNumber();
  await execute(
    `INSERT INTO production_runs (id, run_number, bom_id, output_quantity, produced_by, total_cost, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [runId, number, bomId, outputQuantity, producedBy ?? null, totalCost, notes ?? null],
  );

  return { id: runId, total_cost: totalCost };
}
