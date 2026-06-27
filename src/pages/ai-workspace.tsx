/**
 * Omnix AI Workspace (/ai) — the full-page home for the business assistant.
 *
 * Where the side panel is a quick concierge, this is the place to actually
 * work with your data: a roomy chat that can answer questions and propose
 * confirmed actions, plus a live "Needs attention" feed from the deterministic
 * insight engine. Everything reuses the existing AI stack (streamInvoke +
 * tools + the action dialog) so it stays grounded in live data and respects
 * the same privacy/permission rules.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkle as Sparkles, ArrowUp, CircleNotch as Loader2, ArrowRight,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { useActiveBranch } from "@/stores/active-branch";
import { streamInvoke, AiError, type ChatMessage } from "@/services/ai";
import { buildSystemPrompt } from "@/services/ai/system-prompt";
import { VARIANT } from "@/lib/variant";
import { buildAssistantTools } from "@/services/ai/tools";
import { topFindings, type Finding } from "@/services/insights";
import { AssistantMarkdown } from "@/components/ai/AssistantMarkdown";
import { ToolCallBlock, type ToolEvent } from "@/components/ai/ToolCallBlock";
import { AiActionDialog } from "@/components/ai/AiActionDialog";
import type { ActionProposal } from "@/services/ai/actions";
import { toast } from "sonner";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
}

const PROMPTS = [
  "What should I focus on this week?",
  "What made the most profit this month?",
  "What should I reorder, and how much?",
  "Which customers have stopped buying?",
  "Why did revenue change this week?",
  "Which products are priced below cost?",
  "Which supplier is most reliable?",
  "What stock is expiring soon?",
];

const SEV_DOT: Record<Finding["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-muted-foreground/40",
};

export function AiWorkspacePage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionProposal | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeModule = useActiveModule((s) => s.active);
  const branch = useActiveBranch((s) => s.active);

  const tools = useMemo(() => buildAssistantTools({ navigate: (r: string) => navigate(r) }), [navigate]);

  useEffect(() => { topFindings().then(setFindings).catch(() => setFindings([])); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);

    const system = buildSystemPrompt({
      userName: user?.full_name ?? user?.username ?? null,
      activeModule,
      currentRoute: "/ai",
      branchName: branch?.name ?? null,
      variant: VARIANT,
    });
    const history: ChatMessage[] = [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
      { role: "user", content: text },
    ];

    const toolEvents: ToolEvent[] = [];
    try {
      for await (const progress of streamInvoke("assistant_chat", history, { tools, maxSteps: 6 })) {
        if (progress.toolCall) {
          toolEvents.push({ id: progress.toolCall.id, name: progress.toolCall.name, args: progress.toolCall.args });
          setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, toolEvents: [...toolEvents] } : msg)));
          continue;
        }
        if (progress.toolResult) {
          const idx = toolEvents.findIndex((e) => e.id === progress.toolResult!.id);
          if (idx >= 0) toolEvents[idx] = { ...toolEvents[idx], result: progress.toolResult.result };
          const res = progress.toolResult.result as { __actionProposal?: ActionProposal } | null;
          if (res && typeof res === "object" && res.__actionProposal) setPendingAction(res.__actionProposal);
          setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, toolEvents: [...toolEvents] } : msg)));
          continue;
        }
        setMessages((m) =>
          m.map((msg) => (msg.id === assistantId ? { ...msg, content: progress.text, streaming: !progress.done } : msg)),
        );
      }
    } catch (e) {
      if (e instanceof AiError && e.status === "no_provider") {
        toast.error("AI not configured", {
          description: "Add a key in Settings → AI to use the workspace.",
          action: { label: "Open settings", onClick: () => navigate("/settings/ai") },
        });
      } else {
        toast.error("Assistant failed", { description: (e as Error).message });
      }
      setMessages((m) => m.filter((msg) => msg.id !== assistantId));
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [messages, busy, user, activeModule, branch, tools, navigate]);

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6">
      {/* ── Chat column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-6 h-14 flex items-center gap-2 border-b border-border shrink-0">
          <div className="rounded-full bg-primary/10 p-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Omnix AI</div>
            <div className="text-[11px] text-muted-foreground">Ask your data · get recommendations · take confirmed actions</div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {empty ? (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-semibold tracking-tight">How can I help run the business?</h1>
              <p className="text-sm text-muted-foreground mt-2">
                I answer from your live data — sales, stock, customers, suppliers — and can
                prepare actions for you to approve. Try one:
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-5">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="text-left text-sm rounded-lg border border-border px-3.5 py-3 hover:bg-accent/40 transition-colors cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-col gap-1"}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {m.role === "user" ? "You" : "Omnix"}
                  </div>
                  <div className={m.role === "user"
                    ? "rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2.5 text-sm whitespace-pre-wrap max-w-[92%]"
                    : "text-sm leading-relaxed flex flex-col gap-2 max-w-full"}>
                    {m.role === "user" ? m.content : (
                      <>
                        {m.toolEvents && m.toolEvents.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {m.toolEvents.map((ev) => (
                              <ToolCallBlock key={ev.id} event={ev} busy={ev.result === undefined} />
                            ))}
                          </div>
                        )}
                        {m.content && <AssistantMarkdown source={m.content} />}
                        {m.streaming && <span className="inline-block w-1.5 h-3.5 align-middle bg-primary animate-pulse rounded-sm" />}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 shrink-0">
          <div className="max-w-2xl mx-auto relative rounded-2xl border border-border focus-within:border-primary/50 transition-colors">
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
              placeholder="Ask about sales, stock, customers, suppliers…"
              rows={1}
              disabled={busy}
              className="w-full resize-none bg-transparent border-0 px-4 py-3 pr-12 text-sm focus-visible:ring-0 max-h-40"
              style={{ height: "auto", minHeight: "48px" }}
              onInput={(e) => { const ta = e.currentTarget; ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }}
            />
            <Button
              size="sm"
              onClick={() => send(draft)}
              disabled={busy || !draft.trim()}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full p-0 cursor-pointer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="max-w-2xl mx-auto text-[10px] text-muted-foreground mt-2 px-1">
            Grounded in your live data · actions need your approval · AI may make mistakes
          </p>
        </div>
      </div>

      {/* ── Insights rail ───────────────────────────────────────── */}
      <aside className="hidden lg:flex w-80 xl:w-96 flex-col border-l border-border shrink-0">
        <header className="px-5 h-14 flex items-center border-b border-border shrink-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {findings === null ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged right now. The business looks healthy.</p>
          ) : (
            findings.map((f, i) => (
              <div key={`${f.kind}-${i}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEV_DOT[f.severity]}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">{f.headline}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{f.detail}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => send(`About this: "${f.headline}". Why does it matter and what should I do?`)}
                        className="text-[11px] text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" /> Ask
                      </button>
                      {f.route && (
                        <button
                          type="button"
                          onClick={() => navigate(f.route!)}
                          className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <AiActionDialog
        proposal={pendingAction}
        onClose={() => setPendingAction(null)}
        onApplied={(route) => { if (route) navigate(route); }}
      />
    </div>
  );
}
