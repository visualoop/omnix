/**
 * Cold-chain excursion root-cause analytics.
 *
 * When a temperature reading goes out of range, this analyzer surveys
 * the surrounding data to classify the likely cause and recommend
 * corrective actions. Kenyan pharmacies rarely have the time to do
 * manual root-cause analysis — this turns a raw excursion into an
 * actionable finding a pharmacist can sign off in seconds.
 *
 * Classification heuristics (see classifyExcursion — pure + testable):
 *   • power_outage  — other units breached at the same time
 *   • unit_failure  — only this unit, sustained > 60 min excursion
 *   • door_left_open — brief spike (< 30 min) that self-corrects
 *   • overload      — gradual warming after a restock event
 *   • sensor_error  — reading conflicts sharply with adjacent readings
 *   • unknown       — none of the above patterns match
 */
import { query, execute } from "@/lib/db";

export interface ExcursionReading {
  reading_at: string;
  temperature_c: number;
  in_range: number;
}

export interface ClassifyInput {
  /** The out-of-range reading that triggered analysis. */
  trigger: ExcursionReading;
  targetMin: number;
  targetMax: number;
  /** Readings on the SAME unit, last 24h, chronological. */
  unitReadings: ExcursionReading[];
  /** How many OTHER units also had an out-of-range reading within ±30 min. */
  otherUnitsBreachedNearby: number;
  /** Whether a stock receipt / restock happened within 2h before the trigger. */
  restockNearby: boolean;
}

export interface Classification {
  root_cause:
    | "power_outage"
    | "unit_failure"
    | "door_left_open"
    | "overload"
    | "sensor_error"
    | "unknown";
  confidence: number; // 0..1
  suggested_actions: string[];
  duration_minutes: number;
  peak_temperature_c: number;
}

/** Pure classifier — no DB, unit-testable. */
export function classifyExcursion(input: ClassifyInput): Classification {
  const { trigger, targetMax, unitReadings, otherUnitsBreachedNearby, restockNearby } = input;

  // Determine the excursion window: consecutive out-of-range readings on
  // this unit ending at (or around) the trigger.
  const sorted = [...unitReadings].sort((a, b) => a.reading_at.localeCompare(b.reading_at));
  const outOfRange = sorted.filter((r) => r.in_range === 0);
  const peak = Math.max(trigger.temperature_c, ...outOfRange.map((r) => r.temperature_c));

  // Duration spans from the first out-of-range reading to the recovery
  // point (first in-range reading after the last out-of-range), or to
  // the last out-of-range reading if it never recovered. Handles the
  // single-reading case where the excursion is one spike + a correction.
  let durationMinutes = 0;
  if (outOfRange.length >= 1) {
    const startTime = new Date(outOfRange[0].reading_at).getTime();
    const lastOor = outOfRange[outOfRange.length - 1];
    const recovery = sorted.find((r) => r.in_range === 1 && r.reading_at > lastOor.reading_at);
    const endTime = new Date(recovery?.reading_at ?? lastOor.reading_at).getTime();
    durationMinutes = Math.round((endTime - startTime) / 60000);
  }

  // Sensor error — a single wildly-divergent reading sandwiched between
  // two in-range readings suggests a probe glitch, not a real excursion.
  const idx = sorted.findIndex((r) => r.reading_at === trigger.reading_at);
  if (idx > 0 && idx < sorted.length - 1) {
    const prev = sorted[idx - 1];
    const next = sorted[idx + 1];
    if (prev.in_range === 1 && next.in_range === 1 && Math.abs(trigger.temperature_c - prev.temperature_c) > 8) {
      return {
        root_cause: "sensor_error",
        confidence: 0.7,
        suggested_actions: [
          "Verify the reading with a second calibrated thermometer.",
          "If the second reading is in range, log a sensor calibration check.",
          "Do not quarantine stock until confirmed.",
        ],
        duration_minutes: durationMinutes,
        peak_temperature_c: peak,
      };
    }
  }

  // Power outage — multiple units breached simultaneously.
  if (otherUnitsBreachedNearby >= 1) {
    return {
      root_cause: "power_outage",
      confidence: 0.85,
      suggested_actions: [
        "Confirm mains power / check the generator + UPS.",
        "Move cold-chain stock to a backup unit or validated cool box with ice packs.",
        "Log the outage start + end time.",
        `Quarantine affected products if the excursion exceeded 30 minutes (peak ${peak.toFixed(1)}°C).`,
      ],
      duration_minutes: durationMinutes,
      peak_temperature_c: peak,
    };
  }

  // Overload — restock event shortly before, gradual warming.
  if (restockNearby && peak <= targetMax + 4) {
    return {
      root_cause: "overload",
      confidence: 0.6,
      suggested_actions: [
        "Warm stock was likely loaded — allow the unit to recover before adding more.",
        "Do not overfill; leave space for air circulation.",
        "Re-check temperature in 1 hour.",
      ],
      duration_minutes: durationMinutes,
      peak_temperature_c: peak,
    };
  }

  // Door left open — brief spike (< 30 min) that self-corrects.
  const selfCorrected = sorted.length > 0 && sorted[sorted.length - 1].in_range === 1;
  if (durationMinutes > 0 && durationMinutes < 30 && selfCorrected) {
    return {
      root_cause: "door_left_open",
      confidence: 0.65,
      suggested_actions: [
        "Check the door seal + hinge; confirm it closes flush.",
        "Brief the team on minimising door-open time.",
        "Stock likely unaffected given the short duration — document and monitor.",
      ],
      duration_minutes: durationMinutes,
      peak_temperature_c: peak,
    };
  }

  // Unit failure — sustained excursion, single unit, not self-corrected.
  if (durationMinutes >= 60 && !selfCorrected) {
    return {
      root_cause: "unit_failure",
      confidence: 0.75,
      suggested_actions: [
        "Suspect compressor / thermostat failure — call a technician.",
        "Immediately move all cold-chain stock to a working unit.",
        `Quarantine products from this unit (peak ${peak.toFixed(1)}°C for ${durationMinutes} min) pending manufacturer guidance.`,
        "Do not return stock until the unit holds 2–8°C for 24h.",
      ],
      duration_minutes: durationMinutes,
      peak_temperature_c: peak,
    };
  }

  return {
    root_cause: "unknown",
    confidence: 0.3,
    suggested_actions: [
      "Review the unit manually.",
      "Check power, door seal, and thermostat setting.",
      "Monitor the next few readings closely.",
    ],
    duration_minutes: durationMinutes,
    peak_temperature_c: peak,
  };
}

export interface ColdChainAnalysis {
  id: string;
  unit_id: string;
  trigger_log_id: string;
  excursion_start: string;
  excursion_end: string | null;
  duration_minutes: number | null;
  peak_temperature_c: number;
  root_cause: Classification["root_cause"];
  confidence: number;
  suggested_actions: string | null;
  affected_products: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

/**
 * Analyze the excursion rooted at a given out-of-range log row. Gathers
 * the surrounding data, classifies, and persists a cold_chain_analyses
 * row. Idempotent per trigger_log_id.
 */
export async function analyzeExcursion(triggerLogId: string): Promise<string | null> {
  const [trigger] = await query<{
    id: string; unit_id: string; temperature_c: number; reading_at: string; in_range: number;
  }>(
    `SELECT id, unit_id, temperature_c, reading_at, in_range FROM cold_chain_logs WHERE id = ?1`,
    [triggerLogId],
  );
  if (!trigger || trigger.in_range === 1) return null;

  // Idempotency — one analysis per trigger.
  const existing = await query<{ id: string }>(
    `SELECT id FROM cold_chain_analyses WHERE trigger_log_id = ?1`,
    [triggerLogId],
  );
  if (existing[0]) return existing[0].id;

  const [unit] = await query<{ target_min_c: number; target_max_c: number }>(
    `SELECT target_min_c, target_max_c FROM cold_chain_units WHERE id = ?1`,
    [trigger.unit_id],
  );
  if (!unit) return null;

  // 24h of readings on this unit.
  const unitReadings = await query<ExcursionReading>(
    `SELECT reading_at, temperature_c, in_range FROM cold_chain_logs
      WHERE unit_id = ?1 AND julianday(?2) - julianday(reading_at) BETWEEN 0 AND 1
      ORDER BY reading_at ASC`,
    [trigger.unit_id, trigger.reading_at],
  );

  // Other units breached within ±30 minutes.
  const [{ cnt: otherBreached }] = await query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT unit_id) AS cnt FROM cold_chain_logs
      WHERE unit_id != ?1 AND in_range = 0
        AND ABS(julianday(reading_at) - julianday(?2)) * 24 * 60 <= 30`,
    [trigger.unit_id, trigger.reading_at],
  );

  // Restock within 2h before the trigger (stock_movements type='purchase'/'receipt').
  const restockRows = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM stock_movements
      WHERE type IN ('purchase', 'grn', 'receipt', 'adjustment')
        AND julianday(?1) - julianday(created_at) BETWEEN 0 AND 0.0834`,
    [trigger.reading_at],
  ).catch(() => [{ cnt: 0 }]);
  const restockNearby = (restockRows[0]?.cnt ?? 0) > 0;

  const classification = classifyExcursion({
    trigger: { reading_at: trigger.reading_at, temperature_c: trigger.temperature_c, in_range: 0 },
    targetMin: unit.target_min_c,
    targetMax: unit.target_max_c,
    unitReadings,
    otherUnitsBreachedNearby: otherBreached,
    restockNearby,
  });

  // Affected cold-chain products: those whose pharmacy_products.cold_chain=1
  // and have stock on hand (heuristic — all cold-chain SKUs share the fridge).
  const affected = await query<{ name: string }>(
    `SELECT DISTINCT p.name FROM pharmacy_products pp
       JOIN products p ON p.id = pp.product_id
      WHERE pp.cold_chain = 1
      LIMIT 20`,
  ).catch(() => []);

  const outOfRange = unitReadings.filter((r) => r.in_range === 0);
  const excursionStart = outOfRange[0]?.reading_at ?? trigger.reading_at;
  const lastReading = unitReadings[unitReadings.length - 1];
  const excursionEnd = lastReading?.in_range === 1 ? lastReading.reading_at : null;

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO cold_chain_analyses
       (id, unit_id, trigger_log_id, excursion_start, excursion_end, duration_minutes,
        peak_temperature_c, root_cause, confidence, suggested_actions, affected_products)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [
      id, trigger.unit_id, triggerLogId, excursionStart, excursionEnd,
      classification.duration_minutes, classification.peak_temperature_c,
      classification.root_cause, classification.confidence,
      classification.suggested_actions.join("\n"),
      affected.map((a) => a.name).join(", "),
    ],
  );
  return id;
}

export async function listAnalyses(unitId?: string): Promise<ColdChainAnalysis[]> {
  return query<ColdChainAnalysis>(
    `SELECT * FROM cold_chain_analyses ${unitId ? "WHERE unit_id = ?1" : ""} ORDER BY excursion_start DESC LIMIT 100`,
    unitId ? [unitId] : [],
  );
}

export async function reviewAnalysis(id: string, userId: string, notes: string): Promise<void> {
  await execute(
    `UPDATE cold_chain_analyses SET reviewed_by = ?2, reviewed_at = datetime('now'), resolution_notes = ?3 WHERE id = ?1`,
    [id, userId, notes],
  );
}

/**
 * Convenience — called from recordTemperature when a reading is logged
 * out of range. Runs the analysis and returns the new analysis id.
 */
export async function analyzeLatestExcursionForUnit(unitId: string): Promise<string | null> {
  const [latest] = await query<{ id: string }>(
    `SELECT id FROM cold_chain_logs WHERE unit_id = ?1 AND in_range = 0 ORDER BY reading_at DESC LIMIT 1`,
    [unitId],
  );
  if (!latest) return null;
  return analyzeExcursion(latest.id);
}
