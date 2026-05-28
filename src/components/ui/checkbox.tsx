"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native Windows-11 style checkbox.
 *
 * 14×14 box, 1px border, 3px corner radius.
 * Off: white bg with border. On: primary bg with white check.
 * Indeterminate: primary bg with minus icon.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer h-3.5 w-3.5 shrink-0 rounded-[3px] border border-input bg-background shadow-sm",
        "transition-colors duration-80",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:bg-primary data-checked:border-primary data-checked:text-primary-foreground",
        "data-indeterminate:bg-primary data-indeterminate:border-primary data-indeterminate:text-primary-foreground",
        "hover:border-foreground/40 data-checked:hover:bg-primary/90",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check className="h-2.5 w-2.5 data-[indeterminate]:hidden" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
