import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface ResponsivePageProps extends ComponentProps<"div"> {
  width?: "content" | "wide" | "full";
}

const widthClasses: Record<NonNullable<ResponsivePageProps["width"]>, string> = {
  content: "max-w-5xl",
  wide: "max-w-[1280px]",
  full: "max-w-none",
};

export function ResponsivePage({ className, width = "wide", ...props }: ResponsivePageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-0 lg:py-0",
        widthClasses[width],
        className,
      )}
      {...props}
    />
  );
}
