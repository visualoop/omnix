/**
 * Approval dialog — surfaces pending tool approvals to the user.
 *
 * The AI runtime pushes an ApprovalRequest through an event bus. This
 * component subscribes to the bus, renders the current request as a
 * dialog, and calls back with { approved } once the user answers.
 *
 * Session-scoped auto-approvals cached in the runtime already skip the
 * bus for repeat calls, so this dialog only opens when a truly new
 * (tool, args) pair is requested.
 */
import { useEffect, useState } from "react";
import { CheckCircle, WarningCircle as AlertTriangle, X } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ToolTier } from "@/services/ai/v2/tools/base";
import { approvalBus, type ApprovalRequest } from "@/services/ai/v2/runtime/approval-bus";

const TIER_BADGE: Record<ToolTier, { label: string; className: string; Icon: typeof CheckCircle }> = {
  read:        { label: "Read",        className: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle },
  write:       { label: "Write",       className: "bg-amber-500/10 text-amber-600",     Icon: CheckCircle },
  destructive: { label: "Destructive", className: "bg-rose-500/10 text-rose-600",       Icon: AlertTriangle },
};

export function ApprovalDialog() {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);

  useEffect(() => {
    const unsub = approvalBus.subscribe(setRequest);
    return unsub;
  }, []);

  const respond = (approved: boolean) => {
    request?.respond({ approved });
    setRequest(null);
  };

  if (!request) return null;
  const tier = TIER_BADGE[request.tier];

  return (
    <Dialog open onOpenChange={(o) => !o && respond(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <tier.Icon className="h-4 w-4" />
            AI is requesting approval
            <Badge variant="outline" className={`text-[10px] ml-1 ${tier.className}`}>
              {tier.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Tool
            </div>
            <div className="font-mono text-[13px] mt-0.5">{request.tool}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Action
            </div>
            <p className="text-sm mt-1">{request.summary}</p>
            {request.detail && (
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{request.detail}</p>
            )}
          </div>
          {request.tier === "destructive" && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <p>This action reduces stock or voids records. It cannot be undone from within the AI chat.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => respond(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Deny
            </Button>
            <Button
              onClick={() => respond(true)}
              className={request.tier === "destructive" ? "bg-rose-600 hover:bg-rose-700" : ""}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
