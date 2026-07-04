"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import {
  CaretDown as ChevronDown,
  Check,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Walk the Select subtree and collect every <SelectItem>'s value + label.
 * Base UI's <Select.Value> renders the raw value unless the Root is given an
 * `items` map — so we derive that map from the items themselves. This makes
 * the trigger show the human label (e.g. a brand/room-type NAME) instead of
 * the id for every select in the app, with zero call-site changes. Falls back
 * to the raw value when no items are found (no regression).
 */
function collectSelectItems(
  node: React.ReactNode,
  out: Array<{ label: React.ReactNode; value: unknown }>,
): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const p = child.props as { value?: unknown; children?: React.ReactNode };
      if (p.value !== undefined && p.value !== null) {
        out.push({ value: p.value, label: p.children });
      }
      return;
    }
    const p = child.props as { children?: React.ReactNode };
    if (p && p.children) collectSelectItems(p.children, out);
  });
}

function Select({ items, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const derivedItems = React.useMemo(() => {
    if (items) return items;
    const acc: Array<{ label: React.ReactNode; value: unknown }> = [];
    collectSelectItems(children, acc);
    return acc.length > 0 ? acc : undefined;
  }, [items, children]);
  return (
    <SelectPrimitive.Root data-slot="select" items={derivedItems} {...props}>
      {children}
    </SelectPrimitive.Root>
  );
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-[13px]",
        "transition-all duration-150",
        "focus:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        "[&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex">
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="z-[100]">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            // Must outrank Sheet/Dialog (z-50) so the dropdown appears
            // ABOVE the modal it's nested inside. Without this, the
            // Select trigger registers a click but the popup renders
            // behind the modal and the user sees nothing.
            "z-[100] min-w-[8rem] overflow-hidden rounded-xl glass-thick py-1 text-popover-foreground",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98]",
            "data-closed:animate-out data-closed:fade-out-0",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex h-7 cursor-pointer select-none items-center rounded-md mx-1 pr-7 pl-2 text-[13px] transition-colors duration-100",
        "outline-none focus:bg-foreground/[0.06] focus:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-3 w-3 items-center justify-center">
        <Check className="h-3 w-3" strokeWidth={3} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn("mx-1 my-1 h-px bg-border/40", className)} />;
}

export {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel, SelectSeparator,
};
