import { money } from "@/lib/money";
/**
 * Omnix AI Assistant — slide-out chat panel with persistence + history.
 *
 * Layout: fixed right edge, full viewport height. Panel is w-1/4 (with
 * a min of 420px) on desktop, full-width on mobile. Toggle: bottom-right
 * ✨ button OR Cmd/Ctrl+J. Auto-opens once on first launch (per device)
 * so the user discovers the feature.
 *
 * Streaming: Vercel AI SDK token-by-token via streamInvoke.
 * Persistence: ai_conversations + ai_messages (migration 044). Resume
 * any past thread from the history sidebar; new conversations created
 * lazily on first send.
 *
 * Markdown: AssistantMarkdown turns backtick routes into clickable chips,
 * shortcuts into kbd pills, code blocks + lists into proper formatting.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Sparkle as Sparkles, X, ArrowUp, CircleNotch as Loader2, Plus, ClockCounterClockwise as History, Trash as Trash2, PushPin as Pin } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"
import { useActiveModule } from "@/stores/active-module"
import { useActiveBranch } from "@/stores/active-branch"
import { streamInvoke, AiError, type ChatMessage } from "@/services/ai"
import { buildSystemPrompt } from "@/services/ai/system-prompt"
import { VARIANT } from "@/lib/variant"
import { buildAssistantTools } from "@/services/ai/tools"
import {
  appendMessage, createConversation, deleteConversation,
  listConversations, loadMessages, setConversationTitle,
  updateMessageContent,
  type Conversation,
} from "@/services/ai/conversations"
import { AssistantMarkdown } from "./AssistantMarkdown"
import { ToolCallBlock, type ToolEvent } from "./ToolCallBlock"
import { toast } from "sonner"

interface UiMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  streaming?: boolean
  toolEvents?: ToolEvent[]
}

const STARTERS = [
  "How do I run a Z-report?",
  "Explain my last eTIMS error",
  "What's the difference between modules?",
  "How do trial users upgrade to paid?",
  "How does cloud backup work?",
]

const HAS_OPENED_KEY = "omnix-assistant-has-opened"

export function AiAssistantPanel() {
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const activeModule = useActiveModule((s) => s.active)
  const branch = useActiveBranch((s) => s.active)

  // Memoise tools — fresh reference per location/navigate change is fine,
  // as the LLM call rebuilds them per send anyway.
  const tools = useMemo(() => {
    return buildAssistantTools({
      navigate: (route: string) => {
        navigate(route)
        // Auto-close so the user sees the page they navigated to
        setOpen(false)
      },
    })
  }, [navigate])

  const refreshHistory = useCallback(() => {
    listConversations(30).then(setConversations).catch(() => {})
  }, [])

  // Auto-open on first ever launch
  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(HAS_OPENED_KEY) === "1") return
    const t = setTimeout(() => {
      setOpen(true)
      localStorage.setItem(HAS_OPENED_KEY, "1")
    }, 1500)
    return () => clearTimeout(t)
  }, [user])

  // Cmd/Ctrl+J shortcut
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [])

  // Focus input + load history on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      refreshHistory()
    }
  }, [open, refreshHistory])

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const startNewChat = () => {
    setConversationId(null)
    setMessages([])
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const openConversation = async (id: string) => {
    try {
      const rows = await loadMessages(id)
      setConversationId(id)
      setMessages(
        rows
          .filter((r) => r.role !== "system")
          .map((r) => ({ id: r.id, role: r.role as UiMessage["role"], content: r.content })),
      )
      setShowHistory(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (e) {
      toast.error(String(e))
    }
  }

  const removeConversation = async (id: string) => {
    await deleteConversation(id)
    if (conversationId === id) startNewChat()
    refreshHistory()
  }

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return

      // Lazy-create conversation on first send
      let convId = conversationId
      if (!convId) {
        convId = await createConversation(user?.id ?? null)
        setConversationId(convId)
        const titleSnippet = text.slice(0, 60)
        await setConversationTitle(convId, titleSnippet)
        refreshHistory()
      }

      const userUiId = await appendMessage(convId, "user", text)
      const userMsg: UiMessage = { id: userUiId, role: "user", content: text }
      const assistantId = crypto.randomUUID()
      const assistantMsg: UiMessage = { id: assistantId, role: "assistant", content: "", streaming: true }
      setMessages((m) => [...m, userMsg, assistantMsg])
      setDraft("")
      // Auto-resize textarea back to single row after submit
      if (inputRef.current) inputRef.current.style.height = "auto"
      setBusy(true)

      const system = buildSystemPrompt({
        userName: user?.full_name ?? user?.username ?? null,
        activeModule,
        currentRoute: location.pathname,
        branchName: branch?.name ?? null,
        variant: VARIANT,
      })

      // Build the conversation history we send to the LLM (system + prior messages + new user)
      const history: ChatMessage[] = [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: "user", content: text },
      ]

      let lastDelta = { provider: undefined as string | undefined, model: undefined as string | undefined, tokensIn: undefined as number | undefined, tokensOut: undefined as number | undefined }
      const toolEvents: ToolEvent[] = []
      try {
        for await (const progress of streamInvoke("assistant_chat", history, { tools, maxSteps: 5 })) {
          // Track tool call/result events
          if (progress.toolCall) {
            toolEvents.push({
              id: progress.toolCall.id,
              name: progress.toolCall.name,
              args: progress.toolCall.args,
            })
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, toolEvents: [...toolEvents] } : msg)),
            )
            continue
          }
          if (progress.toolResult) {
            const idx = toolEvents.findIndex((e) => e.id === progress.toolResult!.id)
            if (idx >= 0) toolEvents[idx] = { ...toolEvents[idx], result: progress.toolResult.result }
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, toolEvents: [...toolEvents] } : msg)),
            )
            continue
          }
          lastDelta = {
            provider: progress.provider,
            model: progress.model,
            tokensIn: progress.tokensIn,
            tokensOut: progress.tokensOut,
          }
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: progress.text, streaming: !progress.done }
                : msg,
            ),
          )
        }
        // Persist final assistant message
        const finalText = (await new Promise<string>((res) => {
          setMessages((m) => {
            const found = m.find((x) => x.id === assistantId)
            res(found?.content ?? "")
            return m
          })
        }))
        await appendMessage(convId, "assistant", finalText, {
          provider: lastDelta.provider,
          model: lastDelta.model,
          tokens_in: lastDelta.tokensIn,
          tokens_out: lastDelta.tokensOut,
        })
        // Make the persisted message id the same as the streaming one would
        // be confusing — we just keep them in sync via the appendMessage row.
        void updateMessageContent
      } catch (e) {
        if (e instanceof AiError && e.status === "no_provider") {
          toast.error("AI not configured", {
            description: "Add a key in Settings → AI to enable the assistant.",
            action: { label: "Open settings", onClick: () => navigate("/settings/ai") },
          })
        } else if (e instanceof AiError && e.status === "blocked_privacy") {
          toast.error("Blocked by privacy settings", { description: e.message })
        } else {
          toast.error("Assistant failed", { description: (e as Error).message })
        }
        setMessages((m) => m.filter((msg) => msg.id !== assistantId))
      } finally {
        setBusy(false)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    },
    [messages, busy, user, activeModule, location.pathname, branch, conversationId, refreshHistory, tools],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(draft)
    }
  }

  return (
    <>
      {/* Trigger button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Omnix assistant (⌘J)"
          className={cn(
            "fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-xl transition-all cursor-pointer",
            "flex items-center justify-center bg-primary text-primary-foreground hover:scale-110 ring-1 ring-inset ring-primary/30",
          )}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center cursor-pointer",
                  showHistory ? "bg-accent text-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground",
                )}
                aria-label="History"
                title="History"
              >
                <History className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={startNewChat}
                className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {showHistory ? (
            <HistoryView
              conversations={conversations}
              activeId={conversationId}
              onPick={openConversation}
              onDelete={removeConversation}
              onClose={() => setShowHistory(false)}
            />
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {messages.length === 0 ? (
                <WelcomeBlock onPick={send} />
              ) : (
                messages.map((m) => <MessageView key={m.id} message={m} />)
              )}
            </div>
          )}

          {/* Input */}
          {!showHistory && (
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
                  style={{ height: "auto", minHeight: "44px" }}
                  onInput={(e) => {
                    const ta = e.currentTarget
                    ta.style.height = "auto"
                    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
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
          )}
        </aside>
      )}
    </>
  )
}

function WelcomeBlock({ onPick }: { onPick: (text: string) => void }) {
  const user = useAuthStore((s) => s.user)
  const first = user?.full_name?.split(" ")[0] || user?.username || "there"
  const h = new Date().getHours()
  const greeting =
    h < 5 ? "Habari za usiku" : h < 12 ? "Habari za asubuhi" : h < 16 ? "Habari za mchana" : h < 19 ? "Habari za jioni" : "Habari za usiku"

  const [snapshot, setSnapshot] = useState<{ sales: number; revenue: number; lowStock: number } | null>(null)

  useEffect(() => {
    Promise.all([
      import("@/services/pos-helpers").then((m) => m.getTodaySalesSummary()).catch(() => null),
      import("@/services/pos-helpers").then((m) => m.getLowStockProducts(50)).catch(() => null),
    ]).then(([sales, low]) => {
      if (!sales) return
      setSnapshot({
        sales: sales.count,
        revenue: sales.revenue,
        lowStock: low?.length ?? 0,
      })
    })
  }, [])

  const fmtKES = (n: number) => money(n)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{greeting}, {first} 👋</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          I&apos;m your Omnix concierge. I know every screen, every shortcut, KRA eTIMS,
          M-Pesa, NHIF/SHA, the licence model and the website inside out — and I can
          take you straight to the right page or look things up for you.
        </p>
      </div>

      {snapshot && (snapshot.sales > 0 || snapshot.lowStock > 0) && (
        <div className="rounded-lg glass-thin px-3 py-2.5 text-[12px] space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Today so far</div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span><span className="font-medium">{snapshot.sales}</span> sale{snapshot.sales === 1 ? "" : "s"}</span>
            {snapshot.revenue > 0 && (
              <span className="font-mono">{fmtKES(snapshot.revenue)}</span>
            )}
            {snapshot.lowStock > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {snapshot.lowStock} item{snapshot.lowStock === 1 ? "" : "s"} below reorder
              </span>
            )}
          </div>
        </div>
      )}

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
  )
}

function MessageView({ message }: { message: UiMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex flex-col gap-1", isUser && "items-end")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {isUser ? "You" : "Omnix"}
      </div>
      <div
        className={cn(
          "text-sm leading-relaxed break-words max-w-[92%] flex flex-col gap-2",
          isUser
            ? "rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2.5 whitespace-pre-wrap"
            : "text-foreground",
        )}
      >
        {isUser ? message.content : (
          <>
            {message.toolEvents && message.toolEvents.length > 0 && (
              <div className="flex flex-col gap-1">
                {message.toolEvents.map((ev) => (
                  <ToolCallBlock key={ev.id} event={ev} busy={ev.result === undefined} />
                ))}
              </div>
            )}
            {message.content && <AssistantMarkdown source={message.content} />}
            {message.streaming && (
              <span className="inline-block w-1.5 h-3.5 align-middle bg-primary animate-pulse rounded-sm" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface HistoryViewProps {
  conversations: Conversation[]
  activeId: string | null
  onPick: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

function HistoryView({ conversations, activeId, onPick, onDelete }: HistoryViewProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-muted-foreground">
        <History className="h-8 w-8 opacity-30 mb-3" />
        <div className="text-sm">No past chats yet</div>
        <div className="text-[11px] mt-1">Your conversations save automatically.</div>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-1">
      {conversations.map((c) => (
        <div
          key={c.id}
          className={cn(
            "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
            activeId === c.id ? "bg-accent" : "hover:bg-accent/50",
          )}
        >
          {c.pinned ? <Pin className="h-3 w-3 text-muted-foreground shrink-0" /> : null}
          <button
            type="button"
            onClick={() => onPick(c.id)}
            className="flex-1 text-left text-sm truncate cursor-pointer"
          >
            {c.title || "Untitled chat"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
            className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded hover:bg-rose-500/10 hover:text-rose-600 flex items-center justify-center cursor-pointer"
            aria-label="Delete chat"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
