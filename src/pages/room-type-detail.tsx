/**
 * Room Type detail — /hospitality/room-types/:id
 *
 * Shows rooms of this type, occupancy rate, base rate, active bookings.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bed, Users } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { query } from "@/lib/db";
import { money as KES } from "@/lib/money";

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
  max_occupancy: number;
  active: number;
}
interface Room {
  id: string;
  room_number: string;
  floor: string | null;
  status: string;
  active: number;
}

const STATUS_CLASSES: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  occupied: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  dirty: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  cleaning: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  maintenance: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  out_of_order: "bg-neutral-500/10 text-neutral-600",
};

export function RoomTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<RoomType | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      query<RoomType>(`SELECT id, name, base_rate, max_occupancy, active FROM room_types WHERE id = ?1`, [id]),
      query<Room>(
        `SELECT id, room_number, floor, status, active
         FROM rooms WHERE room_type_id = ?1 AND active = 1
         ORDER BY floor, room_number`,
        [id],
      ),
    ]).then(([types, r]) => {
      setType(types[0] ?? null);
      setRooms(r);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!type) return <p className="p-6 text-sm text-muted-foreground">Room type not found.</p>;

  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const available = rooms.filter((r) => r.status === "available").length;
  const occupancyPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

  // Group by floor
  const byFloor = new Map<string, Room[]>();
  for (const r of rooms) {
    const f = r.floor ?? "—";
    if (!byFloor.has(f)) byFloor.set(f, []);
    byFloor.get(f)!.push(r);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ fallback: "/hospitality?tab=rooms" }}
        eyebrow="Room type"
        title={type.name}
        description={`Base rate ${KES(type.base_rate)}/night · Max ${type.max_occupancy} guest${type.max_occupancy === 1 ? "" : "s"}`}
      />

      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Rooms" value={rooms.length.toLocaleString()} />
        <Kpi label="Occupied" value={`${occupied} / ${rooms.length}`} tone={occupied ? "warn" : "muted"} />
        <Kpi label="Available" value={available.toLocaleString()} tone={available ? "accent" : "muted"} />
        <Kpi label="Occupancy" value={`${occupancyPct}%`} />
      </div>

      {rooms.length === 0 ? (
        <EmptyState icon={Bed} title="No rooms of this type" description="Add rooms of this type from Hospitality → Rooms." />
      ) : (
        <div className="space-y-4">
          {[...byFloor.entries()].map(([floor, rs]) => (
            <div key={floor}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Floor {floor}</div>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                {rs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/hospitality/rooms/${r.id}`)}
                    className="rounded-lg border border-border p-3 text-left hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{r.room_number}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CLASSES[r.status] || ""}`}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-[10px] mt-1 inline-flex items-center gap-0.5 text-muted-foreground">
                      <Users className="h-3 w-3" /> {type.max_occupancy}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "accent" | "muted" }) {
  const cls =
    tone === "warn" ? "text-amber-600" :
    tone === "accent" ? "text-emerald-600" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold font-mono tabular-nums mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
