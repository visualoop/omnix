import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { WebReportShell } from "@/components/web/WebReportShell";
import type { CursorPage, ReportDefinition, ReportRowProjection } from "@/web/contracts";

interface WebReportPageProps {
  readonly report: ReportDefinition;
  readonly scopeLabel: string;
  readonly rows: CursorPage<ReportRowProjection>;
  readonly search: string;
  readonly hasPreviousPage: boolean;
  readonly onBack: () => void;
  readonly onSearchChange: (value: string) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onOpenRow: (id: string) => void;
}

export function WebReportPage({
  report,
  scopeLabel,
  rows,
  search,
  hasPreviousPage,
  onBack,
  onSearchChange,
  onPreviousPage,
  onNextPage,
  onOpenRow,
}: WebReportPageProps) {
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft aria-hidden="true" /> All reports</Button>
      <WebReportShell
        title={report.title}
        description={report.description}
        scopeLabel={scopeLabel}
        rows={rows}
        search={search}
        hasPreviousPage={hasPreviousPage}
        onSearchChange={onSearchChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        onOpenRow={onOpenRow}
      />
    </div>
  );
}
