/**
 * Data access for the vendor portal: the `vendors` profile and the
 * `booking_assignments` that hang off it.
 *
 * Kept apart from vendors.service.ts, which owns the public application form.
 * An application is what somebody submitted; a vendor is an account that
 * exists, and the two are written at different points in the flow by
 * different people.
 */

import { query, queryOne, execute } from "../../db/pool.js";
import type { Tx } from "../../db/pool.js";
import { nowSeconds } from "../../lib/ids.js";
import type { PricedLine } from "../pricing/pricing.types.js";

export type VendorRow = {
  id: string;
  user_id: string;
  application_id: string | null;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  service_types: string[];
  service_area: string | null;
  years_active: number | null;
  has_insurance: boolean;
  portfolio_url: string | null;
  bio: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

export type AssignmentRow = {
  id: string;
  booking_id: string;
  vendor_id: string;
  service_type: string;
  status: string;
  payout_cents: number | null;
  note: string | null;
  response_note: string | null;
  offered_at: number;
  responded_at: number | null;
  created_at: number;
  updated_at: number;
};

/** An assignment joined to the booking it covers, for the vendor's job list. */
export type AssignmentWithBookingRow = AssignmentRow & {
  request_id: string;
  event_type: string;
  event_date: string | null;
  headcount_band: string;
  event_zip: string | null;
  large_event_flag: boolean;
  booking_status: string;
  line_items: PricedLine[];
  contact: { fullName: string; email: string; phone?: string };
};

const VENDOR_COLUMNS = `
  id, user_id, application_id, business_name, contact_name, email, phone, website,
  service_types, service_area, years_active, has_insurance, portfolio_url, bio,
  is_active, created_at, updated_at`;

const ASSIGNMENT_COLUMNS = `
  id, booking_id, vendor_id, service_type, status, payout_cents, note,
  response_note, offered_at, responded_at, created_at, updated_at`;

const runner = (tx?: Tx) => tx ?? { query, queryOne, execute };

/* ------------------------------------------------------------------ vendors */

export const findVendorByUserId = (userId: string, tx?: Tx): Promise<VendorRow | null> =>
  runner(tx).queryOne<VendorRow>(`SELECT ${VENDOR_COLUMNS} FROM vendors WHERE user_id = $1`, [userId]);

export const findVendorById = (id: string, tx?: Tx): Promise<VendorRow | null> =>
  runner(tx).queryOne<VendorRow>(`SELECT ${VENDOR_COLUMNS} FROM vendors WHERE id = $1`, [id]);

export const findVendorByApplicationId = (applicationId: string, tx?: Tx): Promise<VendorRow | null> =>
  runner(tx).queryOne<VendorRow>(`SELECT ${VENDOR_COLUMNS} FROM vendors WHERE application_id = $1`, [
    applicationId,
  ]);

export async function insertVendor(
  input: {
    id: string;
    userId: string;
    applicationId: string | null;
    businessName: string;
    contactName: string;
    email: string;
    phone: string | null;
    website: string | null;
    serviceTypes: string[];
    serviceArea: string | null;
    yearsActive: number | null;
    hasInsurance: boolean;
    portfolioUrl: string | null;
  },
  tx?: Tx,
): Promise<VendorRow> {
  const now = nowSeconds();
  const row = await runner(tx).queryOne<VendorRow>(
    `INSERT INTO vendors
       (id, user_id, application_id, business_name, contact_name, email, phone, website,
        service_types, service_area, years_active, has_insurance, portfolio_url,
        created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$14)
     RETURNING ${VENDOR_COLUMNS}`,
    [
      input.id,
      input.userId,
      input.applicationId,
      input.businessName,
      input.contactName,
      input.email,
      input.phone,
      input.website,
      JSON.stringify(input.serviceTypes),
      input.serviceArea,
      input.yearsActive,
      input.hasInsurance,
      input.portfolioUrl,
      now,
    ],
  );
  if (row === null) throw new Error("insertVendor returned no row");
  return row;
}

/**
 * Writes only the columns present in `patch`. `serviceTypes` and `isActive`
 * are here for the admin directory; the vendor's own PATCH never sends them.
 */
export async function updateVendor(
  id: string,
  patch: Partial<{
    businessName: string;
    contactName: string;
    phone: string | null;
    website: string | null;
    serviceArea: string | null;
    yearsActive: number | null;
    hasInsurance: boolean;
    portfolioUrl: string | null;
    bio: string | null;
    serviceTypes: string[];
    isActive: boolean;
  }>,
  tx?: Tx,
): Promise<VendorRow | null> {
  const columns: Record<string, { column: string; json?: boolean }> = {
    businessName: { column: "business_name" },
    contactName: { column: "contact_name" },
    phone: { column: "phone" },
    website: { column: "website" },
    serviceArea: { column: "service_area" },
    yearsActive: { column: "years_active" },
    hasInsurance: { column: "has_insurance" },
    portfolioUrl: { column: "portfolio_url" },
    bio: { column: "bio" },
    serviceTypes: { column: "service_types", json: true },
    isActive: { column: "is_active" },
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, { column, json }] of Object.entries(columns)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    values.push(json ? JSON.stringify(raw) : (raw ?? null));
    sets.push(json ? `${column} = $${values.length}::jsonb` : `${column} = $${values.length}`);
  }

  values.push(nowSeconds());
  sets.push(`updated_at = $${values.length}`);
  values.push(id);

  return runner(tx).queryOne<VendorRow>(
    `UPDATE vendors SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${VENDOR_COLUMNS}`,
    values,
  );
}

/**
 * The directory the coordinator picks from. `serviceType` narrows it to the
 * vendors who cover that slug, which is the only question an offer ever asks.
 */
export async function listVendors(opts: {
  serviceType?: string;
  includeInactive?: boolean;
  limit: number;
  offset: number;
}): Promise<{ rows: VendorRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (!opts.includeInactive) where.push("is_active");
  if (opts.serviceType !== undefined) {
    params.push(JSON.stringify([opts.serviceType]));
    where.push(`service_types @> $${params.length}::jsonb`);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const countParams = [...params];
  params.push(opts.limit, opts.offset);

  const [rows, countRow] = await Promise.all([
    query<VendorRow>(
      `SELECT ${VENDOR_COLUMNS} FROM vendors ${clause}
        ORDER BY business_name LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ),
    queryOne<{ count: number }>(`SELECT COUNT(*)::bigint AS count FROM vendors ${clause}`, countParams),
  ]);

  return { rows, total: countRow?.count ?? 0 };
}

/* -------------------------------------------------------------- assignments */

export async function insertAssignment(
  input: {
    id: string;
    bookingId: string;
    vendorId: string;
    serviceType: string;
    payoutCents: number | null;
    note: string | null;
  },
  tx?: Tx,
): Promise<AssignmentRow> {
  const now = nowSeconds();
  const row = await runner(tx).queryOne<AssignmentRow>(
    `INSERT INTO booking_assignments
       (id, booking_id, vendor_id, service_type, payout_cents, note, offered_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$7)
     RETURNING ${ASSIGNMENT_COLUMNS}`,
    [input.id, input.bookingId, input.vendorId, input.serviceType, input.payoutCents, input.note, now],
  );
  if (row === null) throw new Error("insertAssignment returned no row");
  return row;
}

export const findAssignmentById = (id: string, tx?: Tx): Promise<AssignmentRow | null> =>
  runner(tx).queryOne<AssignmentRow>(
    `SELECT ${ASSIGNMENT_COLUMNS} FROM booking_assignments WHERE id = $1`,
    [id],
  );

export async function updateAssignment(
  id: string,
  patch: Partial<{
    status: string;
    payoutCents: number | null;
    note: string | null;
    responseNote: string | null;
    respondedAt: number | null;
  }>,
  tx?: Tx,
): Promise<AssignmentRow | null> {
  const columns: Record<string, string> = {
    status: "status",
    payoutCents: "payout_cents",
    note: "note",
    responseNote: "response_note",
    respondedAt: "responded_at",
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    if (!(key in patch)) continue;
    values.push((patch as Record<string, unknown>)[key] ?? null);
    sets.push(`${column} = $${values.length}`);
  }

  values.push(nowSeconds());
  sets.push(`updated_at = $${values.length}`);
  values.push(id);

  return runner(tx).queryOne<AssignmentRow>(
    `UPDATE booking_assignments SET ${sets.join(", ")} WHERE id = $${values.length}
     RETURNING ${ASSIGNMENT_COLUMNS}`,
    values,
  );
}

export const deleteAssignment = (id: string, tx?: Tx): Promise<number> =>
  runner(tx).execute("DELETE FROM booking_assignments WHERE id = $1", [id]);

const ASSIGNMENT_WITH_BOOKING = `
  SELECT a.id, a.booking_id, a.vendor_id, a.service_type, a.status, a.payout_cents,
         a.note, a.response_note, a.offered_at, a.responded_at, a.created_at, a.updated_at,
         b.request_id, b.event_type, b.event_date, b.headcount_band, b.event_zip,
         b.large_event_flag, b.status AS booking_status, b.line_items, b.contact
    FROM booking_assignments a
    JOIN event_booking_requests b ON b.id = a.booking_id`;

export async function listAssignmentsForVendor(
  vendorId: string,
  opts: { status?: string; limit: number; offset: number },
): Promise<{ rows: AssignmentWithBookingRow[]; total: number }> {
  const params: unknown[] = [vendorId];
  let clause = "WHERE a.vendor_id = $1";
  if (opts.status !== undefined) {
    params.push(opts.status);
    clause += ` AND a.status = $${params.length}`;
  }

  const countParams = [...params];
  params.push(opts.limit, opts.offset);

  const [rows, countRow] = await Promise.all([
    query<AssignmentWithBookingRow>(
      `${ASSIGNMENT_WITH_BOOKING} ${clause}
        ORDER BY a.offered_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::bigint AS count FROM booking_assignments a ${clause}`,
      countParams,
    ),
  ]);

  return { rows, total: countRow?.count ?? 0 };
}

export const findAssignmentForVendor = (
  id: string,
  vendorId: string,
): Promise<AssignmentWithBookingRow | null> =>
  queryOne<AssignmentWithBookingRow>(
    `${ASSIGNMENT_WITH_BOOKING} WHERE a.id = $1 AND a.vendor_id = $2`,
    [id, vendorId],
  );

/** Every offer made against one booking, with the vendor's name, for the admin. */
export const listAssignmentsForBooking = (
  bookingId: string,
): Promise<(AssignmentRow & { business_name: string; vendor_email: string })[]> =>
  query<AssignmentRow & { business_name: string; vendor_email: string }>(
    `SELECT a.id, a.booking_id, a.vendor_id, a.service_type, a.status, a.payout_cents,
            a.note, a.response_note, a.offered_at, a.responded_at, a.created_at, a.updated_at,
            v.business_name, v.email AS vendor_email
       FROM booking_assignments a
       JOIN vendors v ON v.id = a.vendor_id
      WHERE a.booking_id = $1
      ORDER BY a.offered_at DESC`,
    [bookingId],
  );

/**
 * What the vendor's overview counts. Payout is summed only over the statuses
 * that represent money the vendor can expect: an offer they have not answered
 * is not earnings, and a decline never was.
 */
export const summariseVendorWork = (
  vendorId: string,
): Promise<{ status: string; count: number; payout: number }[]> =>
  query<{ status: string; count: number; payout: number }>(
    `SELECT status, COUNT(*)::bigint AS count, COALESCE(SUM(payout_cents), 0)::bigint AS payout
       FROM booking_assignments
      WHERE vendor_id = $1
      GROUP BY status`,
    [vendorId],
  );

/** One line of a booking, if the booking actually carries that service. */
export function lineFor(lineItems: PricedLine[] | null, serviceType: string): PricedLine | null {
  return (lineItems ?? []).find((line) => line.serviceType === serviceType) ?? null;
}
