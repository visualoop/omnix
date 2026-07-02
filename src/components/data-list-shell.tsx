/**
 * DataListShell — the shared shell for every paginated list page.
 *
 * Renders:
 *   - <PageHeader> (with back button)
 *   - Search input (top-right) — bound to useListData.setSearch
 *   - Optional actions slot (e.g. "New supplier" button)
 *   - Sticky-header wrapping for whatever table/list the caller passes
 *   - Empty / loading / error states
 *   - Pagination bar: "Page X of Y · N records" with prev/next
 *
 * Usage:
 *   const list = useListData((q) => listSuppliers(q));
 *   <DataListShell
 *     eyebrow="Operations"
 *     title="Suppliers"
 *     description="Vendors and their terms."
 *     back={{ fallback: "/" }}
 *     searchPlaceholder="Search suppliers"
 *     list={list}
 *     actions={<Button>New</Button>}
 *   >
 *     <table>...
 *   </DataListShell>
 */
import type { ReactNode } from "react";
import { MagnifyingGlass, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import type { UseListDataResult } from "@/hooks/use-list-data";

interface Props<T> {
  eyebrow?: string;
  title: string;
  description?: string;
  back?: true | { fallback?: string; label?: string };
  searchPlaceholder?: string;
  actions?: ReactNode;
  list: UseListDataResult<T>;
  /** Called after the pagination bar. Rare. */
  footer?: ReactNode;
  /** The <table> or <ul> body. Header of the table should use `sticky top-0 bg-background z-10`. */
  children: ReactNode;
  /** Content to render when rows.length === 0 and not loading. */
  emptyState?: ReactNode;
  /** Override the default max width if the caller wants narrower/wider. */
  maxWidthClass?: string;
}

export function DataListShell<T>({
  eyebrow,
  title,
  description,
  back,
  searchPlaceholder = "Search",
  actions,
  list,
  footer,
  children,
  emptyState,
  maxWidthClass = "max-w-6xl",
}: Props<T>) {
  const startRow = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const endRow = Math.min(list.page * list.pageSize, list.total);

  return (
    <div className={`${maxWidthClass} space-y-5`}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        back={back}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={list.search}
                onChange={(e) => list.setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 h-8 w-[240px] text-[13px]"
              />
            </div>
            {actions}
          </div>
        }
      />

      {list.error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-[13px] text-red-700">
          {list.error}
        </div>
      ) : null}

      {list.loading && list.rows.length === 0 ? (
        <div className="rounded-lg border border-border p-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : list.rows.length === 0 ? (
        emptyState ?? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <div className="text-sm text-muted-foreground">
              {list.search ? `No matches for "${list.search}".` : "Nothing here yet."}
            </div>
          </div>
        )
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {children}
          </div>
        </div>
      )}

      {/* Pagination bar — always visible when there are rows */}
      {list.total > 0 ? (
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
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
      ) : null}

      {footer}
    </div>
  );
}
