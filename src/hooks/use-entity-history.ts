/**
 * useEntityHistory — single hook that merges every event touching a
 * given entity (sales, payments, stock movements, audit events) into a
 * unified, time-sorted feed. Used by every detail-page Activity tab.
 *
 * Inputs:
 *   - kind: which entity ("product" | "customer" | "supplier" | "sale" | ...)
 *   - id:   the entity UUID
 *   - limit: max rows (default 100)
 *
 * Output: { events, loading, error, refresh }
 *
 * Each event:
 *   { id, type, at, label, summary, route?, amount?, by?, source }
 *
 * Why one hook: every detail page would otherwise hand-roll 4–5
 * queries. Centralising means consistent shape, consistent ordering,
 * + the option to add new event sources in one place.
 */
import { useCallback, useEffect, useState } from "react"
import { query } from "@/lib/db"

export type EntityHistoryKind =
  | "product"
  | "customer"
  | "supplier"
  | "sale"
  | "purchase"
  | "employee"
  | "branch"

export type EntityHistoryEventType =
  | "sale"
  | "return"
  | "payment"
  | "stock_in"
  | "stock_out"
  | "stock_adjust"
  | "po_created"
  | "po_received"
  | "audit"

export interface EntityHistoryEvent {
  id: string
  type: EntityHistoryEventType
  /** ISO timestamp. */
  at: string
  /** Short human label (e.g. "Sold 50 units"). */
  label: string
  /** Optional longer free-text summary. */
  summary?: string
  /** Optional deep link target. */
  route?: string
  /** Optional amount (KES) — for payments / sales. */
  amount?: number
  /** Optional actor name (the user who performed it). */
  by?: string
  /** Where the event came from — for debugging only. */
  source: string
}

interface UseEntityHistoryOptions {
  kind: EntityHistoryKind
  id: string | null | undefined
  limit?: number
}

interface UseEntityHistoryResult {
  events: EntityHistoryEvent[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useEntityHistory({
  kind,
  id,
  limit = 100,
}: UseEntityHistoryOptions): UseEntityHistoryResult {
  const [events, setEvents] = useState<EntityHistoryEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setEvents([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sources = await Promise.all([
        loadSales(kind, id, limit),
        loadPayments(kind, id, limit),
        loadStockMovements(kind, id, limit),
        loadAudit(kind, id, limit),
      ])
      const merged = sources
        .flat()
        .sort((a, b) => (a.at < b.at ? 1 : -1))
        .slice(0, limit)
      setEvents(merged)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [kind, id, limit])

  useEffect(() => {
    load()
  }, [load])

  return { events, loading, error, refresh: load }
}

// ─── per-source loaders ────────────────────────────────────────────────
// Each loader returns an empty array if the entity kind doesn't apply to
// that source (e.g. payments don't apply to product detail directly).

async function loadSales(
  kind: EntityHistoryKind,
  id: string,
  limit: number,
): Promise<EntityHistoryEvent[]> {
  if (kind === "customer") {
    const rows = await query<{
      id: string
      created_at: string
      total: number
      receipt_number: string | null
    }>(
      `SELECT id, created_at, total, receipt_number
       FROM sales
       WHERE customer_id = ?1
       ORDER BY created_at DESC
       LIMIT ?2`,
      [id, limit],
    )
    return rows.map((r) => ({
      id: `sale-${r.id}`,
      type: "sale",
      at: r.created_at,
      label: `Sale ${r.receipt_number ?? r.id.slice(0, 8)}`,
      route: `/sales/${r.id}`,
      amount: r.total,
      source: "sales",
    }))
  }
  if (kind === "product") {
    const rows = await query<{
      sale_id: string
      created_at: string
      quantity: number
      total: number
    }>(
      `SELECT s.id as sale_id, s.created_at, si.quantity, si.total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id = ?1
       ORDER BY s.created_at DESC
       LIMIT ?2`,
      [id, limit],
    )
    return rows.map((r) => ({
      id: `sale-${r.sale_id}-p-${id}`,
      type: "sale",
      at: r.created_at,
      label: `Sold ${r.quantity}`,
      route: `/sales/${r.sale_id}`,
      amount: r.total,
      source: "sales",
    }))
  }
  return []
}

async function loadPayments(
  kind: EntityHistoryKind,
  id: string,
  limit: number,
): Promise<EntityHistoryEvent[]> {
  if (kind === "customer" || kind === "sale") {
    const col = kind === "sale" ? "p.sale_id" : "s.customer_id"
    const rows = await query<{
      id: string
      created_at: string
      amount: number
      method_name: string | null
    }>(
      `SELECT p.id, p.created_at, p.amount, p.method_name
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE ${col} = ?1
       ORDER BY p.created_at DESC
       LIMIT ?2`,
      [id, limit],
    )
    return rows.map((r) => ({
      id: `pay-${r.id}`,
      type: "payment",
      at: r.created_at,
      label: `Payment${r.method_name ? ` · ${r.method_name}` : ""}`,
      amount: r.amount,
      source: "payments",
    }))
  }
  return []
}

async function loadStockMovements(
  kind: EntityHistoryKind,
  id: string,
  limit: number,
): Promise<EntityHistoryEvent[]> {
  if (kind !== "product") return []
  const rows = await query<{
    id: string
    created_at: string
    type: string
    quantity: number
    notes: string | null
  }>(
    `SELECT id, created_at, type, quantity, notes
     FROM stock_movements
     WHERE product_id = ?1
     ORDER BY created_at DESC
     LIMIT ?2`,
    [id, limit],
  )
  return rows.map((r) => {
    const eventType: EntityHistoryEventType =
      r.type === "purchase" || r.type === "return"
        ? "stock_in"
        : r.type === "sale" || r.type === "damage"
          ? "stock_out"
          : "stock_adjust"
    return {
      id: `mov-${r.id}`,
      type: eventType,
      at: r.created_at,
      label:
        r.type === "purchase"
          ? `Received ${r.quantity}`
          : r.type === "sale"
            ? `Sold ${Math.abs(r.quantity)}`
            : r.type === "adjustment"
              ? `Adjusted ${r.quantity > 0 ? "+" : ""}${r.quantity}`
              : `${r.type} · ${r.quantity}`,
      summary: r.notes ?? undefined,
      source: "stock_movements",
    }
  })
}

async function loadAudit(
  kind: EntityHistoryKind,
  id: string,
  limit: number,
): Promise<EntityHistoryEvent[]> {
  // Audit log is generic — match by entity_id + entity_type
  try {
    const rows = await query<{
      id: string
      created_at: string
      action: string
      details: string | null
      user_id: string | null
    }>(
      `SELECT id, created_at, action, details, user_id
       FROM audit_log
       WHERE entity_type = ?1 AND entity_id = ?2
       ORDER BY created_at DESC
       LIMIT ?3`,
      [kind, id, limit],
    )
    return rows.map((r) => ({
      id: `audit-${r.id}`,
      type: "audit",
      at: r.created_at,
      label: r.action,
      summary: r.details ?? undefined,
      by: r.user_id ?? undefined,
      source: "audit_log",
    }))
  } catch {
    // Audit table may not exist on every install — silently return [].
    return []
  }
}
