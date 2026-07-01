/**
 * FormDraftBanner — shows above a form when we detect an unfinished draft.
 * Sits below the page heading. Clicking Restore pushes the payload into
 * whatever setter you supply.
 */
import { ClockCounterClockwise, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { intlLocale } from "@/lib/intl";

export function FormDraftBanner<T>({
  draft,
  onRestore,
  onDiscard,
}: {
  draft: { payload: T; updated_at: string } | null;
  onRestore: (payload: T) => void;
  onDiscard: () => void;
}) {
  if (!draft) return null;
  const when = new Date(draft.updated_at + "Z").toLocaleString(intlLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[13px] flex items-center gap-3">
      <ClockCounterClockwise className="h-4 w-4 text-amber-600 shrink-0" />
      <div className="flex-1">
        <span className="text-foreground">You have an unsaved draft from {when}.</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          <X className="h-3.5 w-3.5 mr-1" /> Discard
        </Button>
        <Button size="sm" onClick={() => onRestore(draft.payload)}>
          Restore
        </Button>
      </div>
    </div>
  );
}
