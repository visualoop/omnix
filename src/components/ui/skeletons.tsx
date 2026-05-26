import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton row for table layouts (5 cells default) */
export function TableRowSkeleton({ cells = 5, rows = 5 }: { cells?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-border last:border-0">
          {Array.from({ length: cells }).map((_, ci) => (
            <td key={ci} className="px-3 py-3">
              <Skeleton className="h-3.5 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton card grid (3 cols default) */
export function CardGridSkeleton({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  return (
    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton list of items (e.g. cart, menu) */
export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic page header skeleton */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-3 w-72" />
    </div>
  );
}
