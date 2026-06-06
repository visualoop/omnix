/**
 * Inline render of a tool call + its result inside the chat thread.
 * Compact, expandable, shows the tool name + a brief result preview.
 */
import { useState } from "react"
import { Wrench, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToolEvent {
  id: string
  name: string
  args?: Record<string, unknown>
  result?: unknown
}

interface Props {
  event: ToolEvent
  busy: boolean
}

const TOOL_LABELS: Record<string, string> = {
  navigate: "Open page",
  getTodaySales: "Today's sales",
  getInventoryAlerts: "Low-stock alerts",
  searchProducts: "Search products",
  searchCustomers: "Search customers",
  getRecentSales: "Recent sales",
  openDocs: "Open docs",
}

export function ToolCallBlock({ event, busy }: Props) {
  const [open, setOpen] = useState(false)
  const label = TOOL_LABELS[event.name] ?? event.name
  const hasResult = event.result !== undefined

  // One-line summary of the result for the collapsed view
  let preview = ""
  if (hasResult) {
    const r = event.result as { count?: number; navigatedTo?: string; revenue?: number; ok?: boolean; url?: string }
    if (r?.navigatedTo) preview = `Opened ${r.navigatedTo}`
    else if (typeof r?.count === "number") preview = `${r.count} result${r.count === 1 ? "" : "s"}`
    else if (typeof r?.revenue === "number") preview = `KES ${r.revenue.toLocaleString("en-KE")}`
    else if (r?.url) preview = r.url
    else if (r?.ok) preview = "Done"
    else preview = "Done"
  } else if (busy) {
    preview = "Running…"
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5",
        "text-[11px] font-mono",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 cursor-pointer text-left"
      >
        {hasResult ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
        )}
        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground truncate flex-1">{preview}</span>
        {open ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 text-[10px]">
          {event.args && Object.keys(event.args).length > 0 && (
            <pre className="bg-background/60 rounded p-1.5 overflow-auto">
              {JSON.stringify(event.args, null, 2)}
            </pre>
          )}
          {hasResult && (
            <pre className="bg-background/60 rounded p-1.5 overflow-auto max-h-48">
              {JSON.stringify(event.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
