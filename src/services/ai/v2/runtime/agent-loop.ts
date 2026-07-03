/**
 * runAgent — the multi-turn agent loop.
 *
 * Rather than reimplement the LLM streaming + tool orchestration, we
 * lean on the existing `streamInvoke` from services/ai/stream.ts which
 * already runs `streamText` from Vercel AI SDK with `stopWhen` +
 * `stepCountIs` for multi-step tool calling.
 *
 * Our job here is:
 *   1. Take an AgentDef, look up its tools from the v2 registry
 *   2. Convert each ToolDef to a Vercel-SDK `tool()` — wrapping execute
 *      so it goes through our permission engine + emits runtime events
 *   3. Invoke streamInvoke and map its progress events to RuntimeEvent
 *   4. Aggregate the final messages
 *
 * Approvals: write / destructive tools are wrapped so they ask the
 * caller (via input.onAsk) before executing. Approvals are cached per
 * (session, tool, args-hash) so the same request within a session isn't
 * asked twice.
 */
import { tool } from "ai";
import { streamInvoke } from "@/services/ai/stream";
import { toolsForAgent, type PermissionRule } from "../tools/registry";
import type { ToolContext, ToolDef, ToolResult } from "../tools/base";
import { getAgent } from "../agents/definitions";
import {
  type RuntimeEvent, type RuntimeInput, type RuntimeResult,
  type ChatMessage, MAX_ITERATIONS,
} from "./types";

// Simple deterministic hash for approval de-dupe within a session
function hashArgs(args: unknown): string {
  return JSON.stringify(args);
}

/**
 * Turn our ToolDef into a Vercel AI SDK tool. Wrap execute so it emits
 * runtime events + asks for approval when tier requires it.
 */
function toAiSdkTool(
  def: ToolDef<unknown, unknown>,
  rules: PermissionRule[],
  ctx: ToolContext,
  emit: (evt: RuntimeEvent) => void,
  approvedCache: Set<string>,
) {
  const action = pickAction(def, rules);
  return tool({
    description: def.description,
    // Vercel v6 expects zod schema at `.inputSchema`
    inputSchema: def.parameters as unknown as import("ai").Tool["inputSchema"],
    async execute(rawArgs, { toolCallId }) {
      const args = rawArgs as unknown;
      emit({
        type: "tool_start",
        callID: toolCallId,
        tool: def.id,
        args,
        tier: def.tier,
        label: def.ui.label,
      });
      if (action === "deny") {
        emit({ type: "tool_error", callID: toolCallId, error: "Denied by agent policy" });
        return { title: "Denied", output: "Denied by agent policy", metadata: {} } satisfies ToolResult;
      }
      if (action === "ask") {
        const key = `${def.id}::${hashArgs(args)}`;
        let approved = approvedCache.has(key);
        if (!approved) {
          emit({
            type: "tool_ask",
            callID: toolCallId,
            tool: def.id,
            summary: renderSummary(def, args),
          });
          const answer = await ctx.ask({ tool: def.id, tier: def.tier, summary: renderSummary(def, args) });
          approved = answer.approved;
          emit({ type: "tool_answer", callID: toolCallId, approved });
          if (approved) approvedCache.add(key);
        }
        if (!approved) {
          const result: ToolResult = { title: "Cancelled", output: "User denied this action", metadata: {} };
          emit({ type: "tool_done", callID: toolCallId, result });
          return result;
        }
      }
      try {
        const parsed = def.parameters.safeParse(args);
        if (!parsed.success) {
          const err = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          emit({ type: "tool_error", callID: toolCallId, error: err });
          return { title: "Invalid arguments", output: err, metadata: { error: err } } satisfies ToolResult;
        }
        const result = await def.execute(parsed.data, ctx);
        emit({ type: "tool_done", callID: toolCallId, result });
        return result;
      } catch (e) {
        const err = String(e);
        emit({ type: "tool_error", callID: toolCallId, error: err });
        return { title: `${def.id} failed`, output: err, metadata: { error: err } } satisfies ToolResult;
      }
    },
  });
}

function pickAction(def: ToolDef<unknown, unknown>, rules: PermissionRule[]): "allow" | "ask" | "deny" {
  const specific = rules.find((r) => r.toolId === def.id);
  if (specific) return specific.action;
  const generic = rules.find((r) => r.tier === def.tier && !r.toolId);
  return generic?.action ?? "deny";
}

function renderSummary(def: ToolDef<unknown, unknown>, args: unknown): string {
  const argsPreview = typeof args === "object" && args
    ? Object.entries(args as Record<string, unknown>)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`)
        .join(", ")
    : String(args);
  return `${def.ui.label}: ${argsPreview}`;
}

export async function runAgent(input: RuntimeInput): Promise<RuntimeResult> {
  const agent = getAgent(input.agent);
  const tools = toolsForAgent(agent.permission, agent.tools);

  // Build the tool bundle for Vercel AI SDK
  const approvedCache = new Set<string>();
  const ctx: ToolContext = {
    sessionID: input.sessionID,
    userId: input.userId,
    branchId: input.branchId,
    abort: input.abort ?? new AbortController().signal,
    update: () => { /* runtime events cover this; no-op here */ },
    ask: async (req) => input.onAsk(req),
  };
  const toolBundle: Record<string, ReturnType<typeof tool>> = {};
  for (const t of tools) {
    toolBundle[t.id] = toAiSdkTool(t, agent.permission, ctx, input.onEvent, approvedCache) as unknown as ReturnType<typeof tool>;
  }

  // Assemble the message list
  const history = input.history ?? [];
  const messages = [
    { role: "system" as const, content: agent.systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
    { role: "user" as const, content: input.prompt },
  ];

  // Run streamInvoke — it handles the multi-step loop
  let toolCallCount = 0;
  let toolErrorCount = 0;
  let acc = "";
  let iterations = 1;
  input.onEvent({ type: "iteration", n: iterations });

  try {
    const stream = streamInvoke("assistant", messages, {
      tools: toolBundle as import("ai").ToolSet,
      maxSteps: MAX_ITERATIONS,
    });
    for await (const progress of stream) {
      // Vercel's streamText internally advances "steps" for each round of
      // tool calls. We can't cleanly count those from the outside, but
      // we can approximate by counting the incoming toolCall events.
      if (progress.toolCall) {
        toolCallCount++;
      }
      if (progress.delta) {
        acc = progress.text;
        input.onEvent({ type: "text_delta", delta: progress.delta });
      }
      if (progress.done) {
        input.onEvent({ type: "text_end", text: acc });
      }
    }
  } catch (e) {
    input.onEvent({ type: "error", error: String(e) });
    throw e;
  }

  const finalMessages: ChatMessage[] = [
    ...history,
    { role: "user", content: input.prompt },
    { role: "assistant", content: acc },
  ];
  input.onEvent({ type: "done", messages: finalMessages });

  return { messages: finalMessages, iterations, toolCallCount, toolErrorCount };
}
