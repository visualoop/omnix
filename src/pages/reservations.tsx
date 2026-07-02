import { useEffect, useState, useCallback } from "react";
import { Calendar, Plus, Phone, User, ClockCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listReservations,
  createReservation,
  updateStatus,
  deleteReservation,
  findConflicts,
  type Reservation,
  type ReservationKind,
  type ReservationStatus,
} from "@/services/reservations";
import { intlLocale } from "@/lib/intl";

import { BackButton } from "@/components/ui/back-button";
const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmed: "Confirmed",
  seated: "Seated",
  checked_in: "Checked in",
  no_show: "No-show",
  cancelled: "Cancelled",
  completed: "Completed",
};

const STATUS_COLOR: Record<ReservationStatus, string> = {
  confirmed: "bg-blue-500/10 text-blue-700",
  seated: "bg-emerald-500/10 text-emerald-700",
  checked_in: "bg-emerald-500/10 text-emerald-700",
  no_show: "bg-red-500/10 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-muted text-muted-foreground",
};

export function ReservationsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [kind, setKind] = useState<ReservationKind>("table");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [openNew, setOpenNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${date} 00:00:00`;
      const to = `${date} 23:59:59`;
      setItems(await listReservations({ kind, from, to }));
    } finally {
      setLoading(false);
    }
  }, [kind, date]);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, s: ReservationStatus) => {
    await updateStatus(id, s);
    toast.success(`Marked ${STATUS_LABEL[s]}`);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteReservation(id);
    load();
  };

  return (
    <div className="max-w-5xl space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <BackButton fallback="/hospitality" />
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Reservations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Table + room bookings. Filter by day, mark statuses, follow up on no-shows.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New reservation
        </Button>
      </header>

      <div className="flex gap-2 items-center border-b border-border pb-2">
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          {(["table", "room"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1 text-[12.5px] rounded ${
                kind === k ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {k === "table" ? "Tables" : "Rooms"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Calendar className="absolute left-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-8 w-[160px] h-8 text-[13px]" />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <Calendar className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No {kind} reservations for {new Date(date).toLocaleDateString(intlLocale())}.
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3 flex items-center gap-3">
              <ClockCounterClockwise className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[13.5px]">
                  <span className="font-semibold">{new Date(r.arrival_at.replace(" ", "T")).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>·</span>
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{r.guest_name}</span>
                  {r.party_size ? <span className="text-muted-foreground">({r.party_size})</span> : null}
                  {r.guest_phone && (
                    <>
                      <span>·</span>
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-[12.5px]">{r.guest_phone}</span>
                    </>
                  )}
                </div>
                {r.notes && <div className="text-[12px] text-muted-foreground mt-0.5">{r.notes}</div>}
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_COLOR[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
              {r.status === "confirmed" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, kind === "table" ? "seated" : "checked_in")}>
                    {kind === "table" ? "Seat" : "Check in"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStatus(r.id, "no_show")}>
                    No-show
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <NewReservationDialog
        open={openNew}
        onOpenChange={setOpenNew}
        kind={kind}
        onCreated={load}
      />
    </div>
  );
}

function NewReservationDialog({
  open, onOpenChange, kind, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  kind: ReservationKind;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [arrival, setArrival] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Guest name required"); return; }
    setBusy(true);
    try {
      // Detect conflicts (optional, warn-only for now).
      const conflicts = await findConflicts({
        arrival_at: arrival.replace("T", " ") + ":00",
      });
      if (conflicts.length > 5) {
        toast.warning(`${conflicts.length} bookings around this time — floor may be full.`);
      }

      await createReservation({
        kind,
        guest_name: name.trim(),
        guest_phone: phone.trim() || undefined,
        party_size: kind === "table" ? Number(party) || undefined : undefined,
        arrival_at: arrival.replace("T", " ") + ":00",
        notes: notes.trim() || undefined,
      });
      toast.success("Reservation created");
      onOpenChange(false);
      onCreated();
      // reset
      setName(""); setPhone(""); setNotes("");
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
          <DialogTitle>New {kind} reservation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-muted-foreground">Guest name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wanjiku" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0722…" />
            </div>
            {kind === "table" && (
              <div>
                <label className="text-[12px] text-muted-foreground">Party size</label>
                <Input value={party} onChange={(e) => setParty(e.target.value)} type="number" min={1} />
              </div>
            )}
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Arrival</label>
            <Input value={arrival} onChange={(e) => setArrival(e.target.value)} type="datetime-local" />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground">Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wheelchair access, cake for birthday, etc." />
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
