import { query, queryOne } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";
import type { PricedLine } from "../pricing/pricing.types.js";

type BookingRow = {
  id: string;
  request_id: string;
  brand: string;
  event_type: string;
  event_date: string | null;
  headcount_band: string;
  event_zip: string | null;
  large_event_flag: boolean;
  line_items: PricedLine[];
  package_total: number;
  budget_band: string | null;
  contact: { fullName: string; email: string; phone?: string };
  notes: string | null;
  source: string;
  status: string;
  created_at: number;
  updated_at: number;
};

const SELECT_COLUMNS = `
  SELECT id, request_id, brand, event_type, event_date, headcount_band, event_zip,
         large_event_flag, line_items, package_total, budget_band, contact, notes,
         source, status, created_at, updated_at
    FROM event_booking_requests`;

function toDto(row: BookingRow) {
  return {
    id: row.id,
    requestId: row.request_id,
    brand: row.brand,
    eventType: row.event_type,
    eventDate: row.event_date,
    headcountBand: row.headcount_band,
    eventZip: row.event_zip,
    largeEventFlag: row.large_event_flag,
    lineItems: row.line_items,
    packageTotal: row.package_total,
    budgetBand: row.budget_band,
    contact: row.contact,
    notes: row.notes,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBookings(status: string | undefined, page: number, pageSize: number, offset: number) {
  const where = status === undefined ? "" : "WHERE status = $3";
  const params = status === undefined ? [pageSize, offset] : [pageSize, offset, status];
  const countParams = status === undefined ? [] : [status];

  const [rows, countRow] = await Promise.all([
    query<BookingRow>(
      `${SELECT_COLUMNS} ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::bigint AS count FROM event_booking_requests ${status === undefined ? "" : "WHERE status = $1"}`,
      countParams,
    ),
  ]);

  return { items: rows.map(toDto), page, pageSize, total: countRow?.count ?? 0 };
}

export async function getBooking(id: string) {
  const row = await queryOne<BookingRow>(`${SELECT_COLUMNS} WHERE id = $1`, [id]);
  if (row === null) throw notFound("We cannot find a booking request with that id.");
  return toDto(row);
}

export async function updateBookingStatus(id: string, status: string) {
  const row = await queryOne<BookingRow>(
    `UPDATE event_booking_requests SET status = $2, updated_at = $3 WHERE id = $1 RETURNING
       id, request_id, brand, event_type, event_date, headcount_band, event_zip,
       large_event_flag, line_items, package_total, budget_band, contact, notes,
       source, status, created_at, updated_at`,
    [id, status, nowSeconds()],
  );
  if (row === null) throw notFound("We cannot find a booking request with that id.");
  return toDto(row);
}
