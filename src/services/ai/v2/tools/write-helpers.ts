/**
 * Helper to define write-tier tools with the standard approval flow.
 *
 * Every write tool follows the same lifecycle:
 *   1. Prompt for approval with a human-readable summary.
 *   2. If approved, run the mutation and format the result.
 *   3. If rejected or the mutation throws, return an error result.
 *
 * `defineWrite` reduces boilerplate so a tool file focuses on the
 * schema + summary + mutation body.
 */
import { z } from "zod";
import type { ToolContext, ToolResult, ToolTier } from "./base";
import { defineTool, toolError, type ToolDef } from "./base";

export interface WriteToolSpec<Input, Meta> {
  id: string;
  description: string;
  parameters: z.ZodType<Input>;
  tier?: Extract<ToolTier, "write" | "destructive">;
  ui: { label: string; icon?: string };
  /** Human-readable summary line for the approval dialog. */
  summary(args: Input): string;
  /** Optional multi-line detail rendered below the summary. */
  detail?(args: Input): string;
  /** Actual mutation. Throw to signal failure — caught by the helper. */
  run(args: Input, ctx: ToolContext): Promise<ToolResult<Meta>>;
}

export function defineWrite<Input, Meta = { id?: string }>(spec: WriteToolSpec<Input, Meta>): ToolDef<Input, Meta> {
  return defineTool<Input, Meta>({
    id: spec.id,
    description: spec.description,
    parameters: spec.parameters,
    tier: spec.tier ?? "write",
    ui: spec.ui,
    async execute(args, ctx) {
      const { approved } = await ctx.ask({
        tool: spec.id,
        tier: spec.tier ?? "write",
        summary: spec.summary(args),
        detail: spec.detail?.(args),
      });
      if (!approved) return toolError(spec.id, "User rejected") as unknown as ToolResult<Meta>;
      try {
        return await spec.run(args, ctx);
      } catch (e) {
        return toolError(spec.id, String(e)) as unknown as ToolResult<Meta>;
      }
    },
  });
}
