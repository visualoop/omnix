import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Native-feel Card primitives.
 *
 * - Default (`variant="flat"`): single 1px border, no shadow. Best for
 *   dense data surfaces (tables, dashboards, inventory).
 * - `variant="elevated"`: subtle native shadow. Use for cards that should
 *   pop slightly (KPI tiles, callouts).
 * - `variant="glass"`: liquid-glass material (translucent, backdrop-blur,
 *   top-edge highlight, soft 22px continuous corner). Use on heroes,
 *   floating panels, single-card focus screens. NOT on dense data.
 */

interface CardProps extends React.ComponentProps<"div"> {
  /** @deprecated use variant="elevated" */
  elevated?: boolean
  variant?: "flat" | "elevated" | "glass"
}

function Card({ className, elevated, variant, ...props }: CardProps) {
  const v = variant ?? (elevated ? "elevated" : "flat")
  return (
    <div
      data-slot="card"
      data-variant={v}
      className={cn(
        v === "glass"
          ? "glass rounded-glass-lg text-card-foreground"
          : "rounded-md border border-border bg-card text-card-foreground",
        v === "elevated" && "shadow-native",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex items-start justify-between gap-3 px-3.5 py-2.5 border-b border-border",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-[13px] font-semibold tracking-tight leading-tight",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-xs text-muted-foreground leading-snug mt-0.5", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-3.5 py-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 px-3.5 py-2.5 border-t border-border bg-muted/20",
        className
      )}
      {...props}
    />
  )
}

function CardActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-actions"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardActions }
