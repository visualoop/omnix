/**
 * task — spawn a subagent for a self-contained analysis task.
 *
 * Modelled after opencode's TaskTool. The primary agent describes what
 * it wants ("draft a report on our top 10 slowest-moving SKUs") and
 * the analyst subagent runs its own agent loop with read-only tools,
 * returning the final report as this tool's output.
 *
 * Approval: this tool is `write` tier because it consumes tokens +
 * runs its own tool calls. The main-agent policy asks once per session.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineTool, toolError } from "../base";
import type { RuntimeEvent } from "../../runtime/types";

const params = z.object({
  description: z.string().min(4).max(200).describe("Short label for the sub-task (e.g. 'Slowest SKUs report')"),
  prompt: z.string().min(4).max(4000).describe("Full prompt to hand to the analyst subagent"),
  agent: z.enum(["analyst"]).default("analyst").describe("Which subagent to spawn"),
});

register(defineTool<z.infer<typeof params>, { iterations: number; toolCallCount: number }>({
  id: "task",
  description: "Delegate a deep-dive task to a specialised subagent. Returns the subagent's final answer.",
  parameters: params,
  tier: "write",   // consumes tokens + runs child tools
  ui: { label: "Sub-agent task", icon: "Robot" },
  async execute(args, ctx) {
    // Dynamic import to break the runtime <-> tools <-> runtime cycle
    const { runAgent } = await import("../../runtime/agent-loop");
    let text = "";
    let iterations = 0;
    let toolCallCount = 0;
    try {
      const result = await runAgent({
        agent: args.agent,
        prompt: args.prompt,
        userId: ctx.userId,
        sessionID: `${ctx.sessionID}:sub:${Date.now()}`,
        branchId: ctx.branchId,
        onEvent: (evt: RuntimeEvent) => {
          if (evt.type === "text_delta") text += evt.delta;
          if (evt.type === "tool_start") toolCallCount++;
          if (evt.type === "iteration") iterations = Math.max(iterations, evt.n);
        },
        // Sub-agents inherit the parent's approval channel — writes still ask
        // the user, but analyst subagent has permission ruleset that denies
        // all writes anyway so it should never hit onAsk.
        onAsk: ctx.ask,
      });
      // The runtime already appends the assistant's reply to messages
      if (!text && result.messages.length) {
        const last = result.messages[result.messages.length - 1];
        if (typeof last.content === "string") text = last.content;
      }
      return {
        title: `Sub-agent: ${args.description}`,
        output: text || "(no output)",
        metadata: { iterations, toolCallCount },
      };
    } catch (e) {
      return toolError("task", String(e)) as any;
    }
  },
}));
