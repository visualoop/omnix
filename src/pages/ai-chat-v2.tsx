/**
 * AI chat panel v2 — the user-facing surface for the new agentic
 * harness. Wires:
 *   • Agent picker (Omnix Assistant / Read-only / Analyst)
 *   • Prompt input
 *   • Streaming assistant text
 *   • Live tool cards for every invocation (pending → running → done)
 *   • Approval dialog handled by the singleton ApprovalDialog mount
 *
 * Legacy /ai-workspace stays untouched; this is a separate route.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PaperPlaneRight as Send,
  Robot,
  User as UserIcon,
  Stop,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { ToolCard, type ToolCardState } from "@/components/ai/tool-card";
import { runAgent } from "@/services/ai/v2/runtime/agent-loop";
import { approvalBus } from "@/services/ai/v2/runtime/approval-bus";
import { listAgents } from "@/services/ai/v2/agents/definitions";
import type { RuntimeEvent, ChatMessage } from "@/services/ai/v2/runtime/types";
import { useAuthStore } from "@/stores/auth";
import "@/services/ai/v2";  // side-effect: register tools

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCards: Map<string, ToolCardState>;
}

export function AiChatV2Page() {
  const userId = useAuthStore((s) => s.user?.id ?? "system");
  const [agentId, setAgentId] = useState<string>("assistant");
  const [prompt, setPrompt] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const agents = useMemo(() => listAgents(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt("");
    setBusy(true);

    const userMsg: ChatEntry = { id: crypto.randomUUID(), role: "user", content: text, toolCards: new Map() };
    const assistantMsg: ChatEntry = { id: crypto.randomUUID(), role: "assistant", content: "", toolCards: new Map() };
    setEntries((prev) => [...prev, userMsg, assistantMsg]);

    const abort = new AbortController();
    abortRef.current = abort;

    // History for the runtime: prior user + assistant text
    const history: ChatMessage[] = entries.map((e) => ({
      role: e.role, content: e.content,
    }));

    const patchAssistant = (fn: (entry: ChatEntry) => ChatEntry) => {
      setEntries((prev) => prev.map((e) => (e.id === assistantMsg.id ? fn(e) : e)));
    };

    const onEvent = (evt: RuntimeEvent) => {
      if (evt.type === "text_delta") {
        patchAssistant((e) => ({ ...e, content: e.content + evt.delta }));
      } else if (evt.type === "tool_start") {
        patchAssistant((e) => {
          const next = new Map(e.toolCards);
          next.set(evt.callID, { status: "pending", label: evt.label, tier: evt.tier });
          return { ...e, toolCards: next };
        });
      } else if (evt.type === "tool_ask") {
        patchAssistant((e) => {
          const next = new Map(e.toolCards);
          const cur = next.get(evt.callID);
          if (cur) next.set(evt.callID, { status: "asking", label: cur.label, tier: cur.tier, summary: evt.summary });
          return { ...e, toolCards: next };
        });
      } else if (evt.type === "tool_answer") {
        patchAssistant((e) => {
          const next = new Map(e.toolCards);
          const cur = next.get(evt.callID);
          if (cur) {
            next.set(evt.callID, evt.approved
              ? { status: "running", label: cur.label, tier: cur.tier }
              : { status: "denied", label: cur.label, tier: cur.tier });
          }
          return { ...e, toolCards: next };
        });
      } else if (evt.type === "tool_done") {
        patchAssistant((e) => {
          const next = new Map(e.toolCards);
          const cur = next.get(evt.callID);
          if (cur) next.set(evt.callID, {
            status: "done", label: cur.label, tier: cur.tier,
            title: evt.result.title, output: evt.result.output,
          });
          return { ...e, toolCards: next };
        });
      } else if (evt.type === "tool_error") {
        patchAssistant((e) => {
          const next = new Map(e.toolCards);
          const cur = next.get(evt.callID);
          if (cur) next.set(evt.callID, { status: "error", label: cur.label, tier: cur.tier, error: evt.error });
          return { ...e, toolCards: next };
        });
      }
    };

    try {
      await runAgent({
        agent: agentId,
        prompt: text,
        history,
        userId,
        sessionID: "chat-v2",
        abort: abort.signal,
        onEvent,
        onAsk: (req) => approvalBus.request(req),
      });
    } catch (e) {
      patchAssistant((entry) => ({ ...entry, content: `${entry.content}\n\n_Error: ${e}_` }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [prompt, busy, agentId, entries, userId]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <PageHeader
        eyebrow="AI (v2)"
        title="Omnix Assistant"
        description="Agentic AI over your business data. Every write asks for approval before running."
        back={{ fallback: "/dashboard" }}
        actions={
          <Select value={agentId} onValueChange={(v) => setAgentId(String(v))}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agents.filter((a) => a.mode === "primary").map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex-1 overflow-y-auto border border-border rounded-md p-4 space-y-4 mt-4">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Robot className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Ask about sales, inventory, or start any create-flow.</p>
            <p className="text-xs mt-1">Every write asks first. Deny denies.</p>
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex gap-3">
              <div className="shrink-0">
                {e.role === "user" ? (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Robot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                {e.content && (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{e.content}</div>
                )}
                {[...e.toolCards.entries()].map(([callID, state]) => (
                  <ToolCard key={callID} state={state} />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything… (Ctrl+Enter to send)"
          rows={2}
          disabled={busy}
        />
        {busy ? (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>
            <Stop className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!prompt.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
