/**
 * AI config persistence — providers, features, master settings. CRUD wrappers
 * over SQLite (db is SQLCipher-encrypted at rest; API keys go into
 * api_key_encrypted as plaintext within that encrypted DB).
 */
import { execute, query } from "@/lib/db";
import type { AiFeature, AiProvider, AiSettings, PrivacyTier, TaskKind } from "./types";

const SETTING_KEYS = [
  "free_models_only",
  "show_preview",
  "cache_enabled",
  "cache_ttl_days",
  "monthly_spend_cap_usd",
  "preview_dismiss_count",
  "high_tier_optin",
] as const;

interface ProviderRow {
  id: string;
  display_name: string;
  enabled: number;
  api_key_encrypted: string | null;
  base_url: string;
  priority: number;
  preferred_text_model: string | null;
  preferred_vision_model: string | null;
  preferred_reasoning_model: string | null;
  daily_call_count: number;
  daily_window_start: string | null;
  rate_limited_until: string | null;
  last_error: string | null;
  notes: string | null;
}

function rowToProvider(r: ProviderRow): AiProvider {
  return { ...r, enabled: r.enabled === 1 } as AiProvider;
}

export async function listProviders(): Promise<AiProvider[]> {
  const rows = await query<ProviderRow>(
    `SELECT id, display_name, enabled, api_key_encrypted, base_url, priority,
            preferred_text_model, preferred_vision_model, preferred_reasoning_model,
            daily_call_count, daily_window_start, rate_limited_until, last_error, notes
       FROM ai_providers ORDER BY priority ASC, display_name ASC`,
  );
  return rows.map(rowToProvider);
}

export async function getProvider(id: string): Promise<AiProvider | null> {
  const rows = await query<ProviderRow>(
    `SELECT id, display_name, enabled, api_key_encrypted, base_url, priority,
            preferred_text_model, preferred_vision_model, preferred_reasoning_model,
            daily_call_count, daily_window_start, rate_limited_until, last_error, notes
       FROM ai_providers WHERE id = ?1`,
    [id],
  );
  return rows[0] ? rowToProvider(rows[0]) : null;
}

export async function updateProvider(id: string, patch: Partial<AiProvider>): Promise<void> {
  const existing = await getProvider(id);
  if (!existing) throw new Error(`Provider ${id} not found`);
  const merged = { ...existing, ...patch };
  await execute(
    `UPDATE ai_providers SET
       enabled = ?2, api_key_encrypted = ?3, base_url = ?4, priority = ?5,
       preferred_text_model = ?6, preferred_vision_model = ?7, preferred_reasoning_model = ?8,
       notes = ?9, updated_at = datetime('now')
     WHERE id = ?1`,
    [
      id,
      merged.enabled ? 1 : 0,
      merged.api_key_encrypted ?? null,
      merged.base_url,
      merged.priority,
      merged.preferred_text_model ?? null,
      merged.preferred_vision_model ?? null,
      merged.preferred_reasoning_model ?? null,
      merged.notes ?? null,
    ],
  );
}

/** Set transient runtime state (rate limits, error). Does NOT bump updated_at. */
export async function setProviderRuntimeState(
  id: string,
  state: { rateLimitedUntil?: string | null; lastError?: string | null },
): Promise<void> {
  await execute(
    `UPDATE ai_providers SET rate_limited_until = ?2, last_error = ?3 WHERE id = ?1`,
    [id, state.rateLimitedUntil ?? null, state.lastError ?? null],
  );
}

interface FeatureRow {
  feature_id: string;
  display_name: string;
  description: string;
  enabled: number;
  privacy_tier: string;
  task_kind: string;
  preferred_provider: string | null;
  preferred_model: string | null;
}

export async function listFeatures(): Promise<AiFeature[]> {
  const rows = await query<FeatureRow>(
    `SELECT feature_id, display_name, description, enabled, privacy_tier, task_kind,
            preferred_provider, preferred_model
       FROM ai_features ORDER BY display_name ASC`,
  );
  return rows.map((r) => ({
    ...r,
    enabled: r.enabled === 1,
    privacy_tier: r.privacy_tier as PrivacyTier,
    task_kind: r.task_kind as TaskKind,
  }));
}

export async function getFeature(id: string): Promise<AiFeature | null> {
  const rows = await query<FeatureRow>(
    `SELECT feature_id, display_name, description, enabled, privacy_tier, task_kind,
            preferred_provider, preferred_model
       FROM ai_features WHERE feature_id = ?1`,
    [id],
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    enabled: rows[0].enabled === 1,
    privacy_tier: rows[0].privacy_tier as PrivacyTier,
    task_kind: rows[0].task_kind as TaskKind,
  };
}

export async function updateFeature(id: string, patch: Partial<AiFeature>): Promise<void> {
  const existing = await getFeature(id);
  if (!existing) throw new Error(`Feature ${id} not found`);
  const m = { ...existing, ...patch };
  await execute(
    `UPDATE ai_features SET enabled = ?2, privacy_tier = ?3, preferred_provider = ?4, preferred_model = ?5
       WHERE feature_id = ?1`,
    [id, m.enabled ? 1 : 0, m.privacy_tier, m.preferred_provider ?? null, m.preferred_model ?? null],
  );
}

const DEFAULTS: AiSettings = {
  free_models_only: true,
  show_preview: true,
  cache_enabled: true,
  cache_ttl_days: 30,
  monthly_spend_cap_usd: 5,
  preview_dismiss_count: 0,
  high_tier_optin: false,
};

export async function loadSettings(): Promise<AiSettings> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM ai_settings WHERE key IN (${SETTING_KEYS.map((_, i) => `?${i + 1}`).join(",")})`,
    SETTING_KEYS as unknown as string[],
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    free_models_only: map.free_models_only !== undefined ? map.free_models_only === "1" : DEFAULTS.free_models_only,
    show_preview: map.show_preview !== undefined ? map.show_preview === "1" : DEFAULTS.show_preview,
    cache_enabled: map.cache_enabled !== undefined ? map.cache_enabled === "1" : DEFAULTS.cache_enabled,
    cache_ttl_days: map.cache_ttl_days ? parseInt(map.cache_ttl_days, 10) : DEFAULTS.cache_ttl_days,
    monthly_spend_cap_usd: map.monthly_spend_cap_usd ? parseFloat(map.monthly_spend_cap_usd) : DEFAULTS.monthly_spend_cap_usd,
    preview_dismiss_count: map.preview_dismiss_count ? parseInt(map.preview_dismiss_count, 10) : 0,
    high_tier_optin: map.high_tier_optin === "1",
  };
}

export async function saveSetting<K extends keyof AiSettings>(key: K, value: AiSettings[K]): Promise<void> {
  const v = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  await execute(
    `INSERT INTO ai_settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, v],
  );
}
