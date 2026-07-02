import { useEffect, useState, useCallback } from "react";
import { ClipboardText, Check, X, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listPending, createFollowUp, complete, cancel, type FollowUp,
} from "@/services/follow-ups";
import { intlLocale } from "@/lib/intl";
import { useAuthStore } from "@/stores/auth";

import { BackButton } from "@/components/ui/back-button";
export function FollowUpsPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listPending()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (f: FollowUp) => {
    await complete(f.id);
    toast.success("Marked done");
    load();
  };
  const handleCancel = async (f: FollowUp) => {
    await cancel(f.id);
    load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/customers" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardText className="h-5 w-5 text-primary" /> Follow-ups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reminders to call, follow up, chase — anything you don&rsquo;t want to lose track of.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New follow-up
        </Button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <ClipboardText className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">No follow-ups pending.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => {
            const overdue = new Date(f.due_at) < new Date();
            return (
              <div key={f.id} className={`rounded-md border p-3 flex items-start gap-3 ${overdue ? "border-red-500/40 bg-red-500/5" : "border-border"}`}>
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">{f.title}</div>
                  {f.notes && <div className="text-[12px] text-muted-foreground mt-0.5">{f.notes}</div>}
                  <div className={`text-[11px] mt-1 ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    Due {new Date(f.due_at).toLocaleString(intlLocale(), { dateStyle: "medium", timeStyle: "short" })}
                    {overdue && " · overdue"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleComplete(f)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Done
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleCancel(f)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <NewFollowUpDialog open={openNew} onOpenChange={setOpenNew} onCreated={load} userId={user?.id} />
    </div>
  );
}

function NewFollowUpDialog({
  open, onOpenChange, onCreated, userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  userId?: string;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    try {
      await createFollowUp({
        title: title.trim(),
        notes: notes.trim() || undefined,
        due_at: dueAt.replace("T", " ") + ":00",
        created_by: userId,
      });
      toast.success("Follow-up created");
      onOpenChange(false);
      onCreated();
      setTitle(""); setNotes("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call Wanjiku about credit balance" autoFocus />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Due at</label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
