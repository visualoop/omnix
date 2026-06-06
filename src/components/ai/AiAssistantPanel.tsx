/**
 * Omnix AI Assistant — slide-out chat panel.
 *
 * Layout: fixed right edge, full viewport height, w-1/4 (25% width) on
 * desktop, w-full on mobile. Toggleable via the bottom-right ✨ button or
 * Cmd/Ctrl+J shortcut. Auto-opens once on first launch (per device) so
 * the user discovers the feature.
 *
 * Streaming: token-by-token via streamInvoke. Multi-turn memory in-session.
 * Input clears on submit. Auto-scroll to bottom on new tokens.
 *
 * Design: liquid-glass thick panel with rounded-glass corners, subtle
 * inset border, no card-on-card. Messages are rendered inline (no avatar
 * bubbles) — we lean on left-margin indent + role-tinted accent line for
 * readability.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useActiveModule } from "@/stores/active-module";
import { useActiveBranch } from "@/stores/active-branch";
import { streamInvoke, AiError, type ChatMessage } from "@/services/ai";
import { buildSystemPrompt } from "@/services/ai/system-prompt";
import { toast } from "sonner";

type Role = "user" | "assistant" | "system";

interface UiMessage {
  id: string;
  role: Role;
  content: string;
  /** True while the assistant is still streaming this message. */
  streaming?: boolean;
}

const STARTERS = [
  "How do I run a Z-report?",
  "Explain my last eTIMS error",
  "What's the difference between modules?",
];

const HAS_OPENED_KEY = "omnix-assistant-has-opened";

export function AiAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const activeModule = useActiveModule((s) => s.active);
  const branch = useActiveBranch((s) => s.active);

  // Auto-open on first ever launch
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(HAS_OPENED_KEY) === "1") return;
    const t = setTimeout(() => {
      setOpen(true);
      localStorage.setItem(HAS_OPENED_KEY, "1");
    }, 1500);
    return () => clearTimeout(t);
  }, [user]);

  // Cmd/Ctrl+J shortcut
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: text };
      const assistantId = crypto.randomUUID();
      const assistantMsg: UiMessage = { id: assistantId, role: "assistant", content: "", streaming: true };
      setMessages((m) => [...m, userMsg, assistantMsg]);
      setDraft("");
      setBusy(true);

      const system = buildSystemPrompt({
        userName: user?.full_name ?? user?.username ?? null,
        activeModule,
        currentRoute: location.pathname,
        branchName: branch?.name ?? null,
      });

      // Build conversation history for the LLM
      const history: ChatMessage[] = [
        { role: "system", content: system },
        ...messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: "user", content: text },
      ];

      try {
        for await (const progress of streamInvoke("assistant_chat", history)) {
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: progress.text, streaming: !progress.done } : msg)),
          );
        }
      } catch (e) {
        if (e instanceof AiError && e.status === "no_provider") {
          toast.error("AI not configured", {
            description: "Add a key in Settings → AI to enable the assistant.",
            action: { label: "Open settings", onClick: () => { window.location.hash = "#/settings/ai"; } },
          });
        } else if (e instanceof AiError && e.status === "blocked_privacy") {
          toast.error("Blocked by privacy settings", { description: e.message });
        } else {
          toast.error("Assistant failed", { description: (e as Error).message });
        }
        setMessages((m) => m.filter((msg) => msg.id !== assistantId));
      } finally {
        setBusy(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [messages, busy, user, activeModule, location.pathname, branch],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <>
      {/* Trigger button — bottom-right, hides when panel open */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Omnix assistant (⌘J)"
          className={cn(
            "fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-xl transition-all cursor-pointer",
            "flex items-center justify-center",
            "bg-primary text-primary-foreground hover:scale-110 ring-1 ring-inset ring-primary/30",
          )}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {/* Panel — slide-in from right */}
      {open && (
        <aside
          className={cn(
            "fixed top-0 right-0 z-40 h-screen flex flex-col",
            "w-full sm:w-[420px] lg:w-1/4 lg:min-w-[420px]",
            "glass-thick border-l border-border shadow-2xl",
            "animate-in slide-in-from-right-4 duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-[56px] border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="glass rounded-full p-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Omnix Assistant</div>
                <div className="text-[10px] text-muted-foreground">⌘J to toggle</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {messages.length === 0 ? (
              <WelcomeBlock onPick={send} />
            ) : (
              messages.map((m) => <MessageView key={m.id} message={m} />)
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-3 shrink-0">
            <div className="relative glass-thin rounded-2xl">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Omnix anything…"
                rows={1}
                disabled={busy}
                className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none max-h-32"
                style={{
                  height: "auto",
                  minHeight: "44px",
                }}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = "auto";
                  ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
                }}
              />
              <Button
                size="sm"
                onClick={() => send(draft)}
                disabled={busy || !draft.trim()}
                className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full p-0 cursor-pointer"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 px-1">
              Enter to send · Shift+Enter for newline · AI may make mistakes
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

function WelcomeBlock({ onPick }: { onPick: (text: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const first = user?.full_name?.split(" ")[0] || user?.username || "there";
  const h = new Date().getHours();
  const greeting =
    h < 5 ? "Habari za usiku" : h < 12 ? "Habari za asubuhi" : h < 16 ? "Habari za mchana" : h < 19 ? "Habari za jioni" : "Habari za usiku";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          {greeting}, {first} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          I&apos;m your Omnix concierge. I know every screen, every shortcut, and every Kenyan SME quirk —
          eTIMS errors, KRA codes, NHIF claims, recipe costing. Ask me anything.
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Try one</div>
        {STARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="w-full text-left text-sm rounded-lg glass-thin px-3 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser && "items-end")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {isUser ? "You" : "Omnix"}
      </div>
      <div
        className={cn(
          "text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[92%]",
          isUser ? "rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2.5" : "text-foreground",
        )}
      >
        {message.content}
        {message.streaming && (
          <span className="ml-0.5 inline-block w-1.5 h-3.5 align-middle bg-primary animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}
