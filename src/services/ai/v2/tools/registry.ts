/**
 * v2 Tool Registry — the single source of truth for AI tools.
 *
 * Tools are registered at module load. Agents ask the registry for their
 * available tools; the registry filters by permission tier rules.
 *
 * Mirrors opencode's `tool/registry.ts` structure but uses plain Maps
 * instead of Effect services since we don't have Effect-TS.
 */
import type { ToolDef, ToolTier } from "./base";

const tools = new Map<string, ToolDef<unknown, unknown>>();

/**
 * Register a tool. Throws if a tool with the same id already exists —
 * duplicate registration is always a bug, never an intended re-register.
 */
export function register<Input, Meta>(tool: ToolDef<Input, Meta>): void {
  if (tools.has(tool.id)) {
    throw new Error(`Tool "${tool.id}" already registered`);
  }
  tools.set(tool.id, tool as ToolDef<unknown, unknown>);
}

/** Look up a single tool by id, or return null. */
export function getTool(id: string): ToolDef<unknown, unknown> | null {
  return tools.get(id) ?? null;
}

/** Every registered tool. Useful for building the OpenAI-style tool schema list. */
export function listTools(): ToolDef<unknown, unknown>[] {
  return [...tools.values()];
}

/**
 * Filter the registry by a permission ruleset — the model of what tools
 * an agent should see. If any tier is `deny`, its tools are excluded from
 * the list even though they exist in the registry.
 *
 * Wildcard-style tool ids on rules aren't supported yet; a tool's tier
 * is what matters. Per-tool overrides can be added later.
 */
export interface PermissionRule {
  tier: ToolTier;
  toolId?: string;
  action: "allow" | "ask" | "deny";
}

export function toolsForAgent(rules: PermissionRule[], toolAllowlist?: string[] | "*"): ToolDef<unknown, unknown>[] {
  const denyTiers = new Set<ToolTier>();
  for (const r of rules) {
    if (r.action === "deny" && !r.toolId) denyTiers.add(r.tier);
  }
  const denyIds = new Set<string>();
  for (const r of rules) {
    if (r.action === "deny" && r.toolId) denyIds.add(r.toolId);
  }
  const allowed = toolAllowlist === "*" || toolAllowlist === undefined
    ? null
    : new Set(toolAllowlist);
  return listTools().filter((t) => {
    if (denyTiers.has(t.tier)) return false;
    if (denyIds.has(t.id)) return false;
    if (allowed && !allowed.has(t.id)) return false;
    return true;
  });
}

/**
 * For unit tests only. Never call in production; a bare-bones app never
 * needs to reset the registry.
 */
export function _resetRegistry(): void {
  tools.clear();
}
