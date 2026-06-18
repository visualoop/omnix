/**
 * Product CSV export — streams all active products with their current
 * stock + pricing + tax + category to a CSV file the user saves locally.
 *
 * Uses a blob URL + <a download> trigger which works inside Tauri
 * WebView2 (downloads land in the OS default Downloads folder) and
 * in regular browsers. Round-trips the existing Import CSV format.
 */
import { query } from "@/lib/db";

interface ExportRow {
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  buying_price: number;
  selling_price: number;
  tax_rate: number;
  reorder_level: number;
  stock_qty: number;
  active: number;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    "name", "sku", "barcode", "category", "unit",
    "buying_price", "selling_price", "tax_rate", "reorder_level", "stock_qty", "active",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(r.name),
      csvEscape(r.sku),
      csvEscape(r.barcode),
      csvEscape(r.category),
      csvEscape(r.unit),
      csvEscape(r.buying_price),
      csvEscape(r.selling_price),
      csvEscape(r.tax_rate),
      csvEscape(r.reorder_level),
      csvEscape(r.stock_qty),
      csvEscape(r.active),
    ].join(","));
  }
  return lines.join("\n");
}

export async function exportProductsCsv(): Promise<{ rowCount: number }> {
  const rows = await query<ExportRow>(
    `SELECT
       p.name,
       p.sku,
       p.barcode,
       c.name AS category,
       p.unit,
       COALESCE(pp.buying_price, 0) AS buying_price,
       COALESCE(pp.selling_price, 0) AS selling_price,
       COALESCE(p.tax_rate, 0) AS tax_rate,
       COALESCE(p.reorder_level, 0) AS reorder_level,
       COALESCE((SELECT SUM(b.quantity) FROM batches b WHERE b.product_id = p.id), 0) AS stock_qty,
       p.active
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.price_list_id = 'default'
     WHERE p.active = 1 AND COALESCE(p.kind, 'physical') = 'physical'
     ORDER BY p.name`,
  );
  const csv = rowsToCsv(rows);
  const filename = `omnix-products-${new Date().toISOString().slice(0, 10)}.csv`;

  // Universal blob-download — works inside Tauri WebView2 (lands in
  // OS Downloads folder) and regular browsers.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 100);

  return { rowCount: rows.length };
}
