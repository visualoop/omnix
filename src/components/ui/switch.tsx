"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

/**
 * Native Windows-11 style switch.
 *
 * Track: 32×16 (h-4 w-8) pill, off=muted, on=primary
 * Thumb: 12×12 white circle with subtle shadow
 * Transition: 80ms snap (no bounce)
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-4 w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent",
        "transition-colors duration-80",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:bg-primary",
        "data-unchecked:bg-input data-unchecked:hover:bg-input/80",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm ring-0",
          "transition-transform duration-80",
          "data-checked:translate-x-[18px] data-unchecked:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
