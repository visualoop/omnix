/**
 * v2 Tool base — the shape every AI tool exports.
 *
 * Modelled after opencode's `tool/tool.ts`, adapted to our stack:
 *   - Zod for schemas instead of Effect.Schema
 *   - Plain async functions instead of Effect.gen
 *   - Callback-based progress + permission asks (no Effect fibers)
 *
 * A ToolDef is a pure record. The registry (registry.ts) holds them by
 * id and filters them per-agent based on the agent's permission tier
 * rules.
 *
 * See docs/plans/v0.41.x-ai-harness-v2.md for the full design.
 */
import { z } from "zod";

/**
 * Tier tags decide what the agent + user must approve before running.
 * - `read`         — safe queries. Auto-allowed for all agents.
 * - `write`        — creates or edits data. Requires user approval unless
 *                    agent's permission rule says otherwise.
 * - `destructive`  — deletes / voids / cascades. Always asks with warning
 *                    styling.
 */
export type ToolTier = "read" | "write" | "destructive";

export interface ToolUiMeta {
  /** Short label for the tool-run card. */
  label: string;
  /** Optional Phosphor icon name. */
  icon?: string;
}

/**
 * The context every tool receives.
 *
 * `update` streams progress back to the UI card ("Fetching 500 rows…").
 * `ask` requests explicit user approval — returns { approved } once the
 * user answers via the approval dialog.
 */
export interface ToolContext {
  sessionID: string;
  userId: string;
  branchId?: string;
  abort: AbortSignal;
  update(fragment: { title?: string; metadata?: Record<string, unknown> }): void;
  ask(request: {
    tool: string;
    summary: string;
    detail?: string;
    tier: ToolTier;
  }): Promise<{ approved: boolean }>;
}

/**
 * A tool must return a ToolResult. `output` is the string fed back into
 * the LLM's context. `metadata` is arbitrary structured data that we
 * store alongside the tool card for later inspection (used by charts,
 * summaries, etc). `title` renders on the tool card header.
 */
export interface ToolResult<Meta = unknown> {
  title: string;
  output: string;
  metadata: Meta;
}

/**
 * Concrete tool definition. Registered via `ToolRegistry.register()`.
 */
export interface ToolDef<Input = unknown, Meta = unknown> {
  id: string;
  description: string;
  parameters: z.ZodType<Input>;
  tier: ToolTier;
  ui: ToolUiMeta;
  execute(args: Input, ctx: ToolContext): Promise<ToolResult<Meta>>;
}

/**
 * Convenience: build a `ToolDef` with correct type inference from a
 * zod schema.
 */
export function defineTool<Input, Meta = unknown>(def: ToolDef<Input, Meta>): ToolDef<Input, Meta> {
  return def;
}

/**
 * Common error result — every tool wraps failures in this so the LLM
 * gets a machine-readable "did not work" instead of a crashed session.
 */
export function toolError(tool: string, message: string): ToolResult<{ error: string }> {
  return {
    title: `${tool} failed`,
    output: `Error: ${message}`,
    metadata: { error: message },
  };
}
