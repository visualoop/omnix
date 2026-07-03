/**
 * Room detail — /hospitality/rooms/:id
 *
 * Current occupant + booking, housekeeping status, past bookings + revenue.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bed, CalendarBlank as Calendar, Broom } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { query, execute } from "@/lib/db";
import { money as KES } from "@/lib/money";
import { intlLocale } from "@/lib/intl";
import { toast } from "sonner";

interface Room {
  id: string;
  room_number: string;
  floor: string | null;
  status: string;
  room_type_id: string;
  room_type_name: string;
  base_rate: number;
  max_occupancy: number;
}
interface CurrentBooking {
  id: string;
  booking_number: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  rate_per_night: number;
  status: string;
}
interface PastBooking {
  id: string;
  booking_number: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  total: number;
}

const STATUS_ORDER: Array<{ v: string; label: string }> = [
  { v: "available", label: "Available" },
  { v: "occupied", label: "Occupied" },
  { v: "dirty", label: "Dirty" },
  { v: "cleaning", label: "Cleaning" },
  { v: "maintenance", label: "Maintenance" },
  { v: "out_of_order", label: "Out of order" },
];

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  occupied: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dirty: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  cleaning: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  maintenance: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  out_of_order: "bg-neutral-500/10 text-neutral-600",
};

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [current, setCurrent] = useState<CurrentBooking | null>(null);
  const [past, setPast] = useState<PastBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [rooms, cur, hist] = await Promise.all([
        query<Room>(
          `SELECT r.id, r.room_number, r.floor, r.status, r.room_type_id,
                  rt.name AS room_type_name, rt.base_rate, rt.max_occupancy
           FROM rooms r
           JOIN room_types rt ON rt.id = r.room_type_id
           WHERE r.id = ?1`,
          [id],
        ),
        query<CurrentBooking>(
          `SELECT b.id, b.booking_number, b.guest_id,
                  g.full_name AS guest_name, g.phone AS guest_phone,
                  b.check_in_date, b.check_out_date, b.adults, b.children,
                  b.rate_per_night, b.status
           FROM bookings b
           JOIN guests g ON g.id = b.guest_id
           WHERE b.room_id = ?1 AND b.status = 'checked_in'
           LIMIT 1`,
          [id],
        ),
        query<PastBooking>(
          `SELECT b.id, b.booking_number, g.full_name AS guest_name,
                  b.check_in_date, b.check_out_date,
                  b.rate_per_night * (julianday(b.check_out_date) - julianday(b.check_in_date)) AS total
           FROM bookings b
           JOIN guests g ON g.id = b.guest_id
           WHERE b.room_id = ?1 AND b.status IN ('checked_out', 'cancelled', 'no_show')
           ORDER BY b.check_in_date DESC LIMIT 10`,
          [id],
        ),
      ]);
      setRoom(rooms[0] ?? null);
      setCurrent(cur[0] ?? null);
      setPast(hist);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (next: string) => {
    if (!room) return;
    await execute(`UPDATE rooms SET status = ?2 WHERE id = ?1`, [room.id, next]);
    toast.success(`Room ${room.room_number} → ${next}`);
    load();
  };

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!room) return <p className="p-6 text-sm text-muted-foreground">Room not found.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: `/hospitality/room-types/${room.room_type_id}` }}
        eyebrow={room.floor ? `${room.room_type_name} · Floor ${room.floor}` : room.room_type_name}
        title={`Room ${room.room_number}`}
        description={`${KES(room.base_rate)}/night · Max ${room.max_occupancy} guest${room.max_occupancy === 1 ? "" : "s"}`}
        actions={
          <Badge variant="outline" className={`text-xs ${STATUS_CLASSES[room.status] || ""}`}>
            {room.status.replace(/_/g, " ")}
          </Badge>
        }
      />

      {/* Current booking */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Current stay</h2>
        {current ? (
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <div className="font-semibold text-base">{current.guest_name}</div>
                {current.guest_phone ? <div className="text-xs text-muted-foreground">{current.guest_phone}</div> : null}
              </div>
              <Badge className="bg-amber-600">{current.status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-in</div>
                <div className="font-mono">{new Date(current.check_in_date).toLocaleDateString(intlLocale(), { dateStyle: "medium" })}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-out</div>
                <div className="font-mono">{new Date(current.check_out_date).toLocaleDateString(intlLocale(), { dateStyle: "medium" })}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Guests</div>
                <div className="font-mono">{current.adults}A{current.children ? ` + ${current.children}C` : ""}</div>
              </div>
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/hospitality/bookings/${current.id}`)}
              >
                Open booking #{current.booking_number}
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState icon={Bed} title="No current guest" description="Room is available or between stays." />
        )}
      </section>

      {/* Housekeeping status control */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 inline-flex items-center gap-1.5">
          <Broom className="h-3.5 w-3.5" /> Housekeeping status
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s.v}
              onClick={() => setStatus(s.v)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                room.status === s.v
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Past bookings */}
      <section>
        <h2 className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Recent stays</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No history yet.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border/60">
            {past.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => navigate(`/hospitality/bookings/${b.id}`)}
                >
                  #{b.booking_number}
                </Button>
                <span className="flex-1">{b.guest_name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(b.check_in_date).toLocaleDateString(intlLocale())} → {new Date(b.check_out_date).toLocaleDateString(intlLocale())}
                </span>
                <span className="font-mono tabular-nums">{KES(b.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
