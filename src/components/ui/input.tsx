import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Native-feel: tighter, smaller corner radius, single-pixel focus ring
        "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-[13px] transition-colors outline-none",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground/70",
        // Focus: Windows 11 style 1px primary ring (no big glow)
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/40",
        "dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
