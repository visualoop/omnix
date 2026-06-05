/**
 * AI prompt-response cache. Deterministic tasks (categorize, normalize) get
 * the same answer every time — caching cuts free-tier rate-limit pressure,
 * eliminates latency, and keeps cost at zero on repeat work.
 *
 * Key = SHA-256(model + JSON-stable(messages) + jsonSchema?). Stored in
 * SQLite. Expired rows are reaped lazily on read (no scheduled job).
 */
import { execute, query } from "@/lib/db";
import type { ChatRequest, ChatResponse } from "./types";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable JSON: object keys sorted recursively so logically-equal inputs hash identically. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const entries = Object.keys(value as object)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k]));
  return "{" + entries.join(",") + "}";
}

export async function cacheKey(model: string, request: ChatRequest): Promise<string> {
  return sha256(
    stableStringify({
      model,
      messages: request.messages,
      jsonSchema: request.jsonSchema ?? null,
    }),
  );
}

export async function readCache(key: string): Promise<ChatResponse | null> {
  const rows = await query<{ response_json: string; tokens_in: number; tokens_out: number; model: string; expires_at: string }>(
    `SELECT response_json, tokens_in, tokens_out, model, expires_at
       FROM ai_cache WHERE cache_key = ?1 AND datetime(expires_at) > datetime('now')`,
    [key],
  );
  if (rows.length === 0) return null;
  try {
    const parsed = JSON.parse(rows[0].response_json) as Omit<ChatResponse, "cache_hit" | "latency_ms">;
    return { ...parsed, cache_hit: true, latency_ms: 0 };
  } catch {
    return null;
  }
}

export async function writeCache(
  key: string,
  featureId: string,
  response: ChatResponse,
  ttlDays: number,
): Promise<void> {
  // Persist everything except the cache_hit flag (we set it on read).
  const { cache_hit: _ch, latency_ms: _lm, ...persisted } = response;
  void _ch;
  void _lm;
  await execute(
    `INSERT OR REPLACE INTO ai_cache (cache_key, feature_id, model, response_json, tokens_in, tokens_out, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now', '+' || ?7 || ' days'))`,
    [key, featureId, response.model, JSON.stringify(persisted), response.tokens_in, response.tokens_out, ttlDays],
  );
}

/** Drop expired rows; cheap one-shot cleanup callable from idle hooks. */
export async function purgeExpired(): Promise<number> {
  const before = await query<{ n: number }>(`SELECT COUNT(*) as n FROM ai_cache WHERE datetime(expires_at) <= datetime('now')`);
  await execute(`DELETE FROM ai_cache WHERE datetime(expires_at) <= datetime('now')`);
  return before[0]?.n ?? 0;
}
