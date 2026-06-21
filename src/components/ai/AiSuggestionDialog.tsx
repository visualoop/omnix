/**
 * AI suggestion dialog: shows what the AI proposed, lets the user accept,
 * edit (renders a custom edit form passed by the caller), or reject. Always
 * shows the model/provider that produced the result so the user knows
 * whether to trust it.
 *
 * Design: human-in-the-loop is mandatory for any write. AI never commits;
 * the user clicks Apply.
 */
import { useState } from "react";
import {
  CaretDown as ChevronDown,
  CaretUp as ChevronUp,
  Check,
  Pencil,
  Sparkle as Sparkles,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AiSuggestionMeta {
  provider: string;
  model: string;
  latencyMs: number;
  cacheHit: boolean;
}

interface AiSuggestionDialogProps<T> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  /** The AI's raw proposal, displayed read-only in the summary card. */
  suggestion: T;
  meta: AiSuggestionMeta | null;
  /** Render the "preview" of the suggestion (read-only). */
  renderPreview: (suggestion: T) => React.ReactNode;
  /** Optional editor for the user to tweak before accept. */
  renderEditor?: (
    draft: T,
    setDraft: (next: T) => void,
  ) => React.ReactNode;
  /** Called with the (possibly-edited) value when user clicks Apply. */
  onApply: (final: T) => void | Promise<void>;
  applyLabel?: string;
  rejectLabel?: string;
}

export function AiSuggestionDialog<T>({
  open,
  onOpenChange,
  title,
  suggestion,
  meta,
  renderPreview,
  renderEditor,
  onApply,
  applyLabel = "Apply",
  rejectLabel = "Reject",
}: AiSuggestionDialogProps<T>) {
  const [draft, setDraft] = useState<T>(suggestion);
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>

        {meta && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">{meta.provider}</Badge>
            <span className="font-mono">{meta.model}</span>
            <span>·</span>
            <span>{meta.cacheHit ? "cached" : `${meta.latencyMs}ms`}</span>
          </div>
        )}

        <div className="rounded-lg border border-border p-3 max-h-[40vh] overflow-auto">
          {editing && renderEditor ? renderEditor(draft, setDraft) : renderPreview(editing ? draft : suggestion)}
        </div>

        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
        >
          {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showRaw ? "Hide raw" : "Show raw output"}
        </button>
        {showRaw && (
          <pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-2 rounded overflow-auto max-h-[20vh]">
            {JSON.stringify(suggestion, null, 2)}
          </pre>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="cursor-pointer">
            <X className="h-3.5 w-3.5 mr-1.5" /> {rejectLabel}
          </Button>
          {renderEditor && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              className={cn("cursor-pointer", editing && "bg-accent")}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> {editing ? "Done editing" : "Edit"}
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onApply(editing ? draft : suggestion);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
            className="cursor-pointer"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" /> {applyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
