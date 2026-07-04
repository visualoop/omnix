/**
 * Units of measure service.
 *
 * Every unit has:
 *   - id   → the token used everywhere (`g`, `kg`, `crate`, `bunch`)
 *   - dimension → mass / volume / count / length
 *   - base_unit_id + factor_to_base → so any two units of the same
 *     dimension can be converted with `qty * factor / targetFactor`.
 *
 * Standalone count units (bag, sack, bunch, tin) sit in the count
 * dimension with themselves as base. They CAN'T convert to another
 * count unit because "1 bag of cement" ≠ "N bunches of sukuma" — the
 * model refuses cross-conversions across bases and returns null.
 */
import { query, execute } from "@/lib/db";
import { requirePermission } from "@/services/rbac";

export type UnitDimension = "mass" | "volume" | "count" | "length";

export interface Unit {
  id: string;
  label: string;
  plural: string | null;
  dimension: UnitDimension;
  base_unit_id: string;
  factor_to_base: number;
  sort_order: number;
  active: number;
}

/** List every active unit, ordered by (dimension, sort_order) so the
 *  picker groups them naturally: mass first, then volume, count, length. */
export async function listUnits(): Promise<Unit[]> {
  return query<Unit>(
    `SELECT id, label, plural, dimension, base_unit_id, factor_to_base, sort_order, active
     FROM units WHERE active = 1
     ORDER BY dimension, sort_order, id`,
  );
}

/** Optimised lookup for a single id — used by conversion + product
 *  display code paths where we already know which unit we want. */
export async function getUnit(id: string): Promise<Unit | null> {
  const rows = await query<Unit>(`SELECT * FROM units WHERE id = ?1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function createUnit(input: {
  id: string;
  label: string;
  plural?: string;
  dimension: UnitDimension;
  baseUnitId?: string;
  factorToBase?: number;
}): Promise<string> {
  await requirePermission("inventory.edit", { entityType: "unit", metadata: { id: input.id } });
  const id = input.id.trim();
  if (!id) throw new Error("Unit id required");
  const base = input.baseUnitId ?? id;
  const factor = input.factorToBase ?? 1;
  await execute(
    `INSERT INTO units (id, label, plural, dimension, base_unit_id, factor_to_base)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [id, input.label, input.plural ?? null, input.dimension, base, factor],
  );
  return id;
}

export async function updateUnit(id: string, patch: {
  label?: string;
  plural?: string | null;
  dimension?: UnitDimension;
  baseUnitId?: string;
  factorToBase?: number;
  active?: boolean;
}): Promise<void> {
  await requirePermission("inventory.edit", { entityType: "unit", entityId: id });
  const set: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => { params.push(val); set.push(`${col} = ?${params.length}`); };
  if (patch.label !== undefined) push("label", patch.label);
  if (patch.plural !== undefined) push("plural", patch.plural);
  if (patch.dimension !== undefined) push("dimension", patch.dimension);
  if (patch.baseUnitId !== undefined) push("base_unit_id", patch.baseUnitId);
  if (patch.factorToBase !== undefined) push("factor_to_base", patch.factorToBase);
  if (patch.active !== undefined) push("active", patch.active ? 1 : 0);
  if (set.length === 0) return;
  params.push(id);
  await execute(`UPDATE units SET ${set.join(", ")} WHERE id = ?${params.length}`, params);
}

/**
 * Convert `qty` from unit `from` to unit `to`. Returns null when the
 * two units live in different dimensions OR different bases (e.g. a
 * bag can't be converted to a bunch — see comment above).
 *
 * Uses factor_to_base semantics: 200 g * 0.001 = 0.2 kg. 0.2 kg / 1 = 0.2 kg.
 */
export async function convertUnits(qty: number, from: string, to: string): Promise<number | null> {
  if (from === to) return qty;
  const [f, t] = await Promise.all([getUnit(from), getUnit(to)]);
  if (!f || !t) return null;
  if (f.dimension !== t.dimension) return null;
  if (f.base_unit_id !== t.base_unit_id) return null;
  return (qty * f.factor_to_base) / t.factor_to_base;
}

/** Delete a unit if nothing references it. Safety: we don't cascade —
 *  the operator has to reassign products that use it first. */
export async function deleteUnit(id: string): Promise<void> {
  await requirePermission("inventory.edit", { entityType: "unit", entityId: id });
  const [inUse] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM products WHERE unit = ?1`, [id]);
  if (inUse && inUse.n > 0) {
    throw new Error(`Cannot delete — ${inUse.n} product(s) still use this unit. Reassign them first.`);
  }
  await execute(`DELETE FROM units WHERE id = ?1`, [id]);
}

/** Human label for a unit id — plural form when qty != 1. Falls back
 *  to the raw id if the unit isn't registered (legacy free-text unit). */
export function unitLabel(unit: Unit | null, qty: number, rawId: string): string {
  if (!unit) return rawId;
  if (qty === 1) return unit.label;
  return unit.plural ?? unit.label + "s";
}
