import { CaretLeft, CaretRight, MapPin, MagnifyingGlass, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BranchSummary, CursorPage } from "@/web/contracts";

interface WebBranchesPageProps {
  readonly branches: CursorPage<BranchSummary>;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onViewBranch: (branchId: string) => void;
}

export function WebBranchesPage({
  branches,
  search,
  hasPreviousPage,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  onViewBranch,
}: WebBranchesPageProps) {
  return (
    <div className="space-y-5">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">Assigned locations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Branches</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Only branches assigned to this session are visible. Open a branch to view its report context.</p>
      </header>

      <div className="relative max-w-md">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          maxLength={80}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search assigned branches"
          aria-label="Search assigned branches"
          className="min-h-11 pl-9"
        />
      </div>

      <section aria-label="Assigned branch results" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {branches.items.length === 0 ? (
          <div className="col-span-full border-y border-border py-12 text-center">
            <p className="text-sm font-medium">No assigned branches match</p>
            <p className="mt-1 text-xs text-muted-foreground">Change the search or ask an administrator to review branch assignments.</p>
          </div>
        ) : branches.items.map((branch) => (
          <article key={branch.id} className="flex min-h-48 flex-col rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{branch.code}</p>
                <h2 className="mt-1 truncate text-base font-semibold">{branch.name}</h2>
              </div>
              <Badge variant={branch.syncState === "offline" ? "destructive" : "outline"}>
                {branch.syncState === "offline" ? <WifiSlash aria-hidden="true" /> : <WifiHigh aria-hidden="true" />}
                {branch.syncState}
              </Badge>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" /> {branch.town ?? "Location not recorded"}
            </p>
            <div className="mt-4 grid grid-cols-2 border-y border-border py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales today</p>
                <p className="mt-1 font-mono text-sm font-semibold">{branch.salesToday}</p>
              </div>
              <div className="border-l border-border pl-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Transactions</p>
                <p className="mt-1 font-mono text-sm font-semibold">{branch.transactionCount}</p>
              </div>
            </div>
            <Button variant="outline" className="mt-auto w-full" onClick={() => onViewBranch(branch.id)}>
              View performance
            </Button>
          </article>
        ))}
      </section>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{branches.items.length} branches on this page</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={!hasPreviousPage} onClick={onPreviousPage}><CaretLeft aria-hidden="true" /> Previous</Button>
          <Button variant="outline" size="sm" disabled={!branches.hasMore || !branches.nextCursor} onClick={onNextPage}>Next <CaretRight aria-hidden="true" /></Button>
        </div>
      </div>
    </div>
  );
}
