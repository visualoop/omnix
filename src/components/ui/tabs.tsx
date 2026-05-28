"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

/**
 * Native Windows 11-style Tabs — underline indicator, not pill.
 *
 *   <Tabs defaultValue="general">
 *     <TabsList>
 *       <TabsTrigger value="general">General</TabsTrigger>
 *       <TabsTrigger value="security">Security</TabsTrigger>
 *     </TabsList>
 *     <TabsPanel value="general">...</TabsPanel>
 *     <TabsPanel value="security">...</TabsPanel>
 *   </Tabs>
 */

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 items-center gap-1 border-b border-border",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Native: underline-only active state, no pill background
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
        "px-3 h-9 text-[13px] font-medium text-muted-foreground transition-colors",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm",
        "data-selected:text-foreground",
        // Underline indicator using ::after
        "after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[2px] after:bg-primary after:rounded-t",
        "after:origin-bottom after:scale-y-0 data-selected:after:scale-y-100 after:transition-transform after:duration-120",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn(
        "outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsPanel }
