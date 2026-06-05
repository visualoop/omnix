/**
 * Standard ✨ AI trigger button. Drop in anywhere a feature wants to offer
 * an AI-assisted action. Handles loading/disabled state and toast errors so
 * the caller's onClick handler stays focused on the AI invocation itself.
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AiError } from "@/services/ai";

interface AiButtonProps {
  label?: string;
  /** Tooltip / aria-label when there's no visible label. */
  hint?: string;
  /** Returns a promise; we set loading state for its lifetime. */
  onRun: () => Promise<void> | void;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  disabled?: boolean;
  className?: string;
}

export function AiButton({
  label,
  hint,
  onRun,
  size = "sm",
  variant = "outline",
  disabled,
  className,
}: AiButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRun();
    } catch (e) {
      if (e instanceof AiError) {
        if (e.status === "no_provider") {
          toast.error("No AI provider configured", {
            description: "Open Settings → AI to add an API key. Free tiers from Groq, OpenRouter, DeepSeek work great.",
            action: { label: "Open settings", onClick: () => { window.location.hash = "#/settings/ai"; } },
          });
        } else if (e.status === "blocked_privacy") {
          toast.error("Blocked by privacy", { description: e.message });
        } else if (e.status === "rate_limited") {
          toast.error("All providers rate-limited", { description: "Try again in a minute." });
        } else {
          toast.error("AI call failed", { description: e.message });
        }
      } else {
        toast.error(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled || busy}
      onClick={handleClick}
      title={hint}
      aria-label={label ?? hint ?? "AI"}
      className={cn("cursor-pointer", className)}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {label && <span className="ml-1.5">{label}</span>}
    </Button>
  );
}
