import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Native-feel Card primitives.
 *
 * Default: flat, single 1px border, no shadow (Windows native cards
 * are usually flat surfaces with a subtle border, not floating).
 * Use `elevated` prop for cards that should pop (rare).
 */

interface CardProps extends React.ComponentProps<"div"> {
  elevated?: boolean
}

function Card({ className, elevated, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-md border border-border bg-card text-card-foreground",
        elevated && "shadow-native",
        className
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
