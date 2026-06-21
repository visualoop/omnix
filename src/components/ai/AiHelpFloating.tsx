/**
 * Floating help button that opens an inline Q&A pane.
 *
 * Positioned bottom-right on every page (mounted in AppShell). Click → small
 * panel with a question input. AI answer renders inline with suggested
 * route shortcuts the user can click to jump to the right page.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CircleNotch as Loader2,
  Question as HelpCircle,
  Sparkle as Sparkles,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ai, AiError } from "@/services/ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Answer {
  answer: string;
  suggestions: Array<{ label: string; route?: string; shortcut?: string }>;
  confidence: "high" | "medium" | "low";
}

export function AiHelpFloating() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      const result = await ai.docsQa(question, { route: location.pathname });
      setAnswer(result);
    } catch (e) {
      if (e instanceof AiError && e.status === "no_provider") {
        toast.error("No AI provider configured", {
          description: "Add a key in Settings → AI",
          action: { label: "Open", onClick: () => navigate("/settings/ai") },
        });
      } else {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full shadow-lg transition-all cursor-pointer",
          "flex items-center justify-center",
          open
            ? "bg-foreground text-background"
            : "bg-primary text-primary-foreground hover:scale-110",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-[360px] glass-thick rounded-glass-xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <div className="text-xs font-medium">Ask Omnix</div>
            <div className="text-[10px] text-muted-foreground ml-auto">
              {location.pathname === "/" ? "home" : location.pathname}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="How do I run a Z-report?"
              disabled={busy}
              className="text-sm"
            />
            <Button size="sm" onClick={ask} disabled={busy || !question.trim()} className="cursor-pointer">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ask"}
            </Button>
          </div>

          {answer && (
            <div className="mt-3 space-y-3">
              <div className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                {answer.answer}
              </div>
              {answer.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {answer.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (s.route) {
                          navigate(s.route);
                          setOpen(false);
                        }
                      }}
                      className="text-[11px] rounded-md border border-border px-2 py-1 hover:bg-accent cursor-pointer"
                    >
                      {s.label} {s.shortcut && <span className="ml-1 font-mono opacity-60">{s.shortcut}</span>}
                    </button>
                  ))}
                </div>
              )}
              {answer.confidence === "low" && (
                <div className="text-[10px] text-amber-700 dark:text-amber-400">
                  Low confidence — try the docs at{" "}
                  <button
                    onClick={() => { navigate("/docs"); setOpen(false); }}
                    className="underline cursor-pointer"
                  >
                    /docs
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
