/**
 * RoomPickerSheet — right-side sheet for picking a room, in two modes.
 *
 *   mode="booking"       → rooms available|dirty|cleaning for a given
 *                         room_type_id. Dirty ones get a "Needs
 *                         turnaround" pill so the front desk can still
 *                         pre-assign but knows housekeeping is pending.
 *
 *   mode="room_service"  → rooms currently in status='occupied' that
 *                         have an OPEN folio. Row shows the guest name
 *                         so the operator picks by person, not number.
 *
 * Reuses the same shape as IngredientPickerSheet: right-side Sheet,
 * search input, filter chips per status, single-select (rooms are
 * assigned one at a time). No "New room" affordance here — rooms are
 * created via Hospitality > Rooms.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bed as BedDouble, User, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  listAvailableRoomsForType,
  listRoomsForRoomService,
  type Room,
} from "@/services/hospitality";
import { cn } from "@/lib/utils";

interface BookingPick {
  roomId: string;
  roomNumber: string;
  needsTurnaround: boolean;
}

interface RoomServicePick {
  roomId: string;
  roomNumber: string;
  folioId: string | null;
  guestName: string | null;
}

type Props =
  | {
      mode: "booking";
      open: boolean;
      roomTypeId: string;
      onClose: () => void;
      onPick: (pick: BookingPick) => void;
    }
  | {
      mode: "room_service";
      open: boolean;
      onClose: () => void;
      onPick: (pick: RoomServicePick) => void;
    };

const STATUS_STYLE: Record<string, string> = {
  available: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  occupied: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  reserved: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  dirty: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  cleaning: "border-muted bg-muted/50 text-muted-foreground",
  maintenance: "border-muted bg-muted/50 text-muted-foreground",
  out_of_order: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function RoomPickerSheet(props: Props) {
  const [rooms, setRooms] = useState<Array<
    | (Room & { needs_turnaround: boolean })
    | { id: string; room_number: string; folio_id: string | null; guest_name: string | null; status?: string }
  >>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setLoading(true);
    setPicked(null);
    setSearch("");
    setStatusFilter(null);
    if (props.mode === "booking") {
      listAvailableRoomsForType(props.roomTypeId)
        .then((r) => setRooms(r))
        .finally(() => setLoading(false));
    } else {
      listRoomsForRoomService()
        .then((r) => setRooms(r as never))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.mode, "roomTypeId" in props ? props.roomTypeId : ""]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (search && !r.room_number.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && "status" in r && r.status !== statusFilter) return false;
      return true;
    });
  }, [rooms, search, statusFilter]);

  const statusesInList = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) if ("status" in r && r.status) set.add(r.status);
    return Array.from(set);
  }, [rooms]);

  const confirm = () => {
    if (!picked) {
      toast.error("Pick a room first");
      return;
    }
    const r = rooms.find((rr) => rr.id === picked);
    if (!r) return;
    if (props.mode === "booking") {
      const b = r as Room & { needs_turnaround: boolean };
      props.onPick({
        roomId: b.id,
        roomNumber: b.room_number,
        needsTurnaround: b.needs_turnaround,
      });
    } else {
      const rs = r as { id: string; room_number: string; folio_id: string | null; guest_name: string | null };
      if (!rs.folio_id) {
        toast.error("This room has no open folio — front desk needs to check the guest in first.");
        return;
      }
      props.onPick({
        roomId: rs.id,
        roomNumber: rs.room_number,
        folioId: rs.folio_id,
        guestName: rs.guest_name,
      });
    }
    props.onClose();
  };

  const heading = props.mode === "booking" ? "Assign a room" : "Room service — pick a room";
  const description =
    props.mode === "booking"
      ? "Rooms available for this type. Dirty rooms can still be pre-assigned; housekeeping just needs to turn them around before the guest arrives."
      : "Occupied rooms with an open folio. Charges route to the guest's tab automatically.";

  return (
    <Sheet open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="px-5 pt-3 pb-2 space-y-2 border-b border-border">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room number…"
            autoFocus
          />
          {statusesInList.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setStatusFilter(null)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  statusFilter === null
                    ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {statusesInList.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-colors capitalize",
                    statusFilter === s
                      ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground italic">Loading rooms…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              {props.mode === "booking"
                ? "No rooms of this type are assignable right now."
                : "No occupied rooms with open folios."}
            </div>
          ) : (
            <ul>
              {filtered.map((r) => {
                const isPicked = picked === r.id;
                const status = "status" in r ? r.status : "occupied";
                const needsTurn = "needs_turnaround" in r && r.needs_turnaround;
                const guestName = "guest_name" in r ? r.guest_name : null;
                return (
                  <li
                    key={r.id}
                    onClick={() => setPicked(r.id)}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3 border-b border-border cursor-pointer transition-colors",
                      isPicked ? "bg-primary/[0.08]" : "hover:bg-accent/40",
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 size-9 rounded-lg grid place-items-center",
                        isPicked ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Room {r.room_number}</div>
                      {guestName ? (
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> {guestName}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {status ? (
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] capitalize", STATUS_STYLE[status ?? "available"])}
                        >
                          {(status ?? "available").replace("_", " ")}
                        </Badge>
                      ) : null}
                      {needsTurn ? (
                        <span className="text-[9px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-0.5">
                          <Warning className="h-2.5 w-2.5" /> needs turnaround
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SheetFooter className="border-t border-border p-3 flex-row justify-between">
          <Button variant="ghost" size="sm" onClick={props.onClose}>Cancel</Button>
          <Button size="sm" onClick={confirm} disabled={!picked}>
            Pick room
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
