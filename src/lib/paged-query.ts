/**
 * pagedQuery — one helper that every list service uses to add search +
 * pagination without repeating COUNT + LIMIT boilerplate.
 *
 * Usage:
 *   export async function pageInvoices(q: ListQuery): Promise<ListPage<Invoice>> {
 *     return pagedQuery<Invoice>({
 *       table: "invoices",
 *       select: "*",
 *       searchColumns: ["invoice_number", "customer_name"],
 *       orderBy: "issue_date DESC",
 *     }, q);
 *   }
 *
 * Or, when the query needs joins / extra WHERE:
 *   pagedQuery<T>({
 *     baseSql: `SELECT i.*, c.name AS customer_name FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id`,
 *     countSql: `SELECT COUNT(*) AS n FROM invoices`,   // remember to match the joins used in WHERE
 *     searchColumns: ["i.invoice_number", "c.name"],
 *     orderBy: "i.issue_date DESC",
 *     extraWhere: ["i.status != 'cancelled'"],
 *     extraParams: [],
 *   }, q);
 */
import { query } from "@/lib/db";
import { pageBounds, type ListQuery, type ListPage } from "@/lib/list-types";

interface Config {
  /** Simple table name. Use if you don't need joins. */
  table?: string;
  /** SELECT expression (columns/aliases). Defaults to "*". */
  select?: string;
  /**
   * OR: give a full SELECT ... FROM ... [JOIN ...] fragment. `WHERE` and
   * `ORDER BY` and `LIMIT` are appended by the helper.
   */
  baseSql?: string;
  /**
   * OR: give a full SELECT COUNT(*) fragment. Only needed when `baseSql`
   * is provided (so we can count with the same joins).
   */
  countSql?: string;
  /** Columns to LIKE-search on when `search` is present. */
  searchColumns?: string[];
  /** ORDER BY clause without the "ORDER BY" prefix. */
  orderBy?: string;
  /** Extra WHERE fragments (joined with AND). */
  extraWhere?: string[];
  /** Params for extraWhere placeholders (?1, ?2, ...). */
  extraParams?: unknown[];
}

export async function pagedQuery<T>(config: Config, q: ListQuery): Promise<ListPage<T>> {
  const { limit, offset } = pageBounds(q);

  const clauses: string[] = [...(config.extraWhere ?? [])];
  const params: unknown[] = [...(config.extraParams ?? [])];

  if (q.search && q.search.trim() && (config.searchColumns?.length ?? 0) > 0) {
    const placeholder = `?${params.length + 1}`;
    const inner = config.searchColumns!.map((col) => `${col} LIKE ${placeholder}`).join(" OR ");
    clauses.push(`(${inner})`);
    params.push(`%${q.search.trim()}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const order = config.orderBy ? `ORDER BY ${config.orderBy}` : "";

  const dataSql = config.baseSql
    ? `${config.baseSql} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`
    : `SELECT ${config.select ?? "*"} FROM ${config.table} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`;
  const countSql = config.countSql
    ? `${config.countSql} ${where}`
    : `SELECT COUNT(*) AS n FROM ${config.table} ${where}`;

  const rows = await query<T>(dataSql, params);
  const [totalRow] = await query<{ n: number }>(countSql, params);
  const total = totalRow?.n ?? 0;

  return {
    rows,
    total,
    hasMore: total > offset + rows.length,
  };
}
