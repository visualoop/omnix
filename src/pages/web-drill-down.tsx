import { ArrowLeft, MapPin } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { WebReportShell } from "@/components/web/WebReportShell";
import type { DrilldownProjection } from "@/web/contracts";

interface WebDrillDownPageProps {
  readonly projection: DrilldownProjection;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onBack: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onOpenRelated: (id: string) => void;
}

export function WebDrillDownPage({
  projection,
  search,
  hasPreviousPage,
  onBack,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  onOpenRelated,
}: WebDrillDownPageProps) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to report</Button>
      <section aria-labelledby="drilldown-title" className="border-y border-border py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">Read-only record / {projection.id}</p>
        <h1 id="drilldown-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{projection.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{projection.subtitle}</p>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" /> {projection.branchName}</p>
        <dl className="mt-5 grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
          {projection.fields.map((field) => (
            <div key={field.label} className="border-b border-r border-border p-3 sm:p-4">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{field.label}</dt>
              <dd className="mt-2 break-words font-mono text-sm font-semibold">{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <WebReportShell
        title="Related records"
        description="Bounded records connected to this report row. Open another row without leaving the read-only surface."
        scopeLabel={projection.branchName}
        rows={projection.related}
        search={search}
        hasPreviousPage={hasPreviousPage}
        onSearchChange={onSearchChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onOpenRow={onOpenRelated}
      />
    </div>
  );
}
