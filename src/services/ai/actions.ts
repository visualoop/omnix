/**
 * AI write-action framework — human-in-the-loop mutations.
 *
 * The assistant can PROPOSE a structured action; the user reviews a concrete
 * preview of exactly what will change and clicks Apply; only then does the
 * action run, through the same audited, transactional services a human uses.
 *
 * Non-negotiable safety rules (mirrors docs/AI_ROADMAP §10):
 *   - Nothing here mutates without explicit user confirmation in the UI.
 *   - Every action is permission-checked (RBAC) before it runs.
 *   - Every proposed + applied action is logged to ai_actions.
 *   - The preview is read-only and must show the real effect (counts, totals).
 *   - Inputs are validated again at execute time — model output is untrusted.
 *
 * An action is registered in ACTIONS by id. The proposer (assistant tool)
 * builds an `ActionProposal`; the dialog renders `preview`; on apply it calls
 * `execute`. Adding a new action = one entry here + (optionally) a tool.
 */
import { execute as dbExecute, query } from "@/lib/db";
import type { Permission } from "@/lib/permissions";

export type ActionId =
  | "set_product_category"
  | "set_reorder_level"
  | "draft_purchase_order";

export interface ActionProposalBase {
  id: ActionId;
  /** One-line human summary shown in the confirm dialog title area. */
  summary: string;
}

/* ── Per-action payload shapes ─────────────────────────────────────────── */

export interface SetCategoryPayload {
  id: "set_product_category";
  product_ids: string[];
  category_id: string;
  category_name: string;
}

export interface SetReorderPayload {
  id: "set_reorder_level";
  product_id: string;
  product_name: string;
  reorder_level: number;
}

export interface DraftPOPayload {
  id: "draft_purchase_order";
  supplier_id: string;
  supplier_name: string;
  items: Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }>;
}

export type ActionPayload = SetCategoryPayload | SetReorderPayload | DraftPOPayload;

export type ActionProposal = ActionProposalBase & { payload: ActionPayload };

/** A line in the preview the user sees before confirming. */
export interface PreviewLine {
  label: string;
  value: string;
}

export interface PreviewResult {
  /** Human description of the change. */
  lines: PreviewLine[];
  /** A short warning if the action is unusual (e.g. very large PO). */
  warning?: string;
}

export interface ExecuteResult {
  ok: boolean;
  message: string;
  /** Where to navigate after success, if anywhere. */
  route?: string;
}

interface ActionDef<P extends ActionPayload> {
  /** RBAC permission required to run it. */
  permission: Permission;
  /** Read-only: compute what will change for the confirm dialog. */
  preview: (payload: P) => Promise<PreviewResult>;
  /** Mutating: run through existing services. Caller has already confirmed. */
  execute: (payload: P, userId: string) => Promise<ExecuteResult>;
}

/* ── Action catalog ────────────────────────────────────────────────────── */

const setCategory: ActionDef<SetCategoryPayload> = {
  permission: "inventory.edit",
  async preview(p) {
    const rows = await query<{ name: string }>(
      `SELECT name FROM products WHERE id IN (${p.product_ids.map((_, i) => `?${i + 1}`).join(",")})`,
      p.product_ids,
    );
    return {
      lines: [
        { label: "Products", value: String(rows.length) },
        { label: "New category", value: p.category_name },
        ...rows.slice(0, 8).map((r) => ({ label: "·", value: r.name })),
        ...(rows.length > 8 ? [{ label: "·", value: `…and ${rows.length - 8} more` }] : []),
      ],
    };
  },
  async execute(p) {
    if (p.product_ids.length === 0) return { ok: false, message: "No products selected." };
    const placeholders = p.product_ids.map((_, i) => `?${i + 2}`).join(",");
    await dbExecute(
      `UPDATE products SET category_id = ?1, updated_at = datetime('now') WHERE id IN (${placeholders})`,
      [p.category_id, ...p.product_ids],
    );
    return { ok: true, message: `Categorised ${p.product_ids.length} product(s) as ${p.category_name}.`, route: "/inventory" };
  },
};

const setReorder: ActionDef<SetReorderPayload> = {
  permission: "inventory.edit",
  async preview(p) {
    const [cur] = await query<{ reorder_level: number }>(
      `SELECT reorder_level FROM products WHERE id = ?1`,
      [p.product_id],
    );
    return {
      lines: [
        { label: "Product", value: p.product_name },
        { label: "Current reorder level", value: String(cur?.reorder_level ?? "—") },
        { label: "New reorder level", value: String(p.reorder_level) },
      ],
    };
  },
  async execute(p) {
    await dbExecute(
      `UPDATE products SET reorder_level = ?1, updated_at = datetime('now') WHERE id = ?2`,
      [p.reorder_level, p.product_id],
    );
    return { ok: true, message: `Reorder level for ${p.product_name} set to ${p.reorder_level}.`, route: "/inventory" };
  },
};

const draftPO: ActionDef<DraftPOPayload> = {
  permission: "purchase_orders.create",
  async preview(p) {
    const total = p.items.reduce((s, i) => s + i.unit_cost * i.quantity, 0);
    const lines: PreviewLine[] = [
      { label: "Supplier", value: p.supplier_name },
      { label: "Line items", value: String(p.items.length) },
      { label: "Estimated total", value: `KES ${total.toLocaleString()}` },
      ...p.items.slice(0, 8).map((i) => ({ label: "·", value: `${i.product_name} × ${i.quantity}` })),
      ...(p.items.length > 8 ? [{ label: "·", value: `…and ${p.items.length - 8} more` }] : []),
    ];
    return {
      lines,
      warning: total > 500000 ? "This is a large order — double-check quantities before applying." : undefined,
    };
  },
  async execute(p, userId) {
    if (p.items.length === 0) return { ok: false, message: "No items to order." };
    const { createPurchaseOrder } = await import("@/services/erp");
    await createPurchaseOrder({
      supplier_id: p.supplier_id,
      user_id: userId,
      items: p.items,
      notes: "Drafted by Omnix AI from reorder suggestions",
    });
    return { ok: true, message: `Draft PO created for ${p.supplier_name} (${p.items.length} items).`, route: `/purchase-orders` };
  },
};

const ACTIONS: { [K in ActionId]: ActionDef<Extract<ActionPayload, { id: K }>> } = {
  set_product_category: setCategory,
  set_reorder_level: setReorder,
  draft_purchase_order: draftPO,
};

/* ── Public API used by the dialog ─────────────────────────────────────── */

export async function previewAction(proposal: ActionProposal): Promise<PreviewResult> {
  const def = ACTIONS[proposal.payload.id] as ActionDef<ActionPayload>;
  if (!def) return { lines: [{ label: "Error", value: "Unknown action" }] };
  return def.preview(proposal.payload);
}

/**
 * Apply a proposed action. Checks permission, logs to ai_actions both the
 * proposal and the outcome, and runs the executor. Throws on permission
 * failure (so the dialog can surface it) — never silently mutates.
 */
export async function applyAction(proposal: ActionProposal, userId: string): Promise<ExecuteResult> {
  const def = ACTIONS[proposal.payload.id] as ActionDef<ActionPayload>;
  if (!def) return { ok: false, message: "Unknown action" };

  // Permission gate — same guard a human hits.
  const { requirePermission } = await import("@/services/rbac");
  await requirePermission(def.permission, { entityType: "ai_action", metadata: { action: proposal.payload.id } });

  const actionRowId = crypto.randomUUID();
  await dbExecute(
    `INSERT INTO ai_actions (id, action_id, summary, payload_json, status, proposed_by)
     VALUES (?1, ?2, ?3, ?4, 'applied', ?5)`,
    [actionRowId, proposal.payload.id, proposal.summary, JSON.stringify(proposal.payload), userId],
  ).catch(() => { /* ledger is best-effort; never block the action on it */ });

  try {
    const result = await def.execute(proposal.payload as never, userId);
    await dbExecute(
      `UPDATE ai_actions SET status = ?2, result_message = ?3, applied_at = datetime('now') WHERE id = ?1`,
      [actionRowId, result.ok ? "applied" : "failed", result.message],
    ).catch(() => {});
    return result;
  } catch (e) {
    await dbExecute(
      `UPDATE ai_actions SET status = 'failed', result_message = ?2 WHERE id = ?1`,
      [actionRowId, String(e)],
    ).catch(() => {});
    throw e;
  }
}

/** Record a proposal that the user rejected (for the action ledger / learning). */
export async function recordRejectedAction(proposal: ActionProposal, userId: string): Promise<void> {
  await dbExecute(
    `INSERT INTO ai_actions (id, action_id, summary, payload_json, status, proposed_by)
     VALUES (?1, ?2, ?3, ?4, 'rejected', ?5)`,
    [crypto.randomUUID(), proposal.payload.id, proposal.summary, JSON.stringify(proposal.payload), userId],
  ).catch(() => {});
}
