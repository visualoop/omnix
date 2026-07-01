/**
 * AI router — picks a provider+model for a feature, calls it, falls through
 * on rate-limit/5xx, and returns a normalized ChatResponse.
 *
 * All supported providers expose an OpenAI-compatible chat-completions
 * surface (Groq, OpenRouter, DeepSeek, OpenAI, Google AI Studio, Anthropic
 * via its OpenAI-compat shim, custom Ollama / vLLM endpoints). Differences:
 *   - Auth: most use `Authorization: Bearer`. Anthropic uses `x-api-key`
 *     + `anthropic-version` header — the OpenAI-compat shim accepts Bearer.
 *   - JSON-schema output: openai/groq/openrouter support; deepseek and
 *     google partially support; we degrade to text + JSON.parse on others.
 */
import { fetch } from "@tauri-apps/plugin-http";
import { listProviders, getFeature, loadSettings, setProviderRuntimeState } from "./config";
import { cacheKey, readCache, writeCache } from "./cache";
import { recordCall } from "./audit";
import { redactMessages } from "./redact";
import { getPromptBudget } from "./context-windows";
import { compressMessages } from "./compression";
import { MAX_RETRY_AFTER_MS, MAX_SAME_ROUTE_RETRIES, parseRetryAfter, sleep } from "./retry";
import { AiError, type ChatRequest, type ChatResponse, type AiProvider, type AiFeature, type InvokeOptions, type ProviderId, type TaskKind } from "./types";

interface OpenAIChoice {
  message: { role: string; content: string };
  finish_reason: string;
}
interface OpenAIChatResponse {
  choices: OpenAIChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

/** Map task_kind → which preferred_* field to use. */
function modelForTask(p: AiProvider, kind: TaskKind): string | null {
  if (kind === "vision") return p.preferred_vision_model;
  if (kind === "reasoning") return p.preferred_reasoning_model;
  return p.preferred_text_model;
}

/**
 * Per-provider fallback model chains. When the primary preferred model
 * returns 429 (rate-limited at the upstream/router level), we walk this
 * chain trying each alternate before falling out to the next provider.
 * Order: most-capable first, smaller/faster after.
 */
const FALLBACK_MODELS: Record<string, Partial<Record<TaskKind, string[]>>> = {
  openrouter: {
    text: [
      "openai/gpt-oss-20b:free",
      "google/gemma-4-26b-a4b-it:free",
      "qwen/qwen3-coder:free",
      "nvidia/nemotron-nano-9b-v2:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ],
    vision: [
      "meta-llama/llama-3.2-90b-vision-instruct:free",
      "nvidia/nemotron-nano-12b-v2-vl:free",
    ],
    reasoning: [
      "z-ai/glm-4.5-air:free",
      "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    ],
  },
  groq: {
    // Groq lineup as of 2026. mixtral-8x7b-32768 was decommissioned by
    // Groq (returned "model_decommissioned" 400 errors) — replaced with
    // openai/gpt-oss-120b (Groq-hosted) and groq/compound as fallbacks.
    // Order: primary → cheaper GPT-OSS → smaller instant model → compound.
    text: [
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.1-8b-instant",
      "groq/compound",
    ],
    vision: ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview"],
    reasoning: [
      "openai/gpt-oss-120b",
      "qwen-qwq-32b",
      "deepseek-r1-distill-llama-70b",
      "groq/compound",
    ],
  },
};

/** Build the ordered model list for a provider+task: primary, then fallbacks. */
function modelsForProviderTask(p: AiProvider, kind: TaskKind): string[] {
  const primary = modelForTask(p, kind);
  const fallbacks = FALLBACK_MODELS[p.id]?.[kind] ?? [];
  const out: string[] = [];
  if (primary) out.push(primary);
  for (const m of fallbacks) {
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/** Estimate USD cost from token counts using a rough per-million-token table. */
const COST_TABLE: Record<string, { in: number; out: number }> = {
  // Free tiers
  "llama-3.3-70b-versatile": { in: 0, out: 0 },
  "llama-3.2-90b-vision-preview": { in: 0, out: 0 },
  // OpenAI
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "o3-mini": { in: 1.1, out: 4.4 },
  // Anthropic
  "claude-3-5-haiku-20241022": { in: 0.8, out: 4 },
  "claude-3-5-sonnet-20241022": { in: 3, out: 15 },
  // DeepSeek
  "deepseek-chat": { in: 0.14, out: 0.28 },
  "deepseek-reasoner": { in: 0.55, out: 2.19 },
  // Google
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  // Free models: any model name ending in :free is zero
  if (model.endsWith(":free")) return 0;
  const row = COST_TABLE[model];
  if (!row) return 0; // unknown → 0 (we just don't know yet)
  return (tokensIn / 1_000_000) * row.in + (tokensOut / 1_000_000) * row.out;
}

interface ResolvedRoute {
  provider: AiProvider;
  model: string;
}

/** Build the candidate chain: matching provider+model pairs in priority order. */
async function resolveCandidates(feature: AiFeature, freeOnly: boolean): Promise<ResolvedRoute[]> {
  const all = await listProviders();
  const enabled = all.filter((p) => p.enabled && p.api_key_encrypted);
  const out: ResolvedRoute[] = [];

  // 1. Feature's preferred provider+model wins (if enabled).
  if (feature.preferred_provider && feature.preferred_model) {
    const p = enabled.find((q) => q.id === feature.preferred_provider);
    if (p) out.push({ provider: p, model: feature.preferred_model });
  }

  // 2. Walk every enabled provider, emitting one route per fallback model.
  //    `modelsForProviderTask` returns [primary, ...alternates] — when the
  //    primary 429s we automatically try the next free model on the same
  //    provider before giving up and crossing provider boundaries.
  for (const p of enabled) {
    if (p.rate_limited_until && new Date(p.rate_limited_until) > new Date()) continue;
    const models = modelsForProviderTask(p, feature.task_kind);
    for (const model of models) {
      if (freeOnly && !model.endsWith(":free") && !["groq", "google", "custom"].includes(p.id)) continue;
      if (out.some((r) => r.provider.id === p.id && r.model === model)) continue;
      out.push({ provider: p, model });
    }
  }
  return out;
}

async function callProvider(
  route: ResolvedRoute,
  request: ChatRequest,
): Promise<ChatResponse> {
  const start = performance.now();
  const url = `${route.provider.base_url.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${route.provider.api_key_encrypted ?? ""}`,
  };
  // OpenRouter wants Referer and X-Title
  if (route.provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://omnix.co.ke";
    headers["X-Title"] = "Omnix";
  }
  const body: Record<string, unknown> = {
    model: route.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? 1024,
  };
  if (request.jsonSchema) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    connectTimeout: 15_000,
  });
  const text = await res.text();
  const elapsed = Math.round(performance.now() - start);

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfterMs = parseRetryAfter(res.headers as unknown as { get: (n: string) => string | null });
      // Distinguish quota (daily/monthly cap hit — long cooldown needed)
      // from a transient rate limit. Groq puts "rate_limit_exceeded" in
      // its 429 error.type and OpenAI-compat providers echo that shape.
      const lowered = text.toLowerCase();
      const isQuota = /quota|daily limit|monthly.*limit|exhaust/.test(lowered);
      const err = new AiError(
        isQuota ? "quota_exceeded" : "rate_limited",
        `${route.provider.id}: ${isQuota ? "quota exceeded" : "rate-limited (429)"}`,
        route.provider.id,
      );
      if (retryAfterMs !== null) err.retryAfterMs = retryAfterMs;
      throw err;
    }
    // 4xx that means "this specific model is gone" — trigger intra-
    // provider walk to the next model in the same fallback chain.
    if (res.status === 400 || res.status === 404) {
      const lowered = text.toLowerCase();
      if (
        /model[_ ]decommission|deprecated|no longer supported|model[_ ]not[_ ]found|does not exist/.test(lowered)
      ) {
        throw new AiError(
          "model_gone",
          `${route.provider.id}: model ${route.model} is retired (${res.status}) — trying next model`,
          route.provider.id,
        );
      }
    }
    throw new AiError("error", `${route.provider.id}: HTTP ${res.status} — ${text.slice(0, 200)}`, route.provider.id);
  }

  let parsed: OpenAIChatResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("error", `${route.provider.id}: invalid JSON response`, route.provider.id);
  }
  // Some gateways (notably OpenRouter) return HTTP 200 even when the
  // upstream provider rate-limited — the body has `error.code === 429`
  // but no `choices`. Detect and surface that as a rate_limit so the
  // router falls through to the next candidate.
  const inlineErr = (parsed as unknown as { error?: { code?: number; message?: string } }).error;
  if (inlineErr && inlineErr.code === 429) {
    throw new AiError("rate_limited", `${route.provider.id}: upstream rate-limited (${inlineErr.message ?? "429"})`, route.provider.id);
  }
  if (inlineErr || !parsed.choices?.length) {
    throw new AiError("error", `${route.provider.id}: ${inlineErr?.message ?? "no choices in response"}`, route.provider.id);
  }
  const content = parsed.choices?.[0]?.message?.content ?? "";
  let json: unknown | null = null;
  if (request.jsonSchema) {
    try {
      json = JSON.parse(content);
    } catch {
      json = null;
    }
  }
  const tokensIn = parsed.usage?.prompt_tokens ?? 0;
  const tokensOut = parsed.usage?.completion_tokens ?? 0;
  return {
    text: content,
    json,
    provider: route.provider.id,
    model: parsed.model || route.model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: estimateCost(parsed.model || route.model, tokensIn, tokensOut),
    latency_ms: elapsed,
    cache_hit: false,
  };
}

/** Privacy guard: blocks high-tier features unless user opt-in. */
async function privacyAllows(feature: AiFeature, settings: { high_tier_optin: boolean }): Promise<boolean> {
  if (feature.privacy_tier !== "high") return true;
  return settings.high_tier_optin;
}

/**
 * Top-level invoke: resolve route, check cache, call provider chain, audit.
 */
export async function invoke(featureId: string, request: ChatRequest, opts: InvokeOptions = {}): Promise<ChatResponse> {
  const feature = await getFeature(featureId);
  if (!feature) throw new AiError("error", `Unknown feature ${featureId}`);
  if (!feature.enabled) throw new AiError("error", `Feature ${featureId} is disabled in settings`);

  const settings = await loadSettings();
  const privacyTier = opts.privacyTier ?? feature.privacy_tier;

  if (!(await privacyAllows({ ...feature, privacy_tier: privacyTier }, settings))) {
    await recordCall({
      featureId, providerId: "none", model: "", userId: null,
      request, response: null, privacyTier,
      status: "blocked_privacy",
      errorMessage: "Privacy tier requires opt-in",
    });
    throw new AiError("blocked_privacy", "AI access blocked by privacy settings — enable high-tier opt-in to use this feature");
  }

  // Redact prompt before doing anything
  const safe: ChatRequest = { ...request, messages: redactMessages(request.messages) };

  // Cache lookup (using first candidate model — we cache per-route for simplicity)
  const candidates = await resolveCandidates(feature, settings.free_models_only);
  if (candidates.length === 0) {
    await recordCall({
      featureId, providerId: "none", model: "", userId: null,
      request: safe, response: null, privacyTier,
      status: "no_provider",
      errorMessage: "No AI provider configured. Add an API key in Settings → AI.",
    });
    throw new AiError("no_provider", "No AI provider is configured. Add a key in Settings → AI.");
  }

  if (settings.cache_enabled && !opts.bypassCache) {
    const key = await cacheKey(candidates[0].model, safe);
    const hit = await readCache(key);
    if (hit) {
      await recordCall({
        featureId, providerId: hit.provider, model: hit.model, userId: null,
        request: safe, response: hit, privacyTier, status: "ok",
      });
      return hit;
    }
  }

  // Walk the chain
  let lastError: Error | null = null;
  for (const route of candidates) {
    let routeAttempts = 0;
    let nextSleepMs: number | null = null;
    // Retry the same route up to MAX_SAME_ROUTE_RETRIES times when the
    // provider returned 429 with a parseable, short Retry-After. Once
    // we exceed the budget or hit a non-rate-limit error we fall through
    // to the next candidate.
    while (true) {
      try {
        if (nextSleepMs !== null && nextSleepMs > 0) {
          await sleep(nextSleepMs);
          nextSleepMs = null;
        }
        // Compress to fit this provider/model's context window. We do it
        // per-candidate because different fallback models can have very
        // different budgets (e.g. an 8k free model vs a 128k paid one).
        const budget = getPromptBudget(route.provider.id, route.model, safe.maxTokens ?? 1024);
        const compressed = compressMessages(safe.messages, { budget });
        const compressedRequest: ChatRequest = compressed.compressed
          ? { ...safe, messages: compressed.messages }
          : safe;
        const response = await callProvider(route, compressedRequest);
        await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: null, lastError: null });
        if (settings.cache_enabled) {
          const key = await cacheKey(route.model, safe);
          await writeCache(key, featureId, response, settings.cache_ttl_days);
        }
        await recordCall({
          featureId, providerId: route.provider.id, model: route.model, userId: null,
          request: safe, response, privacyTier, status: "ok",
        });
        return response;
      } catch (e) {
        lastError = e as Error;
        const status = e instanceof AiError ? e.status : "error";

        if (status === "model_gone") {
          // Model retired by the provider — keep the provider warm and
          // walk to the next candidate route (which is either the next
          // model on the same provider, or a fallback provider). We
          // deliberately don't touch rateLimitedUntil.
          await setProviderRuntimeState(route.provider.id, {
            rateLimitedUntil: null,
            lastError: `Model ${route.model} retired — falling through`,
          });
          break;
        }

        if (status === "quota_exceeded") {
          // 24-hour cooldown for daily/monthly quota exhaustion. Groq's
          // free tier hits this. The router auto-recovers when the quota
          // window resets (typically midnight UTC).
          const cooldown = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await setProviderRuntimeState(route.provider.id, {
            rateLimitedUntil: cooldown,
            lastError: lastError.message,
          });
          break;
        }

        const isRateLimited = status === "rate_limited";
        if (isRateLimited) {
          const retryAfterMs = (e as AiError).retryAfterMs;
          // Same-route retry: honour short Retry-After only.
          if (
            retryAfterMs !== undefined &&
            retryAfterMs > 0 &&
            retryAfterMs <= MAX_RETRY_AFTER_MS &&
            routeAttempts < MAX_SAME_ROUTE_RETRIES
          ) {
            routeAttempts += 1;
            nextSleepMs = retryAfterMs;
            continue;
          }
          const cooldownMs = Math.max(retryAfterMs ?? 60_000, 60_000);
          const cooldown = new Date(Date.now() + cooldownMs).toISOString();
          await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: cooldown, lastError: lastError.message });
        } else {
          await setProviderRuntimeState(route.provider.id, { rateLimitedUntil: null, lastError: lastError.message });
        }
        break; // give up on this route — try the next candidate
      }
    }
  }

  await recordCall({
    featureId, providerId: "none", model: "", userId: null,
    request: safe, response: null, privacyTier,
    status: "error",
    errorMessage: lastError?.message ?? "All providers failed",
  });
  throw new AiError("error", lastError?.message ?? "All providers failed");
}

/** Public ping: dry-run a tiny request to check a provider is reachable. */
export async function pingProvider(id: ProviderId): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const all = await listProviders();
  const provider = all.find((p) => p.id === id);
  if (!provider) return { ok: false, latencyMs: 0, error: "provider not found" };
  if (!provider.api_key_encrypted) return { ok: false, latencyMs: 0, error: "no API key configured" };
  const model = provider.preferred_text_model;
  if (!model) return { ok: false, latencyMs: 0, error: "no preferred text model configured" };
  try {
    const t0 = performance.now();
    await callProvider(
      { provider, model },
      { messages: [{ role: "user", content: "ping" }], maxTokens: 1, temperature: 0 },
    );
    return { ok: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, latencyMs: 0, error: (e as Error).message };
  }
}
