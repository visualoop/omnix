/**
 * PaginationBar — minimal drop-in for any page that wants prev/next
 * without adopting the full DataListShell.
 *
 * Renders "1–50 of 2,318 · Prev · Page 3/47 · Next" on one row.
 */
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { UseListDataResult } from "@/hooks/use-list-data";

export function PaginationBar<T>({ list }: { list: UseListDataResult<T> }) {
  if (list.total === 0) return null;
  const startRow = (list.page - 1) * list.pageSize + 1;
  const endRow = Math.min(list.page * list.pageSize, list.total);
  return (
    <div className="flex items-center justify-between text-[12px] text-muted-foreground pt-3">
      <div>
        {list.total === 1
          ? "1 record"
          : `${startRow.toLocaleString()}–${endRow.toLocaleString()} of ${list.total.toLocaleString()}`}
        {list.loading ? " · refreshing…" : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={list.page <= 1 || list.loading}
          onClick={() => list.setPage(list.page - 1)}
          className="h-7"
        >
          <CaretLeft className="h-3.5 w-3.5" />
          Prev
        </Button>
        <span className="font-mono px-2">
          {list.page} / {list.pageCount}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={list.page >= list.pageCount || list.loading}
          onClick={() => list.setPage(list.page + 1)}
          className="h-7"
        >
          Next
          <CaretRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
