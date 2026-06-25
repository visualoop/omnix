import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Liquid-native: continuous corners, soft 3px focus halo, subtle press
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-[13px] font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: subtle inner top-edge gloss + soft inner bottom shade for "pressable" liquid feel
        default:
          "bg-primary text-primary-foreground hover:bg-primary/92 [a]:hover:bg-primary/85 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14),inset_0_-1px_0_rgb(0_0_0_/_0.06),0_1px_2px_rgb(0_0_0_/_0.06)]",
        outline:
          "border-border bg-background/60 backdrop-blur-sm hover:bg-accent/50 hover:text-foreground hover:border-border aria-expanded:bg-accent/60 aria-expanded:text-foreground dark:border-input dark:bg-input/20 dark:hover:bg-input/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary",
        ghost:
          "hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/50 focus-visible:ring-destructive/30 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 touch:h-11 touch:px-4 touch:text-[14px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-[11.5px] touch:h-9 touch:px-3 touch:text-[12px] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-2.5 text-[12.5px] touch:h-10 touch:px-3.5 touch:text-[13px] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3.5 touch:h-12 touch:px-4 touch:text-[15px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-8 touch:size-11",
        "icon-xs":
          "size-6 rounded-[4px] touch:size-9 in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-md touch:size-10 in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-9 touch:size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
