import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Liquid-native: soft 3px focus halo + 1px primary border
        "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-[13px] transition-all duration-150 outline-none",
        // Touch density — bumps target ≥44px and text to 15px so the
        // user can actually tap and read on tablet/POS terminals.
        "touch:h-11 touch:px-3 touch:text-[15px]",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground/70",
        // Soft halo focus (replaces the harsh single-pixel ring)
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
        "dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
