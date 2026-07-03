/**
 * Runtime types — shared across agent-loop, session, tool-cards.
 *
 * The runtime emits a stream of RuntimeEvent objects. UI components
 * subscribe and render:
 *   • assistant text chunks
 *   • tool invocations (pending / running / done / error)
 *   • agent iteration markers
 *   • final answer
 */
import type { ToolResult, ToolTier } from "../tools/base";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /** Present on assistant messages that included reasoning content. */
  reasoning?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export type RuntimeEvent =
  | { type: "iteration"; n: number }
  | { type: "text_delta"; delta: string }
  | { type: "text_end"; text: string }
  | { type: "tool_start"; callID: string; tool: string; args: unknown; tier: ToolTier; label: string }
  | { type: "tool_ask"; callID: string; tool: string; summary: string; detail?: string }
  | { type: "tool_answer"; callID: string; approved: boolean }
  | { type: "tool_done"; callID: string; result: ToolResult }
  | { type: "tool_error"; callID: string; error: string }
  | { type: "done"; messages: ChatMessage[] }
  | { type: "error"; error: string };

export interface RuntimeInput {
  agent: string;                          // agent id
  prompt: string;
  history?: ChatMessage[];
  userId: string;
  sessionID: string;
  branchId?: string;
  abort?: AbortSignal;
  /** Called for every runtime event. */
  onEvent: (evt: RuntimeEvent) => void;
  /** Approval callback (async). Runtime awaits the returned Promise. */
  onAsk: (request: {
    tool: string;
    summary: string;
    detail?: string;
    tier: ToolTier;
  }) => Promise<{ approved: boolean }>;
}

export interface RuntimeResult {
  messages: ChatMessage[];
  iterations: number;
  toolCallCount: number;
  toolErrorCount: number;
}

/** Hard cap so a rogue model can't loop forever. */
export const MAX_ITERATIONS = 12;
