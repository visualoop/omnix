/**
 * ToolCard — renders one tool invocation in the AI chat.
 *
 * States drive the visual:
 *   pending     — chip with spinner, "Preparing…"
 *   asking      — badge "Awaiting approval"
 *   running     — spinner, "Running…"
 *   done        — check mark, title from ToolResult
 *   error       — rose ring, error message
 *   cancelled   — muted, "Denied by user"
 */
import { CircleNotch as Loader2, CheckCircle, XCircle, Question } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ToolTier } from "@/services/ai/v2/tools/base";

export type ToolCardState =
  | { status: "pending"; label: string; tier: ToolTier }
  | { status: "asking"; label: string; tier: ToolTier; summary: string }
  | { status: "running"; label: string; tier: ToolTier }
  | { status: "done"; label: string; tier: ToolTier; title: string; output: string }
  | { status: "error"; label: string; tier: ToolTier; error: string }
  | { status: "denied"; label: string; tier: ToolTier };

const TIER_TONE: Record<ToolTier, string> = {
  read:        "border-emerald-500/40",
  write:       "border-amber-500/40",
  destructive: "border-rose-500/40",
};

export function ToolCard({ state }: { state: ToolCardState }) {
  const Icon =
    state.status === "done" ? CheckCircle :
    state.status === "error" ? XCircle :
    state.status === "asking" ? Question :
    Loader2;

  const iconCls =
    state.status === "done" ? "text-emerald-600" :
    state.status === "error" || state.status === "denied" ? "text-rose-600" :
    state.status === "asking" ? "text-amber-600" :
    "text-muted-foreground animate-spin";

  return (
    <div className={cn("rounded-md border-l-2 bg-card/40 p-2.5 space-y-1", TIER_TONE[state.tier])}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", iconCls)} />
        <span className="text-[12px] font-medium">{state.label}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {state.status}
        </span>
      </div>
      {state.status === "done" && (
        <div className="text-[12px] text-muted-foreground pl-5 whitespace-pre-wrap line-clamp-6">
          {state.output}
        </div>
      )}
      {state.status === "error" && (
        <div className="text-[12px] text-rose-600 pl-5">{state.error}</div>
      )}
      {state.status === "asking" && (
        <div className="text-[12px] text-muted-foreground pl-5">{state.summary}</div>
      )}
    </div>
  );
}
