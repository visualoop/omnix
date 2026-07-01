/**
 * Reservations service — table + room bookings.
 *
 * Two kinds: 'table' (restaurant/bar) and 'room' (hotel). Booking flow:
 *   createReservation → confirmed
 *   arrivalAt reached → seated / checked_in
 *   no_show if guest doesn't arrive
 *   completed when they leave / check out
 *   cancelled if voided
 */
import { execute, query } from "@/lib/db";

export type ReservationKind = "table" | "room";
export type ReservationStatus =
  | "confirmed" | "seated" | "checked_in" | "no_show" | "cancelled" | "completed";

export interface Reservation {
  id: string;
  kind: ReservationKind;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number | null;
  table_id: string | null;
  room_id: string | null;
  arrival_at: string;
  departure_at: string | null;
  status: ReservationStatus;
  deposit_amount: number;
  deposit_paid_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export interface CreateReservationInput {
  kind: ReservationKind;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size?: number;
  table_id?: string;
  room_id?: string;
  arrival_at: string;
  departure_at?: string;
  deposit_amount?: number;
  notes?: string;
  created_by?: string;
}

export async function createReservation(input: CreateReservationInput): Promise<string> {
  const id = newId();
  await execute(
    `INSERT INTO reservations
      (id, kind, guest_name, guest_phone, guest_email, party_size, table_id, room_id,
       arrival_at, departure_at, deposit_amount, notes, created_by, created_at, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'), 'confirmed')`,
    [
      id, input.kind, input.guest_name, input.guest_phone ?? null,
      input.guest_email ?? null, input.party_size ?? null,
      input.table_id ?? null, input.room_id ?? null,
      input.arrival_at, input.departure_at ?? null,
      input.deposit_amount ?? 0, input.notes ?? null,
      input.created_by ?? null,
    ],
  );
  return id;
}

export async function listReservations(opts: {
  kind?: ReservationKind;
  from?: string;
  to?: string;
  status?: ReservationStatus;
} = {}): Promise<Reservation[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 0;
  if (opts.kind) { clauses.push(`kind = ?${++i}`); params.push(opts.kind); }
  if (opts.status) { clauses.push(`status = ?${++i}`); params.push(opts.status); }
  if (opts.from) { clauses.push(`arrival_at >= ?${++i}`); params.push(opts.from); }
  if (opts.to) { clauses.push(`arrival_at <= ?${++i}`); params.push(opts.to); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return query<Reservation>(
    `SELECT * FROM reservations ${where} ORDER BY arrival_at ASC LIMIT 500`,
    params,
  );
}

export async function updateStatus(id: string, status: ReservationStatus): Promise<void> {
  await execute(`UPDATE reservations SET status = ?2 WHERE id = ?1`, [id, status]);
}

export async function deleteReservation(id: string): Promise<void> {
  await execute(`DELETE FROM reservations WHERE id = ?1`, [id]);
}

/** Return conflicts: reservations that overlap the given (start, end) for the given table or room. */
export async function findConflicts(opts: {
  table_id?: string;
  room_id?: string;
  arrival_at: string;
  departure_at?: string;
  exclude_id?: string;
}): Promise<Reservation[]> {
  const clauses: string[] = ["status IN ('confirmed','seated','checked_in')"];
  const params: unknown[] = [];
  let i = 0;
  if (opts.table_id) { clauses.push(`table_id = ?${++i}`); params.push(opts.table_id); }
  if (opts.room_id) { clauses.push(`room_id = ?${++i}`); params.push(opts.room_id); }
  if (opts.exclude_id) { clauses.push(`id != ?${++i}`); params.push(opts.exclude_id); }
  // Simple overlap: any existing reservation whose (arrival, departure) overlaps our window.
  const end = opts.departure_at ?? new Date(new Date(opts.arrival_at).getTime() + 2 * 3600_000).toISOString();
  clauses.push(`arrival_at < ?${++i}`);
  params.push(end);
  clauses.push(`(departure_at IS NULL OR departure_at > ?${++i})`);
  params.push(opts.arrival_at);
  return query<Reservation>(
    `SELECT * FROM reservations WHERE ${clauses.join(" AND ")} ORDER BY arrival_at ASC`,
    params,
  );
}
