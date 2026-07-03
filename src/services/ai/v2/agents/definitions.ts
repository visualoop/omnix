/**
 * Agent definitions — every AI persona the app exposes.
 *
 * An AgentDef combines: (a) a system prompt, (b) a tool allowlist,
 * (c) permission rules that decide which tiers require approval.
 *
 * Ship with three:
 *   • assistant   — full-access with approvals for writes/destructive
 *   • read-only   — pure exploration, no writes
 *   • analyst     — subagent for deep reports (read-only, invoked by other agents)
 */
import type { PermissionRule } from "../tools/registry";

export type AgentMode = "primary" | "subagent";

export interface AgentDef {
  id: string;
  name: string;
  description: string;
  mode: AgentMode;
  systemPrompt: string;
  /** Tool ids the agent can see. "*" = every registered tool. */
  tools: string[] | "*";
  permission: PermissionRule[];
  /** Optional model override. Otherwise the app's default model runs. */
  model?: { provider: string; model: string };
}

const BASE_PROMPT = `You are Omnix, an AI operations assistant for a Kenyan small business. You have access to tools that read + write the business database.

Rules:
1. Never guess at data — call a tool to find out. Prefer specific tools (find_product, find_customer) over broad queries.
2. Every write tool asks the user for approval before executing. Explain WHY you want to run it so the user can decide.
3. When you finish, summarise what happened in one sentence.
4. Currency is Kenyan Shillings (KES). Format as "KES 1,234.50".
5. Never invent product IDs, customer IDs, or SKUs — always search first.`;

export const AGENTS: AgentDef[] = [
  {
    id: "assistant",
    name: "Omnix Assistant",
    description: "General-purpose agent with full read access and approved writes.",
    mode: "primary",
    tools: "*",
    permission: [
      { tier: "read",        action: "allow" },
      { tier: "write",       action: "ask" },
      { tier: "destructive", action: "ask" },
    ],
    systemPrompt: `${BASE_PROMPT}

You can create products, customers, suppliers, quotations, prescriptions, and more. Never delete data — that's not exposed as a tool.`,
  },
  {
    id: "read-only",
    name: "Read-only",
    description: "Explore + report. No writes.",
    mode: "primary",
    tools: "*",
    permission: [
      { tier: "read",        action: "allow" },
      { tier: "write",       action: "deny" },
      { tier: "destructive", action: "deny" },
    ],
    systemPrompt: `${BASE_PROMPT}

You are in READ-ONLY mode. Any tool that would modify data is unavailable to you. Focus on lookups, reports, and analysis.`,
  },
  {
    id: "analyst",
    name: "Analyst (subagent)",
    description: "Deep-dive analysis + long-form reports. Invoked by primary agents.",
    mode: "subagent",
    tools: ["get_low_stock", "get_expiring", "recent_sales", "find_product", "find_customer"],
    permission: [
      { tier: "read",        action: "allow" },
      { tier: "write",       action: "deny" },
      { tier: "destructive", action: "deny" },
    ],
    systemPrompt: `You are an analyst subagent for Omnix. Your job is a single deep-dive report: gather data via the read tools, then produce a structured markdown answer. Be thorough but concise. No writes.`,
  },
];

const byId = new Map(AGENTS.map((a) => [a.id, a]));

export function getAgent(id: string): AgentDef {
  const a = byId.get(id);
  if (!a) throw new Error(`Unknown agent: ${id}`);
  return a;
}

export function listAgents(): AgentDef[] {
  return [...AGENTS];
}
