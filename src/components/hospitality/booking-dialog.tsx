/**
 * BookingDialog — replaces the old CompactFormDialog for bookings.
 *
 * Solves audit findings H1, H6, U8, U9, M2:
 *   - Front desk can pick a specific room, not just a type.
 *   - Guest picker adopts an existing guest by phone / national ID.
 *   - Full Kenya AHRA fields available (national ID, nationality).
 *   - Rate override so promos and negotiated rates aren't hidden.
 *   - Right-side Sheet, not a cramped modal.
 */
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Bed as BedDouble, Check, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createBooking, type RoomType, type Guest } from "@/services/hospitality";
import { GuestPicker } from "@/components/hospitality/guest-picker";
import { RoomPickerSheet } from "@/components/hospitality/room-picker-sheet";
import { money as KES } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  roomTypes: RoomType[];
  userId?: string;
  /** Prefill from the calendar: a specific room + check-in night. */
  preset?: { roomId?: string; roomTypeId?: string; roomNumber?: string; checkIn?: string } | null;
}

export function BookingDialog({ open, onClose, onCreated, roomTypes, userId, preset }: Props) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [typeId, setTypeId] = useState<string>("");
  const [preferredRoom, setPreferredRoom] = useState<{ roomId: string; roomNumber: string; needsTurnaround: boolean } | null>(null);
  const [checkIn, setCheckIn] = useState(isoDaysAhead(0));
  const [checkOut, setCheckOut] = useState(isoDaysAhead(1));
  const [rateOverride, setRateOverride] = useState<string>("");
  const [adults, setAdults] = useState<string>("1");
  const [notes, setNotes] = useState<string>("");
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGuest(null);
    setTypeId(preset?.roomTypeId ?? roomTypes[0]?.id ?? "");
    setPreferredRoom(preset?.roomId && preset?.roomNumber ? { roomId: preset.roomId, roomNumber: preset.roomNumber, needsTurnaround: false } : null);
    const ci = preset?.checkIn ?? isoDaysAhead(0);
    setCheckIn(ci);
    // default check-out to the night after check-in
    const co = new Date(ci); co.setDate(co.getDate() + 1);
    setCheckOut(co.toISOString().slice(0, 10));
    setRateOverride("");
    setAdults("1");
    setNotes("");
  }, [open, roomTypes, preset]);

  const selectedType = roomTypes.find((t) => t.id === typeId) ?? null;
  // Show KES 0/night rather than "undefined" when base_rate is missing (H6).
  const typeOptions = roomTypes.map((t) => ({
    value: t.id,
    label: t.name,
    hint: `${KES(t.base_rate ?? 0)}/night`,
  }));

  const nights = (() => {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
  })();

  const rate = Number(rateOverride) || selectedType?.base_rate || 0;
  const total = rate * nights;

  const save = async () => {
    if (!guest) {
      toast.error("Pick or add a guest first");
      return;
    }
    if (!selectedType) {
      toast.error("Pick a room type");
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      toast.error("Check-out must be after check-in");
      return;
    }
    setSaving(true);
    try {
      await createBooking({
        guestName: guest.full_name,
        phone: guest.phone ?? undefined,
        email: guest.email ?? undefined,
        nationalId: guest.id_number ?? undefined,
        nationality: guest.nationality ?? undefined,
        notes: notes.trim() || guest.notes || undefined,
        roomTypeId: selectedType.id,
        checkIn,
        checkOut,
        ratePerNight: rate,
        adults: Number(adults) || 1,
        userId,
        preferredRoomId: preferredRoom?.roomId ?? null,
      });
      toast.success("Booking created");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>New booking</SheetTitle>
            <SheetDescription>
              Guest, room, and stay dates in one place. Room assignment is
              optional now — check-in can pick it later.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <Field label="Guest" required>
              <GuestPicker value={guest?.id ?? null} onChange={setGuest} />
              {guest ? (
                <div className="text-[11px] text-muted-foreground mt-1 space-x-2">
                  {guest.phone ? <span>{guest.phone}</span> : null}
                  {guest.id_number ? <span>· ID {guest.id_number}</span> : null}
                  {guest.email ? <span>· {guest.email}</span> : null}
                </div>
              ) : null}
            </Field>

            <Field label="Room type" required>
              <Combobox
                value={typeId}
                onChange={setTypeId}
                options={typeOptions}
                placeholder="Pick a room type…"
                emptyText="No matching type"
              />
            </Field>

            {typeId ? (
              <Field label="Room (optional)">
                {preferredRoom ? (
                  <div className={cn(
                    "flex items-center gap-2 rounded-md border p-2",
                    preferredRoom.needsTurnaround ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5",
                  )}>
                    <BedDouble className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Room {preferredRoom.roomNumber}</div>
                      {preferredRoom.needsTurnaround ? (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                          <Warning className="h-3 w-3" /> Needs turnaround before check-in
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" /> Ready
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreferredRoom(null)}
                      className="text-[11px] text-muted-foreground hover:text-rose-600 underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRoomPickerOpen(true)}
                    className="w-full"
                  >
                    <BedDouble className="h-3.5 w-3.5 mr-1.5" /> Pick a room (or leave for check-in)
                  </Button>
                )}
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-in" required>
                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </Field>
              <Field label="Check-out" required>
                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </Field>
              <Field label="Rate / night">
                <Input
                  type="number"
                  step="0.01"
                  value={rateOverride}
                  onChange={(e) => setRateOverride(e.target.value)}
                  placeholder={selectedType ? String(selectedType.base_rate ?? 0) : ""}
                  className="font-mono"
                />
              </Field>
              <Field label="Adults">
                <Input type="number" value={adults} onChange={(e) => setAdults(e.target.value)} min={1} max={20} className="font-mono" />
              </Field>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {nights} night{nights === 1 ? "" : "s"} × {KES(rate)}
              </span>
              <span className="font-mono font-medium tabular-nums">{KES(total)}</span>
            </div>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Special requests, allergies, VIP…"
              />
            </Field>
          </div>

          <SheetFooter className="border-t border-border p-3 flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create booking"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {typeId ? (
        <RoomPickerSheet
          mode="booking"
          open={roomPickerOpen}
          roomTypeId={typeId}
          onClose={() => setRoomPickerOpen(false)}
          onPick={(pick) => setPreferredRoom(pick)}
        />
      ) : null}
    </>
  );
}

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
        {required ? <span className="text-rose-600 ml-1">*</span> : null}
      </span>
      {children}
    </label>
  );
}
