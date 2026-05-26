import { cn } from "@/lib/utils";

/**
 * Reusable sticky table primitives. Use these wherever long tables exist —
 * the header stays at top while body scrolls within a max-height container.
 *
 * Usage:
 *   <StickyTable maxHeight="60vh">
 *     <StickyHead>
 *       <tr>...</tr>
 *     </StickyHead>
 *     <tbody>...</tbody>
 *   </StickyTable>
 */

interface StickyTableProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function StickyTable({ children, maxHeight = "60vh", className }: StickyTableProps) {
  return (
    <div
      className={cn("border border-border rounded-lg overflow-auto", className)}
      style={{ maxHeight }}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function StickyHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm border-b border-border z-10">
      {children}
    </thead>
  );
}
