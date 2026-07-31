import { ArrowRight, ChartBar, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportDefinition } from "@/web/contracts";

interface WebReportsPageProps {
  readonly reports: readonly ReportDefinition[];
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly onOpenReport: (reportId: ReportDefinition["id"]) => void;
}

export function WebReportsPage({ reports, search, onSearchChange, onOpenReport }: WebReportsPageProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const visible = normalizedSearch
    ? reports.filter((report) => `${report.title} ${report.description}`.toLowerCase().includes(normalizedSearch))
    : reports;

  return (
    <div className="space-y-5">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">Permission-filtered</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your role and branch assignments determine what appears here. Sensitive financial reports require a separate permission.</p>
      </header>

      <div className="relative max-w-md">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          maxLength={80}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search available reports"
          aria-label="Search available reports"
          className="min-h-11 pl-9"
        />
      </div>

      <section aria-label="Available reports" className="divide-y divide-border border-y border-border">
        {visible.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium">No permitted reports match</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search. Hidden reports cannot be requested by URL.</p>
          </div>
        ) : visible.map((report) => (
          <article key={report.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
              <ChartBar className="size-5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{report.title}</h2>
                {report.sensitive ? <Badge variant="outline"><ShieldCheck aria-hidden="true" /> Restricted</Badge> : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{report.description}</p>
            </div>
            <Button variant="ghost" className="self-start sm:self-auto" onClick={() => onOpenReport(report.id)}>
              View report <ArrowRight aria-hidden="true" />
            </Button>
          </article>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">Showing {visible.length} of {reports.length} reports permitted for this session.</p>
    </div>
  );
}
