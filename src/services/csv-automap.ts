/**
 * CSV header auto-mapping for product imports.
 *
 * Most users export a CSV from Excel / Google Sheets / their old POS and
 * never relabel headers to match our canonical schema. This helper takes
 * whatever they wrote and maps each user header → our canonical column.
 *
 * Supports:
 *   - English variants ("buying", "cost", "wholesale", "purchase price"
 *     all → buying_price)
 *   - Swahili variants ("Bei ya Kununua" → buying_price, "Bidhaa" → name)
 *   - Casing + whitespace + punctuation tolerance
 *   - Direct exact matches via canonical column name
 *
 * Returns:
 *   {
 *     mapped: { 0: 'name', 1: 'buying_price', 2: 'selling_price', 3: null, ... },
 *     missingRequired: ['barcode'], // canonical columns we couldn't find
 *     unmappedHeaders: ['notes'], // user headers we didn't recognise
 *   }
 *
 * The required vs optional list lives here so the parser only has to call
 * mapHeaders() and ask "which required ones are missing?".
 */

export const CANONICAL_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "unit",
  "buying_price",
  "selling_price",
  "initial_stock",
  "reorder_level",
  "tax_rate",
  "category",
  "supplier",
  "description",
] as const

export type CanonicalColumn = typeof CANONICAL_COLUMNS[number]

export const REQUIRED_COLUMNS: CanonicalColumn[] = ["name", "buying_price", "selling_price"]

/**
 * Synonym table — every variant we recognise → canonical column. Keys are
 * lowercase + whitespace-collapsed forms compared after normalisation.
 *
 * Add more aliases as users surface them. Don't add ambiguous ones (e.g.
 * "price" alone is ambiguous between buying + selling — leave it out).
 */
const SYNONYMS: Record<string, CanonicalColumn> = {
  // ─── name ─────────────────────────────────────────────
  name: "name",
  product: "name",
  product_name: "name",
  item: "name",
  item_name: "name",
  description_short: "name",
  title: "name",
  bidhaa: "name", // sw
  jina: "name", // sw "name"
  jina_la_bidhaa: "name", // sw

  // ─── sku ──────────────────────────────────────────────
  sku: "sku",
  code: "sku",
  product_code: "sku",
  item_code: "sku",
  msimbo: "sku", // sw
  msimbo_wa_bidhaa: "sku", // sw

  // ─── barcode ──────────────────────────────────────────
  barcode: "barcode",
  ean: "barcode",
  upc: "barcode",
  ean13: "barcode",
  barcode_ean: "barcode",
  msimbo_pau: "barcode", // sw

  // ─── unit ─────────────────────────────────────────────
  unit: "unit",
  uom: "unit",
  units: "unit",
  measure: "unit",
  pack: "unit",
  kipimo: "unit", // sw

  // ─── buying_price ─────────────────────────────────────
  buying_price: "buying_price",
  buying: "buying_price",
  buy: "buying_price",
  buy_price: "buying_price",
  cost: "buying_price",
  cost_price: "buying_price",
  unit_cost: "buying_price",
  wholesale: "buying_price",
  wholesale_price: "buying_price",
  purchase: "buying_price",
  purchase_price: "buying_price",
  bei_ya_kununua: "buying_price", // sw
  gharama: "buying_price", // sw "cost"

  // ─── selling_price ────────────────────────────────────
  selling_price: "selling_price",
  selling: "selling_price",
  sell: "selling_price",
  sell_price: "selling_price",
  retail: "selling_price",
  retail_price: "selling_price",
  price: "selling_price", // common but coarse — accept since it's most often selling
  unit_price: "selling_price",
  msrp: "selling_price",
  bei_ya_kuuza: "selling_price", // sw
  bei: "selling_price", // sw "price"

  // ─── initial_stock ────────────────────────────────────
  initial_stock: "initial_stock",
  stock: "initial_stock",
  qty: "initial_stock",
  quantity: "initial_stock",
  stock_qty: "initial_stock",
  on_hand: "initial_stock",
  opening_stock: "initial_stock",
  akiba: "initial_stock", // sw
  idadi: "initial_stock", // sw "count"

  // ─── reorder_level ────────────────────────────────────
  reorder_level: "reorder_level",
  reorder: "reorder_level",
  min_stock: "reorder_level",
  minimum_stock: "reorder_level",
  par: "reorder_level",
  par_level: "reorder_level",
  kiwango_cha_kuagiza: "reorder_level", // sw

  // ─── tax_rate ─────────────────────────────────────────
  tax_rate: "tax_rate",
  tax: "tax_rate",
  vat: "tax_rate",
  vat_rate: "tax_rate",
  ushuru: "tax_rate", // sw "tax"

  // ─── category ─────────────────────────────────────────
  category: "category",
  group: "category",
  type: "category",
  aina: "category", // sw

  // ─── supplier ─────────────────────────────────────────
  supplier: "supplier",
  vendor: "supplier",
  manufacturer: "supplier",
  msambazaji: "supplier", // sw "supplier"

  // ─── description ──────────────────────────────────────
  description: "description",
  notes: "description",
  details: "description",
  maelezo: "description", // sw
}

/**
 * Normalise a raw header into a comparable form.
 *
 *   "  Bei ya Kuuza! "  →  "bei_ya_kuuza"
 *   "Buy Price"          →  "buy_price"
 *   "PRODUCT NAME"       →  "product_name"
 *
 * Strips: leading/trailing whitespace, surrounding punctuation, BOM.
 * Lowercases, collapses internal whitespace + repeats of '_' / '-' to a
 * single underscore.
 */
export function normaliseHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // drop punctuation
    .replace(/[\s\-_]+/g, "_") // collapse spaces / hyphens / underscores
    .replace(/^_+|_+$/g, "")
}

export interface HeaderMapResult {
  /** index → canonical column (or null if we couldn't map). */
  mapped: Array<CanonicalColumn | null>
  /** required canonical columns that didn't appear in the user's headers. */
  missingRequired: CanonicalColumn[]
  /** raw user headers we couldn't map to anything. */
  unmappedHeaders: string[]
}

/**
 * Map an array of raw CSV headers to canonical column names.
 *
 * @param headers  User's CSV header row, in order.
 * @returns        Per-index canonical mapping + missing-required list.
 */
export function mapHeaders(headers: string[]): HeaderMapResult {
  const mapped: Array<CanonicalColumn | null> = []
  const seen = new Set<CanonicalColumn>()
  const unmappedHeaders: string[] = []

  for (const raw of headers) {
    const norm = normaliseHeader(raw)
    const canon = SYNONYMS[norm] ?? null
    mapped.push(canon)
    if (canon) {
      seen.add(canon)
    } else if (raw.trim()) {
      unmappedHeaders.push(raw)
    }
  }

  const missingRequired = REQUIRED_COLUMNS.filter((c) => !seen.has(c))

  return { mapped, missingRequired, unmappedHeaders }
}

/**
 * Project a parsed CSV row (the `cells` array) onto a canonical record
 * keyed by canonical column name. Cells whose header didn't map are
 * dropped silently — caller decides whether to surface them.
 *
 * @param cells   Row values in original CSV order.
 * @param mapped  Result from mapHeaders().mapped — index → canonical name.
 */
export function projectRow(
  cells: string[],
  mapped: Array<CanonicalColumn | null>,
): Partial<Record<CanonicalColumn, string>> {
  const out: Partial<Record<CanonicalColumn, string>> = {}
  for (let i = 0; i < mapped.length; i++) {
    const canon = mapped[i]
    if (canon && cells[i] !== undefined) {
      out[canon] = cells[i].trim()
    }
  }
  return out
}
