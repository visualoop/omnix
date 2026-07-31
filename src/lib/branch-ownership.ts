import { query } from "@/lib/db";
import { requireActiveBranchId } from "@/stores/active-branch";

export type BranchOwnedTable =
  | "attendance"
  | "bank_accounts"
  | "bookings"
  | "credit_notes"
  | "cold_chain_units"
  | "delivery_notes"
  | "equipment_units"
  | "hospitality_orders"
  | "invoices"
  | "laybys"
  | "menu_items"
  | "quotations"
  | "recurring_invoice_templates"
  | "rooms"
  | "salon_appointments"
  | "service_jobs"
  | "special_orders";

/**
 * Fail closed before operating on a caller-supplied record id. The table name
 * is a closed union so it cannot become user-controlled SQL. Returns the
 * active id for callers that also need to bind subsequent child queries.
 */
export async function requireBranchOwnedRecord(
  table: BranchOwnedTable,
  id: string,
  label = "Record",
): Promise<string> {
  const branchId = requireActiveBranchId();
  const [row] = await query<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ?1 AND branch_id = ?2 LIMIT 1`,
    [id, branchId],
  );
  if (!row) throw new Error(`${label} not found in the active branch`);
  return branchId;
}
