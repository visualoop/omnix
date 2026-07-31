import { CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CursorPage, ReportRowProjection } from "@/web/contracts";

interface WebReportShellProps {
  readonly title: string;
  readonly description: string;
  readonly scopeLabel: string;
  readonly rows: CursorPage<ReportRowProjection>;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onOpenRow: (id: string) => void;
}

export function WebReportShell({
  title,
  description,
  scopeLabel,
  rows,
  search,
  hasPreviousPage,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  onOpenRow,
}: WebReportShellProps) {
  return (
    <section aria-labelledby="web-report-title" className="space-y-4">
      <div className="border-b border-border pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">{scopeLabel}</p>
        <h2 id="web-report-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="relative max-w-md">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          maxLength={80}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search this report"
          aria-label="Search report rows"
          className="min-h-11 pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record</TableHead>
              <TableHead className="hidden sm:table-cell">Context</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="w-24"><span className="sr-only">Open</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-sm text-muted-foreground">
                  No report rows match this search.
                </TableCell>
              </TableRow>
            ) : rows.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="mt-0.5 max-w-[15rem] truncate text-[11px] text-muted-foreground sm:hidden">{row.secondary}</p>
                </TableCell>
                <TableCell className="hidden max-w-xs truncate text-muted-foreground sm:table-cell">{row.secondary}</TableCell>
                <TableCell className="text-right font-mono font-medium">{row.value}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onOpenRow(row.id)} aria-label={`Open ${row.label} details`}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{rows.items.length} records on this page</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={!hasPreviousPage} onClick={onPreviousPage}>
            <CaretLeft aria-hidden="true" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!rows.hasMore || !rows.nextCursor} onClick={onNextPage}>
            Next <CaretRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
