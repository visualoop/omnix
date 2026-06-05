/**
 * AI audit log — every call writes one row to ai_calls (success or failure),
 * with the prompt/response already redacted by the router. Used both for
 * debugging ("why did this call fail?") and for end-user transparency on
 * the AI activity page.
 */
import { execute, query } from "@/lib/db";
import type { CallStatus, ChatRequest, ChatResponse, PrivacyTier, ProviderId } from "./types";

export interface AiCallRow {
  id: string;
  feature_id: string;
  provider_id: string;
  model: string;
  user_id: string | null;
  prompt_redacted: string;
  response_redacted: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  cache_hit: number;
  privacy_tier: string;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface RecordCallInput {
  featureId: string;
  providerId: ProviderId | "none";
  model: string;
  userId: string | null;
  request: ChatRequest;
  response: ChatResponse | null;
  privacyTier: PrivacyTier;
  status: CallStatus;
  errorMessage?: string;
}

export async function recordCall(input: RecordCallInput): Promise<void> {
  // Compact prompt summary: last user message text, capped at 800 chars.
  const lastUser = input.request.messages.reverse().find((m) => m.role === "user");
  const promptSummary = lastUser
    ? typeof lastUser.content === "string"
      ? lastUser.content.slice(0, 800)
      : JSON.stringify(lastUser.content).slice(0, 800)
    : "";
  const responseSummary = input.response?.text?.slice(0, 800) ?? null;

  await execute(
    `INSERT INTO ai_calls (id, feature_id, provider_id, model, user_id, prompt_redacted, response_redacted,
       tokens_in, tokens_out, cost_usd, cache_hit, privacy_tier, latency_ms, status, error_message)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    [
      crypto.randomUUID(),
      input.featureId,
      input.providerId,
      input.model,
      input.userId,
      promptSummary,
      responseSummary,
      input.response?.tokens_in ?? null,
      input.response?.tokens_out ?? null,
      input.response?.cost_usd ?? null,
      input.response?.cache_hit ? 1 : 0,
      input.privacyTier,
      input.response?.latency_ms ?? null,
      input.status,
      input.errorMessage ?? null,
    ],
  );
}

export async function listCalls(limit = 100): Promise<AiCallRow[]> {
  return query<AiCallRow>(
    `SELECT * FROM ai_calls ORDER BY datetime(created_at) DESC LIMIT ?1`,
    [limit],
  );
}

export interface CallStats {
  total: number;
  success: number;
  errors: number;
  rate_limited: number;
  cache_hit_pct: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
}

export async function callStats(days = 30): Promise<CallStats> {
  const rows = await query<{
    n: number;
    ok: number;
    err: number;
    rl: number;
    cache: number;
    tin: number;
    tout: number;
    cost: number;
  }>(
    `SELECT
        COUNT(*) AS n,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS err,
        SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) AS rl,
        SUM(cache_hit) AS cache,
        COALESCE(SUM(tokens_in),0) AS tin,
        COALESCE(SUM(tokens_out),0) AS tout,
        COALESCE(SUM(cost_usd),0) AS cost
       FROM ai_calls
      WHERE julianday('now') - julianday(created_at) < ?1`,
    [days],
  );
  const r = rows[0] ?? { n: 0, ok: 0, err: 0, rl: 0, cache: 0, tin: 0, tout: 0, cost: 0 };
  return {
    total: r.n,
    success: r.ok,
    errors: r.err,
    rate_limited: r.rl,
    cache_hit_pct: r.n > 0 ? (r.cache / r.n) * 100 : 0,
    total_tokens_in: r.tin,
    total_tokens_out: r.tout,
    total_cost_usd: r.cost,
  };
}
