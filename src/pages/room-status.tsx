/**
 * /hospitality/rooms — live housekeeping board.
 *
 * Grid of every room with current status. Click to toggle status
 * (clean → dirty → inspected → occupied → clean cycle). Each transition
 * writes to room_status_log.
 */
import { useEffect, useState, useCallback } from "react";
import { Bed, Broom, CheckCircle, Warning, User } from "@phosphor-icons/react";
import { execute, query } from "@/lib/db";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

type RoomStatus = "clean" | "dirty" | "inspected" | "out_of_order" | "occupied";

interface Room {
  id: string;
  room_number: string;
  room_type_name: string | null;
  current_status: RoomStatus;
}

const STATUS_CONFIG: Record<RoomStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  clean: { label: "Clean", color: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700", icon: CheckCircle },
  dirty: { label: "Dirty", color: "bg-amber-500/10 border-amber-500/40 text-amber-700", icon: Broom },
  inspected: { label: "Inspected", color: "bg-blue-500/10 border-blue-500/40 text-blue-700", icon: CheckCircle },
  out_of_order: { label: "Out of order", color: "bg-red-500/10 border-red-500/40 text-red-700", icon: Warning },
  occupied: { label: "Occupied", color: "bg-purple-500/10 border-purple-500/40 text-purple-700", icon: User },
};

const NEXT_STATUS: Record<RoomStatus, RoomStatus> = {
  clean: "occupied",
  occupied: "dirty",
  dirty: "inspected",
  inspected: "clean",
  out_of_order: "clean",
};

export function RoomStatusPage() {
  const user = useAuthStore((s) => s.user);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRooms(await query<Room>(
        `SELECT r.id, r.room_number, rt.name AS room_type_name, r.current_status
         FROM rooms r LEFT JOIN room_types rt ON rt.id = r.room_type_id
         ORDER BY r.room_number ASC`,
      ).catch(() => []));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cycleStatus = async (room: Room) => {
    const next = NEXT_STATUS[room.current_status];
    await execute(
      `UPDATE rooms SET current_status = ?2 WHERE id = ?1`,
      [room.id, next],
    );
    await execute(
      `INSERT INTO room_status_log (id, room_id, status, changed_by)
       VALUES (?1, ?2, ?3, ?4)`,
      [crypto.randomUUID().replace(/-/g, "").slice(0, 16), room.id, next, user?.id ?? null],
    );
    toast.success(`Room ${room.room_number} → ${STATUS_CONFIG[next].label}`);
    load();
  };

  const setStatus = async (room: Room, status: RoomStatus) => {
    await execute(`UPDATE rooms SET current_status = ?2 WHERE id = ?1`, [room.id, status]);
    await execute(
      `INSERT INTO room_status_log (id, room_id, status, changed_by)
       VALUES (?1, ?2, ?3, ?4)`,
      [crypto.randomUUID().replace(/-/g, "").slice(0, 16), room.id, status, user?.id ?? null],
    );
    load();
  };
  void setStatus;

  const summary = rooms.reduce<Record<RoomStatus, number>>((acc, r) => {
    acc[r.current_status] = (acc[r.current_status] ?? 0) + 1;
    return acc;
  }, { clean: 0, dirty: 0, inspected: 0, out_of_order: 0, occupied: 0 });

  return (
    <div className="max-w-5xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bed className="h-5 w-5 text-primary" /> Room status
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live housekeeping board. Click a room to advance its status through the cycle: clean → occupied → dirty → inspected → clean.
        </p>
      </header>

      <div className="grid grid-cols-5 gap-2">
        {(Object.keys(STATUS_CONFIG) as RoomStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className={`rounded-md border p-2 flex items-center gap-2 text-[13px] ${cfg.color}`}>
              <Icon className="h-3.5 w-3.5" />
              <span className="font-medium">{summary[s]}</span>
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="py-12 text-center">
          <Bed className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm text-muted-foreground">
            No rooms configured yet. Go to Settings → Hospitality to add rooms.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {rooms.map((r) => {
            const cfg = STATUS_CONFIG[r.current_status];
            const Icon = cfg.icon;
            return (
              <button
                key={r.id}
                onClick={() => cycleStatus(r)}
                className={`rounded-md border p-3 text-left transition hover:opacity-80 ${cfg.color}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-lg font-mono font-semibold">{r.room_number}</div>
                  <Icon className="h-4 w-4" />
                </div>
                {r.room_type_name && (
                  <div className="text-[11px] mt-0.5 opacity-80">{r.room_type_name}</div>
                )}
                <div className="text-[10.5px] uppercase tracking-wider mt-1">{cfg.label}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
