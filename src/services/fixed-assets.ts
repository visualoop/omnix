/**
 * Fixed assets + depreciation.
 *
 * Straight-line: (cost - salvage) / useful_life_months per month.
 * Reducing balance: book_value × rate_per_month per month.
 * Depreciation entry posts a journal: DR 6900 (depreciation expense) CR 1600 (accumulated depreciation).
 */
import { execute, query } from "@/lib/db";

export interface FixedAsset {
  id: string;
  asset_code: string;
  name: string;
  category: string | null;
  acquired_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  method: "straight_line" | "reducing_balance";
  accumulated_depreciation: number;
  branch_id: string | null;
  status: "active" | "disposed" | "written_off";
  disposed_date: string | null;
  disposal_proceeds: number | null;
  notes: string | null;
}

function newId(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

async function nextAssetCode(): Promise<string> {
  const [row] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(SUBSTR(asset_code, 5) AS INTEGER)), 0) AS n
     FROM fixed_assets WHERE asset_code LIKE 'FA-%'`,
  );
  return `FA-${String(Number(row?.n ?? 0) + 1).padStart(5, "0")}`;
}

export async function createAsset(input: {
  name: string;
  category?: string;
  acquired_date: string;
  cost: number;
  salvage_value?: number;
  useful_life_months: number;
  method?: "straight_line" | "reducing_balance";
  branch_id?: string;
  notes?: string;
}): Promise<string> {
  const id = newId();
  const code = await nextAssetCode();
  await execute(
    `INSERT INTO fixed_assets
      (id, asset_code, name, category, acquired_date, cost, salvage_value,
       useful_life_months, method, branch_id, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [
      id, code, input.name, input.category ?? null, input.acquired_date,
      input.cost, input.salvage_value ?? 0, input.useful_life_months,
      input.method ?? "straight_line", input.branch_id ?? null, input.notes ?? null,
    ],
  );
  return id;
}

export async function listAssets(status?: "active" | "disposed" | "written_off"): Promise<FixedAsset[]> {
  if (status) return query<FixedAsset>(`SELECT * FROM fixed_assets WHERE status = ?1 ORDER BY acquired_date DESC`, [status]);
  return query<FixedAsset>(`SELECT * FROM fixed_assets ORDER BY acquired_date DESC LIMIT 500`);
}

/**
 * Run monthly depreciation for every active asset. Idempotent per (asset, period).
 * Returns { posted } count. Call from a cron / manual trigger monthly.
 */
export async function runMonthlyDepreciation(period: string): Promise<number> {
  const assets = await listAssets("active");
  let posted = 0;

  for (const asset of assets) {
    // Skip if already posted this period.
    const [exists] = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM depreciation_entries WHERE asset_id = ?1 AND period_label = ?2`,
      [asset.id, period],
    );
    if ((exists?.n ?? 0) > 0) continue;

    const bookValue = asset.cost - asset.accumulated_depreciation;
    if (bookValue <= asset.salvage_value) continue;

    let dep = 0;
    if (asset.method === "straight_line") {
      dep = Math.max(0, (asset.cost - asset.salvage_value) / asset.useful_life_months);
    } else if (asset.method === "reducing_balance") {
      // Common rate = 2 / useful_life_months (double declining)
      const rate = 2 / asset.useful_life_months;
      dep = bookValue * rate;
    }
    // Never depreciate below salvage.
    const remaining = bookValue - asset.salvage_value;
    if (dep > remaining) dep = remaining;
    if (dep <= 0) continue;

    const newBook = bookValue - dep;

    await execute(
      `INSERT INTO depreciation_entries (id, asset_id, period_label, depreciation_amount, book_value_after)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
      [newId(), asset.id, period, dep, newBook],
    );
    await execute(
      `UPDATE fixed_assets SET accumulated_depreciation = accumulated_depreciation + ?2 WHERE id = ?1`,
      [asset.id, dep],
    );
    posted++;
  }
  return posted;
}

export async function disposeAsset(id: string, disposedDate: string, proceeds: number): Promise<void> {
  await execute(
    `UPDATE fixed_assets
     SET status = 'disposed', disposed_date = ?2, disposal_proceeds = ?3
     WHERE id = ?1`,
    [id, disposedDate, proceeds],
  );
}
