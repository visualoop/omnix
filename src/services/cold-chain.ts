/**
 * Cold-chain temperature monitoring service.
 */
import { query, execute } from "@/lib/db";

export interface ColdChainUnit {
  id: string;
  name: string;
  location: string | null;
  target_min_c: number;
  target_max_c: number;
  last_temp_c: number | null;
  last_recorded_at: string | null;
  branch_id: string | null;
  active: number;
  created_at: string;
}

export interface ColdChainLog {
  id: string;
  unit_id: string;
  temperature_c: number;
  reading_at: string;
  in_range: number;
  action_taken: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export async function listUnits(activeOnly = true): Promise<ColdChainUnit[]> {
  return query<ColdChainUnit>(
    `SELECT * FROM cold_chain_units ${activeOnly ? "WHERE active = 1" : ""} ORDER BY name`,
  );
}

export async function upsertUnit(input: Partial<ColdChainUnit> & { name: string }): Promise<string> {
  const id = input.id || `cc-${crypto.randomUUID().slice(0, 8)}`;
  if (input.id) {
    await execute(
      `UPDATE cold_chain_units SET name = ?2, location = ?3, target_min_c = ?4, target_max_c = ?5, active = ?6 WHERE id = ?1`,
      [id, input.name, input.location || null, input.target_min_c ?? 2, input.target_max_c ?? 8, input.active ?? 1],
    );
  } else {
    await execute(
      `INSERT INTO cold_chain_units (id, name, location, target_min_c, target_max_c, active)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [id, input.name, input.location || null, input.target_min_c ?? 2, input.target_max_c ?? 8, input.active ?? 1],
    );
  }
  return id;
}

export async function recordTemperature(input: {
  unit_id: string;
  temperature_c: number;
  action_taken?: string;
  notes?: string;
  user_id: string;
}): Promise<string> {
  const [unit] = await query<ColdChainUnit>(`SELECT * FROM cold_chain_units WHERE id = ?1`, [input.unit_id]);
  if (!unit) throw new Error("Unit not found");

  const inRange = input.temperature_c >= unit.target_min_c && input.temperature_c <= unit.target_max_c;
  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO cold_chain_logs (id, unit_id, temperature_c, in_range, action_taken, notes, user_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [id, input.unit_id, input.temperature_c, inRange ? 1 : 0,
      input.action_taken || null, input.notes || null, input.user_id],
  );
  await execute(
    `UPDATE cold_chain_units SET last_temp_c = ?2, last_recorded_at = datetime('now') WHERE id = ?1`,
    [input.unit_id, input.temperature_c],
  );
  return id;
}

export async function listLogs(unitId?: string, opts?: { startDate?: string; endDate?: string; limit?: number }): Promise<Array<ColdChainLog & { unit_name: string; user_name: string }>> {
  const conditions: string[] = [];
  const params: any[] = [];
  if (unitId) { conditions.push(`l.unit_id = ?${params.length + 1}`); params.push(unitId); }
  if (opts?.startDate) { conditions.push(`l.reading_at >= ?${params.length + 1}`); params.push(opts.startDate); }
  if (opts?.endDate) { conditions.push(`l.reading_at <= ?${params.length + 1}`); params.push(opts.endDate + " 23:59:59"); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return query(
    `SELECT l.*, u.name AS unit_name, us.full_name AS user_name
     FROM cold_chain_logs l
     JOIN cold_chain_units u ON u.id = l.unit_id
     LEFT JOIN users us ON us.id = l.user_id
     ${where}
     ORDER BY l.reading_at DESC
     LIMIT ?${params.length + 1}`,
    [...params, opts?.limit || 200],
  );
}

/** Returns true if a unit's temperature was last recorded today. */
export async function wasRecordedToday(unitId: string): Promise<boolean> {
  const [r] = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM cold_chain_logs WHERE unit_id = ?1 AND date(reading_at) = date('now')`,
    [unitId],
  );
  return (r?.count || 0) > 0;
}
