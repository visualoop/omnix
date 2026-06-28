/**
 * AI integration types — shared across the router, cache, audit and tasks.
 *
 * Design summary: every supported provider exposes an OpenAI-compatible
 * chat-completions endpoint, so one HTTP shape handles them all. The router
 * builds a fallback chain (priority + rate-limit awareness) and falls
 * through on 429 / 5xx. Every call is cached (deterministic prompts) and
 * audited (redacted prompt/response, tokens, cost, latency).
 */

export type ProviderId =
  | "groq"
  | "openrouter"
  | "deepseek"
  | "google"
  | "openai"
  | "anthropic"
  | "custom";

export type PrivacyTier = "low" | "medium" | "high";
export type TaskKind = "text" | "vision" | "reasoning";
export type CallStatus = "ok" | "rate_limited" | "error" | "blocked_privacy" | "no_provider";

export interface AiProvider {
  id: ProviderId;
  display_name: string;
  enabled: boolean;
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

export interface AiFeature {
  feature_id: string;
  display_name: string;
  description: string;
  enabled: boolean;
  privacy_tier: PrivacyTier;
  task_kind: TaskKind;
  preferred_provider: string | null;
  preferred_model: string | null;
}

export interface AiSettings {
  free_models_only: boolean;
  show_preview: boolean;
  cache_enabled: boolean;
  cache_ttl_days: number;
  monthly_spend_cap_usd: number;
  preview_dismiss_count: number;
  high_tier_optin: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Force-pick a model (overrides router); usually undefined. */
  model?: string;
  /** JSON Schema for structured output (when supported by provider). */
  jsonSchema?: Record<string, unknown>;
  /** 0–1 sampling temp; default 0.2 for deterministic-ish output. */
  temperature?: number;
  /** Hard cap; default 1024. */
  maxTokens?: number;
}

export interface ChatResponse {
  /** Raw assistant text. */
  text: string;
  /** Parsed JSON if the request had a jsonSchema. */
  json: unknown | null;
  /** Provider that fulfilled the call. */
  provider: ProviderId;
  /** Model that fulfilled the call. */
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  cache_hit: boolean;
}

/** Per-call options exposed to feature code. */
export interface InvokeOptions {
  /** Skip cache lookup for this call. */
  bypassCache?: boolean;
  /** Override the feature's default privacy tier (rarely needed). */
  privacyTier?: PrivacyTier;
}

export class AiError extends Error {
  /** Milliseconds to wait before retrying — set when status === "rate_limited"
   * and the upstream sent a parseable `Retry-After` header. */
  public retryAfterMs?: number;

  constructor(
    public readonly status: CallStatus,
    message: string,
    public readonly providerId?: ProviderId,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
