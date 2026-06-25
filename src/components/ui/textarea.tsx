"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial textarea — matches the Input primitive's hairline border,
 * soft 3px focus halo, and touch-density bumps. Use this instead of
 * the native <textarea> in every dialog and form.
 *
 *   <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
 *             placeholder="What happened?" rows={4} />
 */
type TextareaProps = React.ComponentProps<"textarea">;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Match Input's hairline border + focus halo so dialogs feel cohesive.
        "min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] leading-relaxed transition-all duration-150 outline-none",
        // Touch density — bigger min-height, 15px body so finger-typing stays legible.
        "touch:min-h-[96px] touch:px-3.5 touch:py-2.5 touch:text-[15px]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
        "dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50",
        // Resize is opt-in via inline style; default to vertical only.
        "resize-y",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
