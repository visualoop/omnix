/**
 * AssistantMarkdown — renders streaming assistant messages with proper
 * markdown formatting AND clickable route chips. When the assistant says
 * "open `/pos`" or "go to `/settings/etims`", the user can tap the chip
 * to navigate. Same for keyboard shortcuts ("`Ctrl+K`") which render as
 * styled-but-non-clickable kbd.
 *
 * The list of valid routes lives here — anything in backticks that starts
 * with `/` and matches gets the chip treatment; non-route inline code stays
 * as a regular <code> pill.
 */
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

const KNOWN_ROUTE_PREFIXES = [
  "/pos", "/inventory", "/sales-history", "/customers", "/suppliers",
  "/purchase-orders", "/expenses", "/pnl", "/banking", "/cash-register",
  "/petty-cash", "/reports", "/vat-report", "/zreport", "/daily-operations",
  "/etims-queue", "/etims-settings", "/import-products", "/stock", "/stock-take",
  "/stock-transfers", "/returns", "/promotions", "/invoicing", "/invoice-new",
  "/invoice-detail", "/recurring-invoices", "/claims", "/payroll", "/attendance",
  "/leave", "/employees", "/backup", "/cloud-backup", "/audit", "/quick-add",
  "/pharmacy", "/doctors", "/patient-profile", "/controlled-register",
  "/cold-chain", "/refills", "/expiry", "/amr-report", "/tips-report",
  "/retail-laybys", "/retail-special-orders", "/retail-shrinkage",
  "/retail-brands", "/retail-dashboard", "/hardware", "/hospitality",
  "/setup", "/login", "/license-activation", "/modules", "/branches",
  "/settings", "/dashboard", "/reports-index",
]

const SHORTCUT_PATTERN = /^(Ctrl|Cmd|Alt|Shift|Meta|⌘|⌃|⌥|⇧)\+/i
const FN_KEY_PATTERN = /^F\d{1,2}$/

function isRoute(text: string): boolean {
  if (!text.startsWith("/")) return false
  return KNOWN_ROUTE_PREFIXES.some((p) => text === p || text.startsWith(`${p}/`))
}

function isShortcut(text: string): boolean {
  return SHORTCUT_PATTERN.test(text) || FN_KEY_PATTERN.test(text) || text === "Esc"
}

interface RouteChipProps {
  to: string
}

function RouteChip({ to }: RouteChipProps) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        "inline-flex items-center gap-1 align-baseline cursor-pointer",
        "rounded-md bg-primary/10 px-1.5 py-0.5 -my-0.5",
        "text-[12px] font-mono font-medium text-primary",
        "ring-1 ring-inset ring-primary/15 hover:bg-primary/15 hover:ring-primary/30",
        "transition-colors",
      )}
      title={`Open ${to}`}
    >
      {to}
      <ArrowUpRight className="h-2.5 w-2.5 opacity-70" />
    </button>
  )
}

function ShortcutKbd({ keys }: { keys: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center align-baseline",
        "rounded-md bg-muted/60 px-1.5 py-0.5 -my-0.5",
        "text-[11px] font-mono font-medium",
        "ring-1 ring-inset ring-border",
      )}
    >
      {keys}
    </kbd>
  )
}

export const AssistantMarkdown = memo(function AssistantMarkdown({ source }: { source: string }) {
  return (
    <ReactMarkdown
      components={{
        // Inline code: route chip / shortcut kbd / regular code pill
        code({ className, children, ...props }) {
          const isInline = !className?.includes("language-")
          const text = String(children).trim()
          if (isInline && isRoute(text)) return <RouteChip to={text} />
          if (isInline && isShortcut(text)) return <ShortcutKbd keys={text} />
          if (isInline) {
            return (
              <code
                className="rounded bg-muted/60 px-1.5 py-0.5 -my-0.5 text-[12px] font-mono ring-1 ring-inset ring-border"
                {...props}
              >
                {children}
              </code>
            )
          }
          // Fenced block
          return (
            <pre className="my-2 rounded-lg bg-muted/40 p-3 text-[12px] font-mono leading-relaxed overflow-auto ring-1 ring-inset ring-border">
              <code {...props}>{children}</code>
            </pre>
          )
        },
        a({ href, children, ...props }) {
          // Internal absolute paths handled like routes
          if (href?.startsWith("/")) {
            return <RouteChip to={href} />
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              {...props}
            >
              {children}
            </a>
          )
        },
        ul({ children }) { return <ul className="list-disc list-outside ml-5 space-y-1 my-1.5">{children}</ul> },
        ol({ children }) { return <ol className="list-decimal list-outside ml-5 space-y-1 my-1.5">{children}</ol> },
        li({ children }) { return <li className="leading-relaxed">{children}</li> },
        p({ children }) { return <p className="leading-relaxed my-1.5 first:mt-0 last:mb-0">{children}</p> },
        h1({ children }) { return <h3 className="text-[14px] font-semibold tracking-tight mt-3 mb-1.5">{children}</h3> },
        h2({ children }) { return <h3 className="text-[13px] font-semibold tracking-tight mt-3 mb-1.5">{children}</h3> },
        h3({ children }) { return <h3 className="text-[13px] font-semibold tracking-tight mt-3 mb-1.5">{children}</h3> },
        strong({ children }) { return <strong className="font-semibold text-foreground">{children}</strong> },
      }}
    >
      {source}
    </ReactMarkdown>
  )
})
