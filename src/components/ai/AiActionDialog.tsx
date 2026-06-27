/**
 * AI action confirmation dialog — the human-in-the-loop gate for any AI write.
 *
 * The assistant proposes an action (via a propose* tool); this dialog shows a
 * concrete, read-only preview of exactly what will change (computed by
 * services/ai/actions.previewAction), and only applies it — through the real
 * audited service — when the user clicks Apply. Reject is always one tap away.
 */
import { useEffect, useState } from "react";
import { Check, X, Sparkle as Sparkles, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  previewAction, applyAction, recordRejectedAction,
  type ActionProposal, type PreviewResult,
} from "@/services/ai/actions";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

interface Props {
  proposal: ActionProposal | null;
  onClose: () => void;
  onApplied?: (route?: string) => void;
}

export function AiActionDialog({ proposal, onClose, onApplied }: Props) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!proposal) { setPreview(null); return; }
    setLoadingPreview(true);
    previewAction(proposal)
      .then(setPreview)
      .catch(() => setPreview({ lines: [{ label: "Error", value: "Could not preview this action." }] }))
      .finally(() => setLoadingPreview(false));
  }, [proposal]);

  const reject = async () => {
    if (proposal && userId) await recordRejectedAction(proposal, userId).catch(() => {});
    onClose();
  };

  const apply = async () => {
    if (!proposal || !userId) return;
    setBusy(true);
    try {
      const res = await applyAction(proposal, userId);
      if (res.ok) {
        toast.success(res.message);
        onApplied?.(res.route);
        onClose();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error("Couldn't apply the action", { description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!proposal} onOpenChange={(v) => { if (!v) reject(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Confirm AI action
          </DialogTitle>
        </DialogHeader>

        {proposal && (
          <p className="text-sm text-foreground/80">{proposal.summary}</p>
        )}

        <div className="rounded-lg border border-border p-3 max-h-[45vh] overflow-auto">
          {loadingPreview ? (
            <p className="text-xs text-muted-foreground">Checking what will change…</p>
          ) : preview ? (
            <dl className="space-y-1.5">
              {preview.lines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className={l.label === "·" ? "text-muted-foreground" : "text-muted-foreground"}>{l.label === "·" ? "" : l.label}</dt>
                  <dd className={`font-medium tabular-nums text-right ${l.label === "·" ? "text-foreground/70 font-normal w-full" : ""}`}>{l.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {preview?.warning && (
            <div className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
              <Warning className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{preview.warning}</span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Nothing changes until you apply. This action runs with your permissions and is logged.
        </p>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={reject} className="cursor-pointer">
            <X className="h-3.5 w-3.5 mr-1.5" /> Reject
          </Button>
          <Button size="sm" disabled={busy || loadingPreview} onClick={apply} className="cursor-pointer">
            <Check className="h-3.5 w-3.5 mr-1.5" /> {busy ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
