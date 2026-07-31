import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ResponsiveActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 [&_[data-slot=button]]:min-h-11 [&_[data-slot=button]]:w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:[&_[data-slot=button]]:min-h-0 sm:[&_[data-slot=button]]:w-auto",
        className,
      )}
      {...props}
    />
  );
}
